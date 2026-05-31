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
	miPendiente: number; // lo que aún debo (aportes confirmados ya descuentan)
	miPorConfirmar: number; // aportes míos pendientes de confirmación
	esMio: boolean; // soy el pagador
	// Strings ya formateados en el servidor para evitar que el cliente
	// vuelva a correr `Intl` al hidratar (lo que dispara re-render en toda
	// la lista = parpadeo). Server y cliente reciben EL MISMO string.
	montoTexto: string;
	miParteTexto: string;
	miPendienteTexto: string;
	miPorConfirmarTexto: string;
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
			 gasto_divisiones (monto, aportes (monto, estado))`
		)
		.eq('hogar_id', hogarId)
		.eq('gasto_divisiones.participante_id', miId)
		.order('fecha', { ascending: false })
		.order('created_at', { ascending: false });

	if (!gastos || gastos.length === 0) return [];

	const fmtMoneda = fmtMonedaFactory(moneda);

	type DivRow = {
		monto: number;
		aportes: Array<{ monto: number; estado: EstadoAporte }> | null;
	};

	return gastos.map((g) => {
		const cat = Array.isArray(g.categorias) ? g.categorias[0] : g.categorias;
		const perfil = perfiles.get(g.pagador_id as string);
		const misDivs = (g.gasto_divisiones ?? []) as DivRow[];
		const miParte = misDivs.length > 0 ? Number(misDivs[0].monto) : 0;
		const esMio = (g.pagador_id as string) === miId;
		// Cuando yo creé el gasto, mi propia parte queda saldada al instante
		// (pagué el total al armarlo). En cualquier otro caso:
		//   * miPendiente = lo que aún me falta abonar (mis aportes pendientes
		//     + confirmados ya descuentan, asimétrico).
		//   * miPorConfirmar = suma de mis aportes pendientes (lo que ya
		//     mandé pero el pagador aún no confirmó).
		let miPendiente = 0;
		let miPorConfirmar = 0;
		if (miParte > 0 && !esMio) {
			const aportes = misDivs[0].aportes ?? [];
			const activos = aportes.filter((a) => a.estado !== 'rechazado');
			const sumaActivos = activos.reduce((acc, a) => acc + Number(a.monto), 0);
			miPendiente = Math.max(0, miParte - sumaActivos);
			miPorConfirmar = aportes
				.filter((a) => a.estado === 'pendiente')
				.reduce((acc, a) => acc + Number(a.monto), 0);
		}
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
			miPendiente,
			miPorConfirmar,
			esMio,
			montoTexto: fmtMoneda.format(monto),
			miParteTexto: miParte > 0 ? fmtMoneda.format(miParte) : '',
			miPendienteTexto: miPendiente > 0 ? fmtMoneda.format(miPendiente) : '',
			miPorConfirmarTexto: miPorConfirmar > 0 ? fmtMoneda.format(miPorConfirmar) : '',
			fechaTexto: fmtFechaCorta(g.fecha as string)
		};
	});
}

// Desglose por persona de las deudas pendientes contra y a favor mío,
// gasto por gasto. Se usa en la home para mostrar bajo "Le debes $X" la lista
// de gastos involucrados (renglón compacto, solo títulos).
export type GastoEnDeuda = {
	divisionId: string;
	gastoId: string;
	titulo: string;
	fecha: string;
	fechaTexto: string;
	pendiente: number;
	pendienteTexto: string;
	// Cuántos aportes míos están esperando confirmación del cobrador.
	pendienteConfirmacion: number;
	pendienteConfirmacionTexto: string;
};

export async function listarGastosPorPersona(
	supabase: SupabaseClient,
	hogarId: string,
	miId: string,
	moneda: string
): Promise<Map<string, { leDebo: GastoEnDeuda[]; meDebe: GastoEnDeuda[] }>> {
	const fmt = fmtMonedaFactory(moneda);

	const { data } = await supabase
		.from('gastos_compartidos')
		.select(
			`id, titulo, fecha, pagador_id,
			 gasto_divisiones (id, participante_id, monto, aportes (monto, estado))`
		)
		.eq('hogar_id', hogarId)
		.order('fecha', { ascending: false })
		.order('created_at', { ascending: false });

	type AporteRow = { monto: number; estado: EstadoAporte };
	type DivRow = {
		id: string;
		participante_id: string;
		monto: number;
		aportes: AporteRow[] | null;
	};
	type GastoRow = {
		id: string;
		titulo: string;
		fecha: string;
		pagador_id: string;
		gasto_divisiones: DivRow[] | null;
	};

	const mapa = new Map<string, { leDebo: GastoEnDeuda[]; meDebe: GastoEnDeuda[] }>();
	const asegurar = (otroId: string) => {
		let r = mapa.get(otroId);
		if (!r) {
			r = { leDebo: [], meDebe: [] };
			mapa.set(otroId, r);
		}
		return r;
	};

	for (const g of (data ?? []) as unknown as GastoRow[]) {
		const fechaTexto = fmtFechaCorta(g.fecha);
		for (const d of g.gasto_divisiones ?? []) {
			const monto = Number(d.monto);
			const aportes = d.aportes ?? [];
			const sumPorEstado = (estados: Array<AporteRow['estado']>) =>
				aportes
					.filter((a) => estados.includes(a.estado))
					.reduce((acc, a) => acc + Number(a.monto), 0);
			const confirmado = sumPorEstado(['confirmado']);
			const pendienteEnAportes = sumPorEstado(['pendiente']);

			// Yo participo y le debo al pagador del gasto. Mi vista descuenta
			// pendientes + confirmados (semántica asimétrica). La fila sigue
			// apareciendo si tengo pendientes esperando confirmación, aunque
			// el monto "neto a mi vista" sea 0 — para mostrar el estado.
			if (d.participante_id === miId && g.pagador_id !== miId) {
				const pendiente = Math.max(0, monto - confirmado - pendienteEnAportes);
				if (pendiente <= 0.01 && pendienteEnAportes <= 0.01) continue;
				asegurar(g.pagador_id).leDebo.push({
					divisionId: d.id,
					gastoId: g.id,
					titulo: g.titulo,
					fecha: g.fecha,
					fechaTexto,
					pendiente,
					pendienteTexto: fmt.format(pendiente),
					pendienteConfirmacion: pendienteEnAportes,
					pendienteConfirmacionTexto:
						pendienteEnAportes > 0 ? fmt.format(pendienteEnAportes) : ''
				});
				continue;
			}
			// Yo soy pagador del gasto y otro participa: me debe. Solo
			// descuento aportes confirmados (los pendientes son promesas).
			if (g.pagador_id === miId && d.participante_id !== miId) {
				const pendiente = Math.max(0, monto - confirmado);
				if (pendiente <= 0.01) continue;
				asegurar(d.participante_id).meDebe.push({
					divisionId: d.id,
					gastoId: g.id,
					titulo: g.titulo,
					fecha: g.fecha,
					fechaTexto,
					pendiente,
					pendienteTexto: fmt.format(pendiente),
					pendienteConfirmacion: pendienteEnAportes,
					pendienteConfirmacionTexto:
						pendienteEnAportes > 0 ? fmt.format(pendienteEnAportes) : ''
				});
			}
		}
	}

	return mapa;
}

export type ModoDivision = 'iguales' | 'porcentaje' | 'exacto' | 'partes';

export type EstadoAporte = 'pendiente' | 'confirmado' | 'rechazado';

export type Aporte = {
	id: string;
	divisionId: string;
	monto: number;
	fecha: string;
	registradoPorId: string;
	registradoPorNombre: string;
	nota: string | null;
	estado: EstadoAporte;
	confirmadoAt: string | null;
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
		// Suma de aportes confirmados (cobrados de verdad).
		pagadoConfirmado: number;
		// Suma de aportes pendientes (lo que el deudor dice haber pagado
		// pero el pagador todavía no confirma).
		pagadoPendiente: number;
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
			   aportes (id, monto, fecha, registrado_por, nota, estado, confirmado_at, created_at)
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
		estado: EstadoAporte;
		confirmado_at: string | null;
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
			// historial cronológico. Los rechazados desaparecen del historial.
			const ap = (d.aportes ?? [])
				.filter((a) => a.estado !== 'rechazado')
				.slice()
				.sort((a, b) => a.created_at.localeCompare(b.created_at));
			const pagadoConfirmado = ap
				.filter((a) => a.estado === 'confirmado')
				.reduce((acc, x) => acc + Number(x.monto), 0);
			const pagadoPendiente = ap
				.filter((a) => a.estado === 'pendiente')
				.reduce((acc, x) => acc + Number(x.monto), 0);
			return {
				id: d.id,
				participanteId: d.participante_id,
				nombre: p?.display_name || 'Sin nombre',
				avatar: p?.avatar_url || null,
				monto: Number(d.monto),
				pagadoConfirmado,
				pagadoPendiente,
				aportes: ap.map((a) => ({
					id: a.id,
					divisionId: d.id,
					monto: Number(a.monto),
					fecha: a.fecha,
					registradoPorId: a.registrado_por,
					registradoPorNombre:
						perfiles.get(a.registrado_por)?.display_name || 'Sin nombre',
					nota: a.nota,
					estado: a.estado,
					confirmadoAt: a.confirmado_at,
					createdAt: a.created_at
				}))
			};
		})
	};
}
