// ============================================================
// Saldar — vista pareja por pareja desde la perspectiva del usuario.
//
// Por cada otra persona del hogar con saldo no cero:
//   - Saldo NETO (a favor del usuario o en contra).
//   - DESGLOSE: cada gasto y préstamo que compone ese neto, con monto
//     pendiente y dirección.
//   - Si hay un pago pendiente entre ambos, se referencia para que la
//     UI ofrezca confirmar / rechazar / cancelar.
//
// La idea es que al ver una fila de "Anderson · +$282" el usuario
// pueda expandir el detalle y ver:
//   + $27.778 · "Prueba de noti"  (gasto compartido)
//   + $22.500 · "Prueba"          (gasto compartido)
//   + $4      · "czcxzxczxczx"    (gasto compartido)
//   − $50.000 · "Dame mi plata"   (préstamo activo)
//   ─ Neto: + $282 ─
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

export type DetalleItem = {
	tipo: 'gasto' | 'prestamo';
	id: string;
	titulo: string;
	monto: number; // |valor|, ya formateado en `montoTexto`
	montoTexto: string;
	contribucion: 'a_favor' | 'en_contra'; // a_favor = suma al saldo del usuario
	url: string;
};

export type SaldoConPersona = {
	userId: string;
	nombre: string;
	avatar: string | null;
	saldo: number; // > 0: te debe; < 0: le debes
	saldoTexto: string;
	es: 'a_favor' | 'en_contra';
	gastosCount: number;
	prestamosActivos: number;
	detalles: DetalleItem[];
	pagoPendienteId: string | null;
	pagoPendienteEsMio: boolean;
};

export type CadenaSugerida = {
	id: string;
	acreedor: { userId: string; nombre: string; avatar: string | null };
	deudor: { userId: string; nombre: string; avatar: string | null };
	monto: number;
	montoTexto: string;
};

export type Saldos = {
	personas: SaldoConPersona[];
	cadenas: CadenaSugerida[]; // cuando soy creditor de X y debo a Y, X puede pagarle a Y directo
	yaEnCero: boolean;
};

type Miembro = { userId: string; nombre: string; avatar: string | null };

export async function cargarSaldos(
	supabase: SupabaseClient,
	hogarId: string,
	miId: string,
	miembros: Miembro[],
	moneda: string
): Promise<Saldos> {
	const fmt = new Intl.NumberFormat('es-CO', {
		style: 'currency',
		currency: moneda,
		maximumFractionDigits: 0
	});

	// Saldos netos con cada otro miembro (RPC existente, ya validado).
	const { data: balanceFilas, error } = await supabase.rpc('balance_hogar', {
		p_hogar: hogarId
	});
	if (error) {
		console.error('[saldar] balance_hogar falló', error);
		return { personas: [], cadenas: [], yaEnCero: true };
	}
	type FilaBalance = { otro_id: string; saldo: number | string };
	const saldoPorOtro = new Map<string, number>();
	for (const f of (balanceFilas ?? []) as FilaBalance[]) {
		saldoPorOtro.set(f.otro_id, Number(f.saldo));
	}

	// Gastos del hogar con sus divisiones y aportes (para calcular
	// pendiente por participante). En paralelo: préstamos y pagos.
	const [gastosRes, prestamosRes, pagosRes] = await Promise.all([
		supabase
			.from('gastos_compartidos')
			.select(
				'id, titulo, pagador_id, gasto_divisiones(id, participante_id, monto, aportes(monto, estado))'
			)
			.eq('hogar_id', hogarId),
		supabase
			.from('prestamos')
			.select('id, motivo, prestador_id, receptor_id, monto, estado, pagos(monto, estado)')
			.eq('hogar_id', hogarId)
			.eq('estado', 'activo'),
		supabase
			.from('pagos')
			.select('id, pagador_id, receptor_id, registrado_por')
			.eq('hogar_id', hogarId)
			.eq('estado', 'pendiente')
			.is('prestamo_id', null)
	]);

	type GastoRow = {
		id: string;
		titulo: string;
		pagador_id: string;
		gasto_divisiones: Array<{
			id: string;
			participante_id: string;
			monto: number;
			aportes: Array<{ monto: number; estado: string }> | null;
		}> | null;
	};
	type PrestamoRow = {
		id: string;
		motivo: string | null;
		prestador_id: string;
		receptor_id: string;
		monto: number;
		pagos: Array<{ monto: number; estado: string }> | null;
	};
	type PagoRow = {
		id: string;
		pagador_id: string;
		receptor_id: string;
		registrado_por: string;
	};

	const gastosCountPorOtro = new Map<string, number>();
	const detallesPorOtro = new Map<string, DetalleItem[]>();

	// Helper para acumular detalles por otro.
	function agregarDetalle(otroId: string, item: DetalleItem) {
		const lista = detallesPorOtro.get(otroId) ?? [];
		lista.push(item);
		detallesPorOtro.set(otroId, lista);
	}

	// === Gastos compartidos ===
	for (const g of (gastosRes.data ?? []) as GastoRow[]) {
		const divisiones = g.gasto_divisiones ?? [];
		const involucrados = new Set([g.pagador_id, ...divisiones.map((d) => d.participante_id)]);
		if (!involucrados.has(miId)) continue;

		// Yo soy pagador → cada otro participante me debe su parte.
		if (g.pagador_id === miId) {
			for (const d of divisiones) {
				if (d.participante_id === miId) continue;
				// `me_deben` solo cuenta aportes CONFIRMADOS (balance_hogar
				// usa esta regla estricta para "me deben").
				const confirmados = (d.aportes ?? [])
					.filter((a) => a.estado === 'confirmado')
					.reduce((s, a) => s + Number(a.monto), 0);
				const pendiente = Number(d.monto) - confirmados;
				if (pendiente <= 0.5) continue;
				agregarDetalle(d.participante_id, {
					tipo: 'gasto',
					id: g.id,
					titulo: g.titulo,
					monto: pendiente,
					montoTexto: fmt.format(pendiente),
					contribucion: 'a_favor',
					url: `/gastos/${g.id}`
				});
				gastosCountPorOtro.set(
					d.participante_id,
					(gastosCountPorOtro.get(d.participante_id) ?? 0) + 1
				);
			}
		}

		// Otro es pagador y yo participo → yo le debo mi parte.
		if (g.pagador_id !== miId) {
			const miDivision = divisiones.find((d) => d.participante_id === miId);
			if (miDivision) {
				// `le_debo` usa pendiente+confirmado (rule del balance_hogar).
				const aplicados = (miDivision.aportes ?? [])
					.filter((a) => a.estado === 'pendiente' || a.estado === 'confirmado')
					.reduce((s, a) => s + Number(a.monto), 0);
				const pendiente = Number(miDivision.monto) - aplicados;
				if (pendiente > 0.5) {
					agregarDetalle(g.pagador_id, {
						tipo: 'gasto',
						id: g.id,
						titulo: g.titulo,
						monto: pendiente,
						montoTexto: fmt.format(pendiente),
						contribucion: 'en_contra',
						url: `/gastos/${g.id}`
					});
					gastosCountPorOtro.set(
						g.pagador_id,
						(gastosCountPorOtro.get(g.pagador_id) ?? 0) + 1
					);
				}
			}
		}
	}

	// === Préstamos activos ===
	const prestamosCountPorOtro = new Map<string, number>();
	for (const p of (prestamosRes.data ?? []) as PrestamoRow[]) {
		let otroId: string | null = null;
		let yoPresto = false;
		if (p.prestador_id === miId) {
			otroId = p.receptor_id;
			yoPresto = true;
		} else if (p.receptor_id === miId) {
			otroId = p.prestador_id;
			yoPresto = false;
		}
		if (!otroId) continue;

		// Mismas reglas que balance_hogar:
		//   - yo presto (me deben): solo descuenta devoluciones confirmadas.
		//   - yo recibo (le debo): descuenta pendiente + confirmado.
		const devoluciones = p.pagos ?? [];
		const aplicado = yoPresto
			? devoluciones
					.filter((d) => d.estado === 'confirmado')
					.reduce((s, d) => s + Number(d.monto), 0)
			: devoluciones
					.filter((d) => d.estado === 'pendiente' || d.estado === 'confirmado')
					.reduce((s, d) => s + Number(d.monto), 0);
		const pendiente = Number(p.monto) - aplicado;
		if (pendiente <= 0.5) continue;
		agregarDetalle(otroId, {
			tipo: 'prestamo',
			id: p.id,
			titulo: p.motivo || 'Préstamo',
			monto: pendiente,
			montoTexto: fmt.format(pendiente),
			contribucion: yoPresto ? 'a_favor' : 'en_contra',
			url: `/prestamos/${p.id}`
		});
		prestamosCountPorOtro.set(otroId, (prestamosCountPorOtro.get(otroId) ?? 0) + 1);
	}

	// === Pagos pendientes (uno por par) ===
	const pagoPendientePorOtro = new Map<string, { id: string; esMio: boolean }>();
	for (const p of (pagosRes.data ?? []) as PagoRow[]) {
		let otroId: string | null = null;
		if (p.pagador_id === miId) otroId = p.receptor_id;
		else if (p.receptor_id === miId) otroId = p.pagador_id;
		if (!otroId) continue;
		if (!pagoPendientePorOtro.has(otroId)) {
			pagoPendientePorOtro.set(otroId, { id: p.id, esMio: p.registrado_por === miId });
		}
	}

	// === Construir la lista final ===
	const personas: SaldoConPersona[] = [];
	const perfilDe = new Map<string, Miembro>(miembros.map((m) => [m.userId, m]));
	for (const [otroId, saldo] of saldoPorOtro) {
		if (Math.abs(saldo) <= 0.5) continue;
		const perfil = perfilDe.get(otroId);
		const pago = pagoPendientePorOtro.get(otroId);
		const detalles = (detallesPorOtro.get(otroId) ?? []).sort(
			(a, b) => b.monto - a.monto // mayor monto primero
		);
		personas.push({
			userId: otroId,
			nombre: perfil?.nombre ?? 'Sin nombre',
			avatar: perfil?.avatar ?? null,
			saldo,
			saldoTexto: fmt.format(Math.abs(saldo)),
			es: saldo > 0 ? 'a_favor' : 'en_contra',
			gastosCount: gastosCountPorOtro.get(otroId) ?? 0,
			prestamosActivos: prestamosCountPorOtro.get(otroId) ?? 0,
			detalles,
			pagoPendienteId: pago?.id ?? null,
			pagoPendienteEsMio: pago?.esMio ?? false
		});
	}

	// Orden: deudores (yo debo) primero, luego acreedores (me deben),
	// dentro de cada grupo por mayor monto.
	personas.sort((a, b) => {
		if (a.es !== b.es) return a.es === 'en_contra' ? -1 : 1;
		return Math.abs(b.saldo) - Math.abs(a.saldo);
	});

	// === Cadenas de simplificación ===
	// Si X me debe $A y yo le debo $B a Y, en lugar de "X me paga + yo
	// le pago a Y", podemos sugerir: "pídele a X que le pague directo a Y
	// por min(A, B)". Eso ahorra una transferencia.
	//
	// Hacemos greedy: el acreedor más grande paga al deudor más grande.
	const acreedores = personas
		.filter((p) => p.es === 'a_favor')
		.map((p) => ({ p, restante: p.saldo }));
	const deudores = personas
		.filter((p) => p.es === 'en_contra')
		.map((p) => ({ p, restante: -p.saldo })); // positivo = lo que aún le debo
	const cadenas: CadenaSugerida[] = [];
	let idx = 0;
	while (acreedores.length > 0 && deudores.length > 0) {
		acreedores.sort((a, b) => b.restante - a.restante);
		deudores.sort((a, b) => b.restante - a.restante);
		const ac = acreedores[0];
		const de = deudores[0];
		const monto = Math.min(ac.restante, de.restante);
		if (monto <= 0.5) break;
		cadenas.push({
			id: `cad-${idx++}`,
			acreedor: { userId: ac.p.userId, nombre: ac.p.nombre, avatar: ac.p.avatar },
			deudor: { userId: de.p.userId, nombre: de.p.nombre, avatar: de.p.avatar },
			monto,
			montoTexto: fmt.format(monto)
		});
		ac.restante -= monto;
		de.restante -= monto;
		if (ac.restante <= 0.5) acreedores.shift();
		if (de.restante <= 0.5) deudores.shift();
	}

	return { personas, cadenas, yaEnCero: personas.length === 0 };
}
