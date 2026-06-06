// ============================================================
// Adaptador compatible con Supabase sobre PostgreSQL de acmsy.
//
// Reemplaza a `@supabase/supabase-js` para la CAPA DE DATOS: expone el mismo
// `from(...).select()/insert()/update()/delete()` y `rpc(...)` que ya usa el
// codigo de la app, devolviendo `{ data, error }`. Por dentro ejecuta SQL con
// el rol 'authenticated' y el usuario fijado (auth.uid()), de modo que las
// politicas RLS aplican igual que en Supabase.  ASI NO HAY QUE REESCRIBIR LA
// CAPA DE DATOS: solo se cambia de donde sale el cliente (en hooks.server.ts).
//
// El login (auth) NO pasa por aqui: se maneja en hooks + rutas con el modulo
// de auth de acmsy.
// ============================================================
import { withUser, query } from './db';

type Row = Record<string, any>;
type Result<T = any> = { data: T; count?: number | null; error: { message: string } | null };

// --- relaciones (FK) para resolver selects con recursos incrustados ---
type Rel = { localCol: string; foreignTable: string; foreignCol: string };
type RelMap = {
	// fromTable -> { foreignTable -> rel }  (FK saliente: a-uno)
	toOne: Record<string, Record<string, Rel>>;
	// table -> [{ childTable, childCol, parentCol }]  (FK entrante: a-muchos)
	toMany: Record<string, Array<{ childTable: string; childCol: string; parentCol: string }>>;
};
let relMapP: Promise<RelMap> | null = null;
// Las relaciones (FK) son metadata del esquema: se leen con la conexion de
// superusuario (como 'authenticated' con RLS, information_schema OCULTA las FK
// y los embeds no se resolverian). Se cachea una sola vez.
async function loadRels(): Promise<RelMap> {
	const rows = (await query(`
		select tc.table_name as from_table, kcu.column_name as local_col,
		       ccu.table_name as foreign_table, ccu.column_name as foreign_col
		from information_schema.table_constraints tc
		join information_schema.key_column_usage kcu
		  on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
		join information_schema.constraint_column_usage ccu
		  on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
		where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'`)) as Array<{
		from_table: string;
		local_col: string;
		foreign_table: string;
		foreign_col: string;
	}>;
	const m: RelMap = { toOne: {}, toMany: {} };
	for (const r of rows) {
		(m.toOne[r.from_table] ||= {})[r.foreign_table] = {
			localCol: r.local_col,
			foreignTable: r.foreign_table,
			foreignCol: r.foreign_col
		};
		(m.toMany[r.foreign_table] ||= []).push({
			childTable: r.from_table,
			childCol: r.local_col,
			parentCol: r.foreign_col
		});
	}
	return m;
}

// Separa por comas de primer nivel (respeta parentesis de los embeds).
function splitTop(s: string): string[] {
	const out: string[] = [];
	let depth = 0,
		cur = '';
	for (const ch of s) {
		if (ch === '(') depth++;
		if (ch === ')') depth--;
		if (ch === ',' && depth === 0) {
			out.push(cur.trim());
			cur = '';
		} else cur += ch;
	}
	if (cur.trim()) out.push(cur.trim());
	return out;
}

// Construye las columnas de un SELECT con embeds (recursos incrustados estilo
// PostgREST), RECURSIVO para embeds anidados (p.ej. divisiones(... aportes(...))).
// `alias` es como se referencian las columnas de `table` (la tabla raiz usa su
// propio nombre como alias; los embeds usan un alias unico t1, t2, ...).
function embedCols(
	rels: RelMap,
	table: string,
	alias: string,
	selectStr: string,
	ctr: { n: number },
	filters: Filter[],
	params: any[]
): string {
	return splitTop(selectStr)
		.map((tok) => {
			// Embed: "tabla(cols)" o con FK nombrada "tabla!fk_constraint(cols)".
			const mEmbed = tok.match(/^([a-zA-Z_][\w]*)(?:!\w+)?\s*\(([\s\S]*)\)$/);
			if (!mEmbed) {
				// Columna escalar: calificada con el alias (necesario dentro de subconsultas).
				return tok === '*' ? `${alias}.*` : `${alias}.${tok}`;
			}
			const relName = mEmbed[1];
			const innerStr = mEmbed[2].trim() || '*';
			const childAlias = 't' + ++ctr.n;
			const inner = embedCols(rels, relName, childAlias, innerStr, ctr, filters, params);
			// Filtros sobre ESTE recurso incrustado ("<relName>.<col>") -> WHERE del subselect.
			const extra = (filters || [])
				.filter((f) => f.col.startsWith(relName + '.'))
				.map((f) => {
					const sub = f.col.slice(relName.length + 1);
					if (f.op === 'is')
						return ` and ${childAlias}.${sub} is ${f.val === null ? 'null' : f.val ? 'true' : 'false'}`;
					if (f.op === 'in') {
						params.push(f.val);
						return ` and ${childAlias}.${sub} = any($${params.length})`;
					}
					params.push(f.val);
					return ` and ${childAlias}.${sub} ${f.op} $${params.length}`;
				})
				.join('');
			const one = rels.toOne[table]?.[relName];
			if (one) {
				return `(select row_to_json(s) from (select ${inner} from ${relName} ${childAlias} where ${childAlias}.${one.foreignCol} = ${alias}.${one.localCol}${extra}) s) as "${relName}"`;
			}
			const many = (rels.toMany[table] || []).find((r) => r.childTable === relName);
			if (many) {
				return `(select coalesce(json_agg(row_to_json(s)), '[]'::json) from (select ${inner} from ${relName} ${childAlias} where ${childAlias}.${many.childCol} = ${alias}.${many.parentCol}${extra}) s) as "${relName}"`;
			}
			return tok; // sin relacion detectada
		})
		.join(', ');
}

type Filter = { col: string; op: string; val: any };

class QueryBuilder<T = any> implements PromiseLike<Result<T>> {
	private filters: Filter[] = [];
	private orGroups: string[] = [];
	private selectStr = '*';
	private orderBy: Array<{ col: string; asc: boolean; nulls?: string }> = [];
	private limitN: number | null = null;
	private rangeFromTo: [number, number] | null = null;
	private mode: 'select' | 'insert' | 'update' | 'delete' = 'select';
	private payload: Row | Row[] | null = null;
	private onConflictCols: string | null = null;
	private returning = false;
	private singleMode: 'one' | 'maybe' | null = null;
	private wantCount = false;

	constructor(
		private uid: string | null,
		private table: string
	) {}

	select(cols = '*') {
		if (this.mode === 'select') this.selectStr = cols || '*';
		else this.returning = true;
		if (cols && this.mode !== 'select') this.selectStr = cols;
		return this;
	}
	insert(payload: Row | Row[]) {
		this.mode = 'insert';
		this.payload = payload;
		return this;
	}
	upsert(payload: Row | Row[], opts?: { onConflict?: string }) {
		this.mode = 'insert';
		this.payload = payload;
		this.onConflictCols = opts?.onConflict ?? null;
		return this;
	}
	update(payload: Row, opts?: { count?: string }) {
		this.mode = 'update';
		this.payload = payload;
		if (opts?.count) this.wantCount = true;
		return this;
	}
	delete(opts?: { count?: string }) {
		this.mode = 'delete';
		if (opts?.count) this.wantCount = true;
		return this;
	}

	eq(col: string, val: any) {
		this.filters.push({ col, op: '=', val });
		return this;
	}
	neq(col: string, val: any) {
		this.filters.push({ col, op: '<>', val });
		return this;
	}
	gt(col: string, val: any) {
		this.filters.push({ col, op: '>', val });
		return this;
	}
	gte(col: string, val: any) {
		this.filters.push({ col, op: '>=', val });
		return this;
	}
	lt(col: string, val: any) {
		this.filters.push({ col, op: '<', val });
		return this;
	}
	lte(col: string, val: any) {
		this.filters.push({ col, op: '<=', val });
		return this;
	}
	like(col: string, val: any) {
		this.filters.push({ col, op: 'like', val });
		return this;
	}
	ilike(col: string, val: any) {
		this.filters.push({ col, op: 'ilike', val });
		return this;
	}
	is(col: string, val: null | boolean) {
		this.filters.push({ col, op: 'is', val });
		return this;
	}
	in(col: string, vals: any[]) {
		this.filters.push({ col, op: 'in', val: vals });
		return this;
	}
	or(expr: string) {
		this.orGroups.push(expr);
		return this;
	}
	order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
		this.orderBy.push({
			col,
			asc: opts?.ascending !== false,
			nulls: opts?.nullsFirst === undefined ? undefined : opts.nullsFirst ? 'first' : 'last'
		});
		return this;
	}
	limit(n: number) {
		this.limitN = n;
		return this;
	}
	range(from: number, to: number) {
		this.rangeFromTo = [from, to];
		return this;
	}
	maybeSingle() {
		this.singleMode = 'maybe';
		return this;
	}
	single() {
		this.singleMode = 'one';
		return this;
	}

	// --- construccion del WHERE ---
	private buildWhere(params: any[]): string {
		const parts: string[] = [];
		for (const f of this.filters) {
			// Los filtros "tabla.col" son sobre un recurso incrustado (PostgREST):
			// no van al WHERE principal, sino dentro del subselect del embed.
			if (f.col.includes('.')) continue;
			if (f.op === 'is') {
				parts.push(`${f.col} is ${f.val === null ? 'null' : f.val ? 'true' : 'false'}`);
			} else if (f.op === 'in') {
				params.push(f.val);
				parts.push(`${f.col} = any($${params.length})`);
			} else if (f.op === 'like' || f.op === 'ilike') {
				params.push(f.val);
				parts.push(`${f.col} ${f.op} $${params.length}`);
			} else {
				params.push(f.val);
				parts.push(`${f.col} ${f.op} $${params.length}`);
			}
		}
		for (const g of this.orGroups) parts.push('(' + this.parseOr(g, params) + ')');
		return parts.length ? 'where ' + parts.join(' and ') : '';
	}
	// Parsea la sintaxis PostgREST de `.or('col.op.val,col2.is.null')`.
	private parseOr(expr: string, params: any[]): string {
		return splitTop(expr)
			.map((cond) => {
				const i1 = cond.indexOf('.');
				const i2 = cond.indexOf('.', i1 + 1);
				const col = cond.slice(0, i1);
				const op = cond.slice(i1 + 1, i2);
				const raw = cond.slice(i2 + 1);
				if (op === 'is') return `${col} is ${raw === 'null' ? 'null' : raw}`;
				const map: Record<string, string> = {
					eq: '=',
					neq: '<>',
					gt: '>',
					gte: '>=',
					lt: '<',
					lte: '<=',
					like: 'like',
					ilike: 'ilike'
				};
				const sqlop = map[op] ?? '=';
				params.push(raw);
				return `${col} ${sqlop} $${params.length}`;
			})
			.join(' or ');
	}

	// --- SELECT con embeds (recursos incrustados estilo PostgREST), recursivo ---
	private async buildSelectCols(params: any[]): Promise<string> {
		if (this.selectStr.trim() === '*' || !this.selectStr.includes('(')) return this.selectStr;
		const rels = await (relMapP ||= loadRels());
		return embedCols(rels, this.table, this.table, this.selectStr, { n: 0 }, this.filters, params);
	}

	private async run(): Promise<Result<T>> {
		return withUser(this.uid, async (c) => {
			const params: any[] = [];
			let sql = '';
			if (this.mode === 'select') {
				const cols = await this.buildSelectCols(params);
				sql = `select ${cols} from ${this.table} ${this.buildWhere(params)}`;
				if (this.orderBy.length)
					sql +=
						' order by ' +
						this.orderBy
							.map((o) => `${o.col} ${o.asc ? 'asc' : 'desc'}${o.nulls ? ' nulls ' + o.nulls : ''}`)
							.join(', ');
				if (this.rangeFromTo) {
					sql += ` limit ${this.rangeFromTo[1] - this.rangeFromTo[0] + 1} offset ${this.rangeFromTo[0]}`;
				} else if (this.limitN != null) sql += ` limit ${this.limitN}`;
			} else if (this.mode === 'insert') {
				const rowsArr = Array.isArray(this.payload) ? this.payload : [this.payload!];
				const keys = Object.keys(rowsArr[0] ?? {});
				const valuesSql = rowsArr
					.map(
						(r) =>
							'(' +
							keys
								.map((k) => {
									params.push(r[k]);
									return `$${params.length}`;
								})
								.join(', ') +
							')'
					)
					.join(', ');
				sql = `insert into ${this.table} (${keys.join(', ')}) values ${valuesSql}`;
				if (this.onConflictCols) sql += ` on conflict (${this.onConflictCols}) do nothing`;
				if (this.returning) sql += ` returning ${this.selectStr === '*' ? '*' : this.selectStr}`;
			} else if (this.mode === 'update') {
				const keys = Object.keys(this.payload as Row);
				const sets = keys
					.map((k) => {
						params.push((this.payload as Row)[k]);
						return `${k} = $${params.length}`;
					})
					.join(', ');
				sql = `update ${this.table} set ${sets} ${this.buildWhere(params)}`;
				if (this.returning) sql += ` returning ${this.selectStr === '*' ? '*' : this.selectStr}`;
			} else {
				sql = `delete from ${this.table} ${this.buildWhere(params)}`;
				if (this.returning) sql += ` returning ${this.selectStr === '*' ? '*' : this.selectStr}`;
			}
			const res = await c.query(sql, params);
			let data: any = res.rows;
			if (this.singleMode === 'one') {
				if (res.rows.length !== 1)
					return { data: null, error: { message: `se esperaba 1 fila, hubo ${res.rows.length}` } };
				data = res.rows[0];
			} else if (this.singleMode === 'maybe') {
				data = res.rows[0] ?? null;
			}
			return { data, count: this.wantCount ? res.rowCount : null, error: null };
		}).catch((e: any) => ({ data: null as any, count: null, error: { message: e.message } }));
	}

	then<R1 = Result<T>, R2 = never>(
		onfulfilled?: ((value: Result<T>) => R1 | PromiseLike<R1>) | null,
		onrejected?: ((reason: any) => R2 | PromiseLike<R2>) | null
	): PromiseLike<R1 | R2> {
		return this.run().then(onfulfilled, onrejected);
	}
}

export type DbClient = {
	from: (table: string) => QueryBuilder;
	rpc: (fn: string, args?: Record<string, any>) => Promise<Result>;
};

// Crea un "cliente" para un usuario (uid = UUID o null = anonimo).
export function createDb(uid: string | null): DbClient {
	return {
		from: (table: string) => new QueryBuilder(uid, table),
		rpc: (fn: string, args: Record<string, any> = {}) =>
			withUser(uid, async (c) => {
				const keys = Object.keys(args);
				// Los objetos/arrays (p.ej. p_divisiones) son parametros jsonb: hay que
				// enviarlos como texto JSON y castear a ::jsonb. pg, si no, serializa los
				// arrays como arrays de Postgres ('{...}') y el jsonb falla.
				const params = keys.map((k) => {
					const v = args[k];
					return v !== null && typeof v === 'object' ? JSON.stringify(v) : v;
				});
				const argsSql = keys
					.map((k, i) => {
						const v = args[k];
						const cast = v !== null && typeof v === 'object' ? '::jsonb' : '';
						return `${k} => $${i + 1}${cast}`;
					})
					.join(', ');
				const res = await c.query(`select * from ${fn}(${argsSql})`, params);
				// Funcion escalar (returns uuid/bool/numeric): UNA fila con UNA
				// columna -> supabase entrega el valor directo. Cualquier otra cosa
				// (funciones table/setof, p.ej. los balances) -> array de filas,
				// aunque tenga una sola fila (la app las itera).
				if (res.rows.length === 1 && Object.keys(res.rows[0]).length === 1) {
					return { data: Object.values(res.rows[0])[0], error: null };
				}
				return { data: res.rows, error: null };
			}).catch((e: any) => ({ data: null, error: { message: e.message } }))
	};
}
