import type { SupabaseClient } from '@supabase/supabase-js';
import type { PerfilMin } from './gastos';

export type ModoFijo = 'iguales' | 'porcentaje' | 'exacto' | 'partes';

export type FijoPlantilla = {
	id: string;
	hogarId: string;
	nombre: string;
	monto: number;
	montoTexto: string;
	modo: ModoFijo;
	categoria: { nombre: string; icono: string | null } | null;
	categoriaId: string | null;
	diaVencimiento: number;
	activa: boolean;
	notas: string | null;
	createdAt: string;
};

export type FijoAporte = {
	id: string;
	monto: number;
	montoTexto: string;
	fecha: string;
	fechaTexto: string;
	nota: string | null;
	registradoPorId: string;
};

export type FijoDivision = {
	id: string;
	participanteId: string;
	participanteNombre: string;
	participanteAvatar: string | null;
	monto: number;
	montoTexto: string;
	pagado: number;
	pagadoTexto: string;
	pendiente: number;
	pendienteTexto: string;
	aportes: FijoAporte[];
};

export type FijoMes = {
	id: string;
	plantillaId: string;
	hogarId: string;
	anio: number;
	mes: number;
	mesTexto: string;
	monto: number;
	montoTexto: string;
	estado: 'abierto' | 'cerrado';
	divisiones: FijoDivision[];
	totalPagado: number;
	totalPagadoTexto: string;
	totalPendiente: number;
	totalPendienteTexto: string;
	avance: { aportaron: number; total: number };
};

export type FijoListado = FijoPlantilla & {
	mesActual: FijoMes | null;
};

const MESES_LARGO = [
	'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
	'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];
const MESES_CORTO = [
	'ene', 'feb', 'mar', 'abr', 'may', 'jun',
	'jul', 'ago', 'sep', 'oct', 'nov', 'dic'
];
function fmtFechaCorta(iso: string) {
	const [, m, d] = iso.split('-');
	return `${parseInt(d, 10)} ${MESES_CORTO[parseInt(m, 10) - 1]}`;
}
function fmtMesNombre(anio: number, mes: number) {
	return `${MESES_LARGO[mes - 1]} ${anio}`;
}
function fmtMonedaFactory(moneda: string) {
	return new Intl.NumberFormat('es-CO', {
		style: 'currency',
		currency: moneda,
		maximumFractionDigits: 0
	});
}

function mesActualHoy(): { anio: number; mes: number } {
	const d = new Date();
	return { anio: d.getFullYear(), mes: d.getMonth() + 1 };
}

// Asegura que exista la instancia del mes para una plantilla activa.
// Llama al RPC `generar_mes_gasto_fijo`, que es idempotente (si ya existe,
// retorna su id sin tocar nada).
async function asegurarMes(
	supabase: SupabaseClient,
	plantillaId: string,
	anio: number,
	mes: number
): Promise<string | null> {
	const { data, error } = await supabase.rpc('generar_mes_gasto_fijo', {
		p_plantilla: plantillaId,
		p_anio: anio,
		p_mes: mes
	});
	if (error) {
		// No es fatal — el cierre de mes puede quedar para el próximo intento.
		console.warn('[fijos] no se pudo generar mes', { plantillaId, anio, mes, error });
		return null;
	}
	return data as string;
}

// Lista las plantillas activas del hogar con su mes en curso. Si el mes
// actual aún no existe para una plantilla activa, lo genera en caliente.
export async function listarGastosFijos(
	supabase: SupabaseClient,
	hogarId: string,
	miembros: Array<{ userId: string; nombre: string; avatar: string | null }>,
	moneda: string
): Promise<FijoListado[]> {
	const fmt = fmtMonedaFactory(moneda);
	const { anio, mes } = mesActualHoy();

	const { data: plantillas } = await supabase
		.from('gastos_fijos_plantilla')
		.select(
			`id, hogar_id, nombre, monto, modo, categoria_id, dia_vencimiento, activa,
			 notas, created_at, categorias (nombre, icono)`
		)
		.eq('hogar_id', hogarId)
		.order('activa', { ascending: false })
		.order('created_at', { ascending: false });

	if (!plantillas) return [];

	type PRow = {
		id: string;
		hogar_id: string;
		nombre: string;
		monto: number;
		modo: ModoFijo;
		categoria_id: string | null;
		dia_vencimiento: number;
		activa: boolean;
		notas: string | null;
		created_at: string;
		categorias: { nombre: string; icono: string | null } | { nombre: string; icono: string | null }[] | null;
	};

	// Para cada plantilla activa: asegurar que exista el mes actual.
	for (const p of plantillas as unknown as PRow[]) {
		if (p.activa) {
			await asegurarMes(supabase, p.id, anio, mes);
		}
	}

	// Traer todos los meses-actuales en una sola consulta.
	const ids = (plantillas as unknown as PRow[]).map((p) => p.id);
	const { data: meses } = await supabase
		.from('gastos_fijos_mes')
		.select(
			`id, plantilla_id, hogar_id, anio, mes, monto, estado,
			 gastos_fijos_mes_division (
				id, participante_id, monto,
				gastos_fijos_aportes (id, monto, fecha, nota, registrado_por, created_at)
			 )`
		)
		.in('plantilla_id', ids)
		.eq('anio', anio)
		.eq('mes', mes);

	type DivRow = {
		id: string;
		participante_id: string;
		monto: number;
		gastos_fijos_aportes:
			| Array<{ id: string; monto: number; fecha: string; nota: string | null; registrado_por: string; created_at: string }>
			| null;
	};
	type MRow = {
		id: string;
		plantilla_id: string;
		hogar_id: string;
		anio: number;
		mes: number;
		monto: number;
		estado: 'abierto' | 'cerrado';
		gastos_fijos_mes_division: DivRow[] | null;
	};

	const mesPorPlantilla = new Map<string, MRow>();
	for (const m of (meses ?? []) as MRow[]) {
		mesPorPlantilla.set(m.plantilla_id, m);
	}

	return (plantillas as unknown as PRow[]).map((p) => {
		const cat = Array.isArray(p.categorias) ? p.categorias[0] : p.categorias;
		const m = mesPorPlantilla.get(p.id);
		const mesActual: FijoMes | null = m
			? armarMes(m, miembros, fmt)
			: null;
		return {
			id: p.id,
			hogarId: p.hogar_id,
			nombre: p.nombre,
			monto: Number(p.monto),
			montoTexto: fmt.format(Number(p.monto)),
			modo: p.modo,
			categoriaId: p.categoria_id,
			categoria: cat ? { nombre: cat.nombre, icono: cat.icono } : null,
			diaVencimiento: p.dia_vencimiento,
			activa: p.activa,
			notas: p.notas,
			createdAt: p.created_at,
			mesActual
		};
	});
}

function armarMes(
	m: {
		id: string;
		plantilla_id: string;
		hogar_id: string;
		anio: number;
		mes: number;
		monto: number;
		estado: 'abierto' | 'cerrado';
		gastos_fijos_mes_division:
			| Array<{
					id: string;
					participante_id: string;
					monto: number;
					gastos_fijos_aportes:
						| Array<{
								id: string;
								monto: number;
								fecha: string;
								nota: string | null;
								registrado_por: string;
								created_at: string;
						  }>
						| null;
			  }>
			| null;
	},
	miembros: Array<{ userId: string; nombre: string; avatar: string | null }>,
	fmt: Intl.NumberFormat
): FijoMes {
	const divisiones: FijoDivision[] = (m.gastos_fijos_mes_division ?? []).map((d) => {
		const perfil = miembros.find((mm) => mm.userId === d.participante_id);
		const aportes = (d.gastos_fijos_aportes ?? [])
			.slice()
			.sort((a, b) => a.created_at.localeCompare(b.created_at));
		const pagado = aportes.reduce((acc, a) => acc + Number(a.monto), 0);
		const monto = Number(d.monto);
		const pendiente = Math.max(0, monto - pagado);
		return {
			id: d.id,
			participanteId: d.participante_id,
			participanteNombre: perfil?.nombre ?? 'Sin nombre',
			participanteAvatar: perfil?.avatar ?? null,
			monto,
			montoTexto: fmt.format(monto),
			pagado,
			pagadoTexto: fmt.format(pagado),
			pendiente,
			pendienteTexto: fmt.format(pendiente),
			aportes: aportes.map((a) => ({
				id: a.id,
				monto: Number(a.monto),
				montoTexto: fmt.format(Number(a.monto)),
				fecha: a.fecha,
				fechaTexto: fmtFechaCorta(a.fecha),
				nota: a.nota,
				registradoPorId: a.registrado_por
			}))
		};
	});
	const totalPagado = divisiones.reduce((acc, d) => acc + d.pagado, 0);
	const totalPendiente = divisiones.reduce((acc, d) => acc + d.pendiente, 0);
	const aportaron = divisiones.filter((d) => d.pendiente <= 0.01).length;
	return {
		id: m.id,
		plantillaId: m.plantilla_id,
		hogarId: m.hogar_id,
		anio: m.anio,
		mes: m.mes,
		mesTexto: fmtMesNombre(m.anio, m.mes),
		monto: Number(m.monto),
		montoTexto: fmt.format(Number(m.monto)),
		estado: m.estado,
		divisiones,
		totalPagado,
		totalPagadoTexto: fmt.format(totalPagado),
		totalPendiente,
		totalPendienteTexto: fmt.format(totalPendiente),
		avance: { aportaron, total: divisiones.length }
	};
}

// Detalle de una plantilla con su mes actual + meses pasados.
export async function cargarFijo(
	supabase: SupabaseClient,
	plantillaId: string,
	miembros: Array<{ userId: string; nombre: string; avatar: string | null }>,
	moneda: string
): Promise<{ plantilla: FijoPlantilla; meses: FijoMes[] } | null> {
	const fmt = fmtMonedaFactory(moneda);

	const { data: p } = await supabase
		.from('gastos_fijos_plantilla')
		.select(
			`id, hogar_id, nombre, monto, modo, categoria_id, dia_vencimiento, activa,
			 notas, created_at, categorias (nombre, icono)`
		)
		.eq('id', plantillaId)
		.maybeSingle();
	if (!p) return null;

	// Asegurar mes actual si activa.
	if (p.activa) {
		const { anio, mes } = mesActualHoy();
		await asegurarMes(supabase, plantillaId, anio, mes);
	}

	const { data: meses } = await supabase
		.from('gastos_fijos_mes')
		.select(
			`id, plantilla_id, hogar_id, anio, mes, monto, estado,
			 gastos_fijos_mes_division (
				id, participante_id, monto,
				gastos_fijos_aportes (id, monto, fecha, nota, registrado_por, created_at)
			 )`
		)
		.eq('plantilla_id', plantillaId)
		.order('anio', { ascending: false })
		.order('mes', { ascending: false });

	const cat = Array.isArray(p.categorias) ? p.categorias[0] : p.categorias;
	const plantilla: FijoPlantilla = {
		id: p.id as string,
		hogarId: p.hogar_id as string,
		nombre: p.nombre as string,
		monto: Number(p.monto),
		montoTexto: fmt.format(Number(p.monto)),
		modo: p.modo as ModoFijo,
		categoriaId: p.categoria_id as string | null,
		categoria: cat ? { nombre: cat.nombre as string, icono: cat.icono as string | null } : null,
		diaVencimiento: p.dia_vencimiento as number,
		activa: p.activa as boolean,
		notas: p.notas as string | null,
		createdAt: p.created_at as string
	};

	type MRow = Parameters<typeof armarMes>[0];
	return {
		plantilla,
		meses: ((meses ?? []) as unknown as MRow[]).map((m) => armarMes(m, miembros, fmt))
	};
}

// Distribución guardada en la plantilla (para el editor / detalle).
export type FijoDivisionPlantilla = {
	id: string;
	participanteId: string;
	participanteNombre: string;
	valor: number;
};

export async function cargarDivisionesPlantilla(
	supabase: SupabaseClient,
	plantillaId: string,
	miembros: Array<{ userId: string; nombre: string }>
): Promise<FijoDivisionPlantilla[]> {
	const { data } = await supabase
		.from('gastos_fijos_plantilla_division')
		.select('id, participante_id, valor')
		.eq('plantilla_id', plantillaId);
	return ((data ?? []) as Array<{ id: string; participante_id: string; valor: number }>).map(
		(d) => ({
			id: d.id,
			participanteId: d.participante_id,
			participanteNombre:
				miembros.find((m) => m.userId === d.participante_id)?.nombre ?? 'Sin nombre',
			valor: Number(d.valor)
		})
	);
}
