import type { SupabaseClient } from '@supabase/supabase-js';
import type { PerfilMin } from './gastos';

// Vista de un pago, ya con los nombres/avatares del pagador y receptor
// resueltos desde el mapa de miembros (sin pegarle de nuevo a `profiles`).
export type PagoVista = {
	id: string;
	hogarId: string;
	pagadorId: string;
	pagadorNombre: string;
	pagadorAvatar: string | null;
	receptorId: string;
	receptorNombre: string;
	receptorAvatar: string | null;
	monto: number;
	montoTexto: string;
	fecha: string;
	fechaTexto: string;
	nota: string | null;
	estado: 'pendiente' | 'confirmado' | 'rechazado';
	registradoPorId: string;
	createdAt: string;
	confirmadoAt: string | null;
};

// Nombres completos en español (evita confusión con inglés en `may`).
const MESES = [
	'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
	'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];
function fmtFecha(iso: string) {
	const [, m, d] = iso.split('-');
	return `${parseInt(d, 10)} ${MESES[parseInt(m, 10) - 1]}`;
}

function montoFmt(n: number, moneda: string) {
	return new Intl.NumberFormat('es-CO', {
		style: 'currency',
		currency: moneda,
		maximumFractionDigits: 0
	}).format(n);
}

// Devuelve todos los pagos del hogar (cualquier estado), de más reciente a
// más viejo. Los nombres/avatares vienen del mapa de miembros del layout.
export async function listarPagos(
	supabase: SupabaseClient,
	hogarId: string,
	perfiles: Map<string, PerfilMin>,
	moneda: string
): Promise<PagoVista[]> {
	// Solo pagos genéricos (sin `prestamo_id`). Las devoluciones asociadas
	// a un préstamo viven en /prestamos y no se mezclan con los pagos
	// libres de saldar deuda — regla del plan: módulos separados.
	const { data } = await supabase
		.from('pagos')
		.select(
			'id, hogar_id, pagador_id, receptor_id, monto, fecha, nota, estado, registrado_por, confirmado_at, created_at'
		)
		.eq('hogar_id', hogarId)
		.is('prestamo_id', null)
		.order('created_at', { ascending: false });

	type Fila = {
		id: string;
		hogar_id: string;
		pagador_id: string;
		receptor_id: string;
		monto: number;
		fecha: string;
		nota: string | null;
		estado: 'pendiente' | 'confirmado' | 'rechazado';
		registrado_por: string;
		confirmado_at: string | null;
		created_at: string;
	};

	return ((data ?? []) as Fila[]).map((p) => {
		const pagador = perfiles.get(p.pagador_id);
		const receptor = perfiles.get(p.receptor_id);
		const monto = Number(p.monto);
		return {
			id: p.id,
			hogarId: p.hogar_id,
			pagadorId: p.pagador_id,
			pagadorNombre: pagador?.display_name || 'Sin nombre',
			pagadorAvatar: pagador?.avatar_url || null,
			receptorId: p.receptor_id,
			receptorNombre: receptor?.display_name || 'Sin nombre',
			receptorAvatar: receptor?.avatar_url || null,
			monto,
			montoTexto: montoFmt(monto, moneda),
			fecha: p.fecha,
			fechaTexto: fmtFecha(p.fecha),
			nota: p.nota,
			estado: p.estado,
			registradoPorId: p.registrado_por,
			createdAt: p.created_at,
			confirmadoAt: p.confirmado_at
		};
	});
}
