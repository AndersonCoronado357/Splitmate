import type { SupabaseClient } from '@supabase/supabase-js';

// Un préstamo es una transferencia directa de dinero entre dos miembros del
// hogar (Fase 7). Vive aparte de los gastos compartidos.
// Re-importo los tipos compartidos del módulo cliente (los labels viven
// allá para que la UI los pueda usar sin meter código de servidor).
import type { EstadoPrestamo, TipoPagoPrestamo } from '$lib/prestamos-tipos';
export type { EstadoPrestamo, TipoPagoPrestamo };

export type DevolucionEnPrestamo = {
	id: string;
	monto: number;
	montoTexto: string;
	estado: 'pendiente' | 'confirmado' | 'rechazado';
	fechaTexto: string;
};

// Cuota del plan acordado de devolución.
export type CuotaPrestamo = {
	id: string;
	numero: number;
	monto: number;
	montoTexto: string;
	fechaEsperada: string | null;
	fechaEsperadaTexto: string | null;
};

export type PrestamoListado = {
	id: string;
	hogarId: string;
	prestadorId: string;
	prestadorNombre: string;
	prestadorAvatar: string | null;
	receptorId: string;
	receptorNombre: string;
	receptorAvatar: string | null;
	monto: number;
	montoTexto: string;
	pagado: number; // suma de devoluciones (confirmadas o pendientes del receptor)
	pagadoTexto: string;
	pendiente: number; // lo que aún falta devolver desde la vista neutral
	pendienteTexto: string;
	fecha: string;
	fechaTexto: string;
	fechaEsperada: string | null;
	fechaEsperadaTexto: string | null;
	motivo: string | null;
	tipoPago: TipoPagoPrestamo;
	cuotas: CuotaPrestamo[];
	estado: EstadoPrestamo;
	registradoPorId: string;
	confirmadoAt: string | null;
	createdAt: string;
	// Mi rol respecto al préstamo (calculado para que la UI no tenga que pensar).
	soyPrestador: boolean;
	soyReceptor: boolean;
	// Devoluciones (pagos.prestamo_id = this.id) con su estado, para mostrar
	// la bandeja "te dicen que me devolvieron, falta confirmar".
	devoluciones: DevolucionEnPrestamo[];
};

// Nombres completos en español para que no se confunda con inglés (`may`
// es idéntico en ambos idiomas, "mayo" no).
const MESES = [
	'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
	'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];
function fmtFechaCorta(iso: string) {
	const [, m, d] = iso.split('-');
	return `${parseInt(d, 10)} ${MESES[parseInt(m, 10) - 1]}`;
}
function fmtMonedaFactory(moneda: string) {
	return new Intl.NumberFormat('es-CO', {
		style: 'currency',
		currency: moneda,
		maximumFractionDigits: 0
	});
}

type PerfilMin = { display_name: string; avatar_url: string | null };

// Listado de TODOS los préstamos del hogar (cualquier estado), del más
// reciente al más viejo. Incluye la suma de devoluciones para calcular
// cuánto falta. El balance neteado lo arma `balance_hogar` aparte.
export async function listarPrestamos(
	supabase: SupabaseClient,
	hogarId: string,
	miId: string,
	perfiles: Map<string, PerfilMin>,
	moneda: string
): Promise<PrestamoListado[]> {
	const { data } = await supabase
		.from('prestamos')
		.select(
			`id, hogar_id, prestador_id, receptor_id, monto, fecha, motivo,
			 fecha_esperada, tipo_pago, estado, registrado_por, confirmado_at, created_at,
			 pagos (id, monto, fecha, estado),
			 prestamo_cuotas (id, numero, monto, fecha_esperada)`
		)
		.eq('hogar_id', hogarId)
		.order('created_at', { ascending: false });

	type PagoRow = {
		id: string;
		monto: number;
		fecha: string;
		estado: 'pendiente' | 'confirmado' | 'rechazado';
	};
	type CuotaRow = {
		id: string;
		numero: number;
		monto: number;
		fecha_esperada: string | null;
	};
	type Row = {
		id: string;
		hogar_id: string;
		prestador_id: string;
		receptor_id: string;
		monto: number;
		fecha: string;
		motivo: string | null;
		fecha_esperada: string | null;
		tipo_pago: TipoPagoPrestamo;
		estado: EstadoPrestamo;
		registrado_por: string;
		confirmado_at: string | null;
		created_at: string;
		pagos: PagoRow[] | null;
		prestamo_cuotas: CuotaRow[] | null;
	};

	const fmt = fmtMonedaFactory(moneda);

	return ((data ?? []) as Row[]).map((p) => {
		const prestador = perfiles.get(p.prestador_id);
		const receptor = perfiles.get(p.receptor_id);
		const monto = Number(p.monto);
		// Para la vista global del préstamo, contamos como "pagado" lo
		// confirmado y lo pendiente (mostrar progreso real). El balance neto
		// usa su propia regla asimétrica.
		const pagos = (p.pagos ?? []).filter((x) => x.estado !== 'rechazado');
		const pagado = pagos.reduce((acc, x) => acc + Number(x.monto), 0);
		const pendiente = Math.max(0, monto - pagado);
		const cuotas: CuotaPrestamo[] = (p.prestamo_cuotas ?? [])
			.slice()
			.sort((a, b) => a.numero - b.numero)
			.map((c) => ({
				id: c.id,
				numero: c.numero,
				monto: Number(c.monto),
				montoTexto: fmt.format(Number(c.monto)),
				fechaEsperada: c.fecha_esperada,
				fechaEsperadaTexto: c.fecha_esperada ? fmtFechaCorta(c.fecha_esperada) : null
			}));
		const devoluciones: DevolucionEnPrestamo[] = (p.pagos ?? [])
			.slice()
			.sort((a, b) => b.fecha.localeCompare(a.fecha))
			.map((x) => ({
				id: x.id,
				monto: Number(x.monto),
				montoTexto: fmt.format(Number(x.monto)),
				estado: x.estado,
				fechaTexto: fmtFechaCorta(x.fecha)
			}));
		return {
			id: p.id,
			hogarId: p.hogar_id,
			prestadorId: p.prestador_id,
			prestadorNombre: prestador?.display_name || 'Sin nombre',
			prestadorAvatar: prestador?.avatar_url || null,
			receptorId: p.receptor_id,
			receptorNombre: receptor?.display_name || 'Sin nombre',
			receptorAvatar: receptor?.avatar_url || null,
			monto,
			montoTexto: fmt.format(monto),
			pagado,
			pagadoTexto: fmt.format(pagado),
			pendiente,
			pendienteTexto: fmt.format(pendiente),
			fecha: p.fecha,
			fechaTexto: fmtFechaCorta(p.fecha),
			fechaEsperada: p.fecha_esperada,
			fechaEsperadaTexto: p.fecha_esperada ? fmtFechaCorta(p.fecha_esperada) : null,
			motivo: p.motivo,
			tipoPago: p.tipo_pago,
			cuotas,
			estado: p.estado,
			registradoPorId: p.registrado_por,
			confirmadoAt: p.confirmado_at,
			createdAt: p.created_at,
			soyPrestador: p.prestador_id === miId,
			soyReceptor: p.receptor_id === miId,
			devoluciones
		};
	});
}
