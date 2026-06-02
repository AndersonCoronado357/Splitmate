// ============================================================
// Resumen / analíticas — server lib.
//
// Esta capa SOLO trae los movimientos crudos del hogar (gastos
// compartidos, fijos, préstamos, pagos), unificados como
// `MovimientoCrudo`. Todo el filtrado por período y los agregados
// (KPI, por categoría, por persona, por mes) se hacen en el cliente
// — así cambiar un chip de período o el toggle Hogar/Solo mío es
// instantáneo y sin viaje al server.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

export type TipoMov = 'compartido' | 'fijo' | 'prestamo' | 'pago';

export type MovimientoCrudo = {
	id: string;
	tipo: TipoMov;
	titulo: string;
	monto: number; // total del movimiento
	miParte: number; // lo que me toca a mí
	fecha: string; // YYYY-MM-DD
	pagadorId: string | null;
	otraParteId: string | null;
	categoriaNombre: string | null;
	categoriaIcono: string | null;
	url: string;
};

export type PerfilMin = { display_name: string; avatar_url: string | null };

export async function cargarMovimientos(
	supabase: SupabaseClient,
	hogarId: string,
	miId: string
): Promise<MovimientoCrudo[]> {
	const todos: MovimientoCrudo[] = [];

	// 1) Gastos compartidos
	const { data: dCompartidos } = await supabase
		.from('gastos_compartidos')
		.select(
			`id, titulo, monto, fecha, pagador_id,
			 categorias ( nombre, icono ),
			 gasto_divisiones ( participante_id, monto )`
		)
		.eq('hogar_id', hogarId);
	type CompartidoRow = {
		id: string;
		titulo: string;
		monto: number;
		fecha: string;
		pagador_id: string;
		categorias:
			| { nombre: string; icono: string | null }
			| { nombre: string; icono: string | null }[]
			| null;
		gasto_divisiones: Array<{ participante_id: string; monto: number }> | null;
	};
	for (const g of (dCompartidos ?? []) as CompartidoRow[]) {
		const cat = Array.isArray(g.categorias) ? g.categorias[0] : g.categorias;
		const miParte = (g.gasto_divisiones ?? [])
			.filter((d) => d.participante_id === miId)
			.reduce((a, d) => a + Number(d.monto), 0);
		todos.push({
			id: `c-${g.id}`,
			tipo: 'compartido',
			titulo: g.titulo,
			monto: Number(g.monto),
			miParte,
			fecha: g.fecha,
			pagadorId: g.pagador_id,
			otraParteId: null,
			categoriaNombre: cat?.nombre ?? null,
			categoriaIcono: cat?.icono ?? null,
			url: `/gastos/${g.id}`
		});
	}

	// 2) Gastos fijos del mes (instancias materializadas)
	const { data: dFijos } = await supabase
		.from('gastos_fijos_mes')
		.select(
			`id, anio, mes, monto, plantilla_id,
			 gastos_fijos_plantilla ( nombre, categorias ( nombre, icono ) ),
			 gastos_fijos_mes_division ( participante_id, monto )`
		)
		.eq('hogar_id', hogarId);
	type FijoRow = {
		id: string;
		anio: number;
		mes: number;
		monto: number;
		plantilla_id: string;
		gastos_fijos_plantilla:
			| {
					nombre: string;
					categorias:
						| { nombre: string; icono: string | null }
						| { nombre: string; icono: string | null }[]
						| null;
			  }
			| Array<{
					nombre: string;
					categorias:
						| { nombre: string; icono: string | null }
						| { nombre: string; icono: string | null }[]
						| null;
			  }>
			| null;
		gastos_fijos_mes_division: Array<{ participante_id: string; monto: number }> | null;
	};
	for (const f of (dFijos ?? []) as FijoRow[]) {
		const plantilla = Array.isArray(f.gastos_fijos_plantilla)
			? f.gastos_fijos_plantilla[0]
			: f.gastos_fijos_plantilla;
		if (!plantilla) continue;
		const cat = Array.isArray(plantilla.categorias) ? plantilla.categorias[0] : plantilla.categorias;
		const fecha = `${f.anio}-${String(f.mes).padStart(2, '0')}-01`;
		const miParte = (f.gastos_fijos_mes_division ?? [])
			.filter((d) => d.participante_id === miId)
			.reduce((a, d) => a + Number(d.monto), 0);
		todos.push({
			id: `f-${f.id}`,
			tipo: 'fijo',
			titulo: plantilla.nombre,
			monto: Number(f.monto),
			miParte,
			fecha,
			pagadorId: null,
			otraParteId: null,
			categoriaNombre: cat?.nombre ?? null,
			categoriaIcono: cat?.icono ?? null,
			url: `/fijos/${f.plantilla_id}`
		});
	}

	// 3) Préstamos activos o saldados
	const { data: dPrestamos } = await supabase
		.from('prestamos')
		.select('id, motivo, monto, fecha, prestador_id, receptor_id, estado')
		.eq('hogar_id', hogarId)
		.in('estado', ['activo', 'saldado']);
	type PrestamoRow = {
		id: string;
		motivo: string | null;
		monto: number;
		fecha: string;
		prestador_id: string;
		receptor_id: string;
	};
	for (const p of (dPrestamos ?? []) as PrestamoRow[]) {
		const yoPresto = p.prestador_id === miId;
		const otra = yoPresto ? p.receptor_id : p.prestador_id;
		todos.push({
			id: `pr-${p.id}`,
			tipo: 'prestamo',
			titulo: p.motivo || 'Préstamo',
			monto: Number(p.monto),
			miParte: yoPresto ? 0 : Number(p.monto),
			fecha: p.fecha,
			pagadorId: p.prestador_id,
			otraParteId: otra,
			categoriaNombre: null,
			categoriaIcono: null,
			url: `/prestamos/${p.id}`
		});
	}

	// 4) Pagos directos confirmados (no devoluciones de préstamos)
	const { data: dPagos } = await supabase
		.from('pagos')
		.select('id, monto, fecha, pagador_id, receptor_id, nota')
		.eq('hogar_id', hogarId)
		.eq('estado', 'confirmado')
		.is('prestamo_id', null);
	type PagoRow = {
		id: string;
		monto: number;
		fecha: string;
		pagador_id: string;
		receptor_id: string;
		nota: string | null;
	};
	for (const p of (dPagos ?? []) as PagoRow[]) {
		const yoPagué = p.pagador_id === miId;
		const otra = yoPagué ? p.receptor_id : p.pagador_id;
		todos.push({
			id: `pa-${p.id}`,
			tipo: 'pago',
			titulo: p.nota || 'Pago directo',
			monto: Number(p.monto),
			miParte: yoPagué ? Number(p.monto) : 0,
			fecha: p.fecha,
			pagadorId: p.pagador_id,
			otraParteId: otra,
			categoriaNombre: null,
			categoriaIcono: null,
			url: '/'
		});
	}

	return todos;
}
