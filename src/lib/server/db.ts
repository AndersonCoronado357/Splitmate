import pg from 'pg';
import { env } from '$env/dynamic/private';

// pg parsea date/timestamp a objetos Date; Supabase (PostgREST) los devolvia
// como STRINGS y la app los trata como strings (.slice, .split, new Date).
// Forzamos string para igualar el comportamiento y no romper el formateo.
pg.types.setTypeParser(1082, (v) => v); // date        -> 'YYYY-MM-DD'
pg.types.setTypeParser(1114, (v) => v); // timestamp
pg.types.setTypeParser(1184, (v) => v); // timestamptz

// La URL de la base la inyecta acmsy al desplegar (DATABASE_URL). En desarrollo
// local sale del .env. $env/dynamic/private la lee en tiempo de ejecucion (dev y
// produccion con adapter-node).
const DATABASE_URL = env.DATABASE_URL;

// Pool unico de conexiones a la base de acmsy (PostgreSQL).
const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 10 });

export type Client = pg.PoolClient;

// Consulta como superusuario (sin RLS). Para autenticacion y tareas
// administrativas que ocurren antes de saber quien es el usuario.
export async function query<T = Record<string, unknown>>(
	text: string,
	params: unknown[] = []
): Promise<T[]> {
	const r = await pool.query(text, params);
	return r.rows as T[];
}

// Ejecuta `fn` dentro de una transaccion con el rol 'authenticated' y el
// usuario actual fijado en app.user_id, de modo que auth.uid() y TODAS las
// politicas RLS aplican igual que en Supabase. `uid` = UUID del usuario
// (o null para anonimo).
export async function withUser<T>(
	uid: string | null,
	fn: (c: Client) => Promise<T>
): Promise<T> {
	const client = await pool.connect();
	try {
		await client.query('begin');
		await client.query('set local role authenticated');
		await client.query("select set_config('app.user_id', $1, true)", [uid ?? '']);
		const out = await fn(client);
		await client.query('commit');
		return out;
	} catch (e) {
		try {
			await client.query('rollback');
		} catch {
			/* noop */
		}
		throw e;
	} finally {
		client.release();
	}
}
