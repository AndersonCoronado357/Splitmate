import type { SupabaseClient } from '@supabase/supabase-js';

export type Categoria = {
	id: string;
	nombre: string;
	icono: string | null;
	hogarId: string | null;
	orden: number;
};

// Categorías visibles: predefinidas (hogar_id null) + propias del hogar.
export async function listarCategorias(
	supabase: SupabaseClient,
	hogarId: string
): Promise<Categoria[]> {
	const { data } = await supabase
		.from('categorias')
		.select('id, nombre, icono, hogar_id, orden')
		.or(`hogar_id.is.null,hogar_id.eq.${hogarId}`)
		.order('orden', { ascending: true })
		.order('nombre', { ascending: true });

	type Fila = {
		id: string;
		nombre: string;
		icono: string | null;
		hogar_id: string | null;
		orden: number;
	};
	return ((data ?? []) as Fila[]).map((c) => ({
		id: c.id,
		nombre: c.nombre,
		icono: c.icono,
		hogarId: c.hogar_id,
		orden: c.orden
	}));
}

export type GastoListado = {
	id: string;
	titulo: string;
	monto: number;
	fecha: string;
	pagadorId: string;
	pagadorNombre: string;
	pagadorAvatar: string | null;
	categoria: { nombre: string; icono: string | null } | null;
	miParte: number; // 0 si no participo
	esMio: boolean; // soy el pagador
	// Strings ya formateados en el servidor para evitar que el cliente
	// vuelva a correr `Intl` al hidratar (lo que dispara re-render en toda
	// la lista = parpadeo). Server y cliente reciben EL MISMO string.
	montoTexto: string;
	miParteTexto: string;
	fechaTexto: string;
};

// Formateadores estables del lado servidor. Se crean UNA vez por proceso y se
// reutilizan, así nunca varían entre llamadas.
function fmtMonedaFactory(moneda: string) {
	return new Intl.NumberFormat('es-CO', {
		style: 'currency',
		currency: moneda,
		maximumFractionDigits: 0
	});
}
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fmtFechaCorta(iso: string) {
	const [, m, d] = iso.split('-');
	return `${parseInt(d, 10)} ${MESES[parseInt(m, 10) - 1]}`;
}

// Listado del hogar, ordenado de más reciente a más antiguo, con la parte que
// me toca a mí y los datos del pagador. Los perfiles (display_name/avatar) salen
// del mapa que ya cargó el layout. La "mi parte" llega como sub-recurso embebido
// en el MISMO query (PostgREST LEFT JOIN + filtro `gasto_divisiones.participante_id
// = miId`). Resultado: 1 sola vuelta de red.
export async function listarGastos(
	supabase: SupabaseClient,
	hogarId: string,
	miId: string,
	perfiles: Map<string, PerfilMin>,
	moneda: string
): Promise<GastoListado[]> {
	const { data: gastos } = await supabase
		.from('gastos_compartidos')
		.select(
			`id, titulo, monto, fecha, pagador_id, categoria_id, created_at,
			 categorias (nombre, icono),
			 gasto_divisiones (monto)`
		)
		.eq('hogar_id', hogarId)
		.eq('gasto_divisiones.participante_id', miId)
		.order('fecha', { ascending: false })
		.order('created_at', { ascending: false });

	if (!gastos || gastos.length === 0) return [];

	const fmtMoneda = fmtMonedaFactory(moneda);

	return gastos.map((g) => {
		const cat = Array.isArray(g.categorias) ? g.categorias[0] : g.categorias;
		const perfil = perfiles.get(g.pagador_id as string);
		const misDivs = (g.gasto_divisiones ?? []) as Array<{ monto: number }>;
		const miParte = misDivs.length > 0 ? Number(misDivs[0].monto) : 0;
		const monto = Number(g.monto);
		return {
			id: g.id as string,
			titulo: g.titulo as string,
			monto,
			fecha: g.fecha as string,
			pagadorId: g.pagador_id as string,
			pagadorNombre: perfil?.display_name || 'Sin nombre',
			pagadorAvatar: perfil?.avatar_url || null,
			categoria: cat ? { nombre: cat.nombre as string, icono: cat.icono as string | null } : null,
			miParte,
			esMio: (g.pagador_id as string) === miId,
			montoTexto: fmtMoneda.format(monto),
			miParteTexto: miParte > 0 ? fmtMoneda.format(miParte) : '',
			fechaTexto: fmtFechaCorta(g.fecha as string)
		};
	});
}

export type ModoDivision = 'iguales' | 'porcentaje' | 'exacto' | 'partes';

export type Aporte = {
	id: string;
	divisionId: string;
	monto: number;
	fecha: string;
	registradoPorId: string;
	registradoPorNombre: string;
	nota: string | null;
	createdAt: string;
};

export type GastoDetalle = {
	id: string;
	hogarId: string;
	pagadorId: string;
	pagadorNombre: string;
	pagadorAvatar: string | null;
	categoriaId: string | null;
	categoria: { nombre: string; icono: string | null } | null;
	titulo: string;
	monto: number;
	fecha: string;
	modo: ModoDivision;
	notas: string | null;
	divisiones: Array<{
		id: string;
		participanteId: string;
		nombre: string;
		avatar: string | null;
		monto: number;
		pagado: number; // suma de aportes para esta división
		aportes: Aporte[];
	}>;
};

// Perfiles que necesita cargarGasto. El layout ya carga miembros del hogar →
// pasamos ese mapa y nos ahorramos la query de profiles aquí.
export type PerfilMin = { display_name: string; avatar_url: string | null };

export async function cargarGasto(
	supabase: SupabaseClient,
	gastoId: string,
	perfiles: Map<string, PerfilMin>
): Promise<GastoDetalle | null> {
	// UNA sola query: gasto + categoría + divisiones + aportes anidados via PostgREST
	// (LEFT JOIN del lado del servidor). Los perfiles ya vienen del layout, así
	// que no hace falta tocar `profiles`. Total: 1 sola vuelta de red.
	const { data: g } = await supabase
		.from('gastos_compartidos')
		.select(
			`id, hogar_id, pagador_id, categoria_id, titulo, monto, fecha, modo, notas,
			 categorias (nombre, icono),
			 gasto_divisiones (
			   id, participante_id, monto,
			   aportes (id, monto, fecha, registrado_por, nota, created_at)
			 )`
		)
		.eq('id', gastoId)
		.maybeSingle();
	if (!g) return null;

	type AporteRow = {
		id: string;
		monto: number;
		fecha: string;
		registrado_por: string;
		nota: string | null;
		created_at: string;
	};
	type DivRow = {
		id: string;
		participante_id: string;
		monto: number;
		aportes: AporteRow[] | null;
	};

	const divFilas = (g.gasto_divisiones ?? []) as DivRow[];
	const cat = Array.isArray(g.categorias) ? g.categorias[0] : g.categorias;
	const pagador = perfiles.get(g.pagador_id as string);

	return {
		id: g.id as string,
		hogarId: g.hogar_id as string,
		pagadorId: g.pagador_id as string,
		pagadorNombre: pagador?.display_name || 'Sin nombre',
		pagadorAvatar: pagador?.avatar_url || null,
		categoriaId: g.categoria_id as string | null,
		categoria: cat ? { nombre: cat.nombre as string, icono: cat.icono as string | null } : null,
		titulo: g.titulo as string,
		monto: Number(g.monto),
		fecha: g.fecha as string,
		modo: g.modo as ModoDivision,
		notas: g.notas as string | null,
		divisiones: divFilas.map((d) => {
			const p = perfiles.get(d.participante_id);
			// Aportes pueden venir desordenados; ordeno por created_at asc para el
			// historial cronológico.
			const ap = (d.aportes ?? [])
				.slice()
				.sort((a, b) => a.created_at.localeCompare(b.created_at));
			return {
				id: d.id,
				participanteId: d.participante_id,
				nombre: p?.display_name || 'Sin nombre',
				avatar: p?.avatar_url || null,
				monto: Number(d.monto),
				pagado: ap.reduce((acc, x) => acc + Number(x.monto), 0),
				aportes: ap.map((a) => ({
					id: a.id,
					divisionId: d.id,
					monto: Number(a.monto),
					fecha: a.fecha,
					registradoPorId: a.registrado_por,
					registradoPorNombre:
						perfiles.get(a.registrado_por)?.display_name || 'Sin nombre',
					nota: a.nota,
					createdAt: a.created_at
				}))
			};
		})
	};
}
