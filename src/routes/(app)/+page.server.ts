import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	type PerfilMin,
	listarGastosPorPersona,
	type GastoEnDeuda
} from '$lib/server/gastos';
import { listarPagos, type PagoVista } from '$lib/server/pagos';
import { elegirHogarActivo, listarHogares } from '$lib/server/hogares';
import { enviarPushAUsuario } from '$lib/server/push';
import type { DbClient as SupabaseClient } from '$lib/server/sb';

async function nombreDe(supabase: SupabaseClient, userId: string): Promise<string> {
	const { data } = await supabase
		.from('profiles')
		.select('display_name')
		.eq('id', userId)
		.maybeSingle();
	return data?.display_name || 'Alguien';
}

// Pantalla principal: muestra el balance del usuario con cada otro miembro del
// hogar activo. Llamamos al RPC `balance_hogar` (migración 010 + 016) que
// entrega el saldo neto ya con aportes Y pagos confirmados restados.
export type SaldoPorPersona = {
	id: string;
	nombre: string;
	avatar: string | null;
	saldo: number;
	// Desglose: cuáles gastos componen lo que le debo / me debe a esta persona.
	leDebo: GastoEnDeuda[];
	meDebe: GastoEnDeuda[];
};

export type ResumenInicio = {
	saldoNeto: number;
	aFavor: number;
	enContra: number;
	personas: SaldoPorPersona[];
};

export const load: PageServerLoad = async ({
	locals: { supabase, user },
	parent,
	depends
}) => {
	if (!user) redirect(303, '/login');
	depends('app:inicio');

	const { hogarActivo, miembros } = await parent();
	if (!hogarActivo) redirect(303, '/bienvenida');

	const perfiles = new Map<string, PerfilMin>(
		miembros.map((m) => [m.userId, { display_name: m.nombre, avatar_url: m.avatar }])
	);

	// Balance, pagos y desglose por persona en paralelo (no dependen entre sí).
	const [balanceRes, pagos, desglosePorPersona] = await Promise.all([
		supabase.rpc('balance_hogar', { p_hogar: hogarActivo.id }),
		listarPagos(supabase, hogarActivo.id, perfiles, hogarActivo.moneda),
		listarGastosPorPersona(supabase, hogarActivo.id, user.id, hogarActivo.moneda)
	]);

	const filas = (balanceRes.data ?? []) as Array<{ otro_id: string; saldo: number | string }>;
	const pares = filas.map((f) => {
		const m = miembros.find((mm) => mm.userId === f.otro_id);
		const desglose = desglosePorPersona.get(f.otro_id);
		return {
			id: f.otro_id,
			nombre: m?.nombre || 'Sin nombre',
			avatar: m?.avatar ?? null,
			saldo: Number(f.saldo),
			leDebo: desglose?.leDebo ?? [],
			meDebe: desglose?.meDebe ?? []
		} satisfies SaldoPorPersona;
	});

	const personas = pares
		.filter((p) => Math.abs(p.saldo) > 0.01)
		.sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo));

	const saldoNeto = personas.reduce((acc, p) => acc + p.saldo, 0);
	const aFavor = personas.filter((p) => p.saldo > 0).reduce((s, p) => s + p.saldo, 0);
	const enContra = personas.filter((p) => p.saldo < 0).reduce((s, p) => s - p.saldo, 0);

	const resumen: ResumenInicio = {
		saldoNeto,
		aFavor,
		enContra,
		personas
	};

	// Pagos pendientes en los que estoy involucrado.
	const pagosRecibir = pagos.filter(
		(p) => p.estado === 'pendiente' && p.receptorId === user.id
	);
	const pagosEnviados = pagos.filter(
		(p) => p.estado === 'pendiente' && p.pagadorId === user.id
	);

	return {
		resumen,
		pagosRecibir,
		pagosEnviados
	} satisfies { resumen: ResumenInicio; pagosRecibir: PagoVista[]; pagosEnviados: PagoVista[] };
};

export const actions: Actions = {
	// Registrar un aporte contra una división concreta de un gasto. Como soy
	// el deudor (participante), queda en estado=pendiente hasta que el pagador
	// del gasto confirme.
	registrarAporte: async ({ request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/login');

		const fd = await request.formData();
		const divisionId = String(fd.get('division_id') ?? '').trim();
		const montoStr = String(fd.get('monto') ?? '').trim().replace(',', '.');

		if (!divisionId) return fail(400, { error: 'Falta la deuda.' });
		const monto = Number(montoStr);
		if (!Number.isFinite(monto) || monto <= 0) {
			return fail(400, { error: 'Monto inválido.' });
		}

		// Solo el participante de la división puede abonar desde aquí.
		const { data: div } = await supabase
			.from('gasto_divisiones')
			.select('id, participante_id, monto, gasto_id, gastos_compartidos(pagador_id, titulo)')
			.eq('id', divisionId)
			.maybeSingle();
		if (!div || div.participante_id !== user.id) {
			return fail(403, { error: 'No puedes abonar a esta deuda.' });
		}

		const { error } = await supabase.from('aportes').insert({
			division_id: divisionId,
			monto,
			fecha: new Date().toISOString().slice(0, 10),
			registrado_por: user.id,
			estado: 'pendiente'
		});

		if (error) return fail(400, { error: error.message });

		// Push al pagador del gasto para que confirme.
		type Embed = { pagador_id: string; titulo: string } | { pagador_id: string; titulo: string }[] | null;
		const g = (div as unknown as { gastos_compartidos: Embed; gasto_id: string }).gastos_compartidos;
		const pagadorId = g ? (Array.isArray(g) ? g[0]?.pagador_id : g.pagador_id) : null;
		const titulo = g ? (Array.isArray(g) ? g[0]?.titulo : g.titulo) : 'Un gasto';
		if (pagadorId && pagadorId !== user.id) {
			try {
				const quien = await nombreDe(supabase, user.id);
				await enviarPushAUsuario(pagadorId, {
					title: `${quien} dice que te pagó`,
					body: `${titulo} — confirma o rechaza el aporte`,
					url: `/gastos/${(div as { gasto_id: string }).gasto_id}`,
					tag: `aporte-pendiente:${(div as { gasto_id: string }).gasto_id}`
				});
			} catch (e) {
				console.warn('[push] no se pudo notificar aporte (home)', e);
			}
		}
		return { ok: true };
	},

	// Registrar un pago saliente (yo le pago a otro). Queda en estado=pendiente
	// hasta que el receptor confirme.
	registrarPago: async ({ request, locals: { supabase, user }, cookies }) => {
		if (!user) redirect(303, '/login');
		const hogarActivo = elegirHogarActivo(await listarHogares(supabase, user.id), cookies);
		if (!hogarActivo) return fail(400, { error: 'No hay hogar activo.' });

		const fd = await request.formData();
		const receptorId = String(fd.get('receptor_id') ?? '').trim();
		const montoStr = String(fd.get('monto') ?? '').trim().replace(',', '.');
		const fecha = String(fd.get('fecha') ?? '').trim() || null;
		const nota = String(fd.get('nota') ?? '').trim() || null;

		if (!receptorId) return fail(400, { error: 'Falta el receptor.' });
		if (receptorId === user.id) return fail(400, { error: 'No puedes pagarte a ti mismo.' });

		const monto = Number(montoStr);
		if (!Number.isFinite(monto) || monto <= 0) {
			return fail(400, { error: 'Monto inválido.' });
		}

		const { data: nuevoPago, error } = await supabase
			.from('pagos')
			.insert({
				hogar_id: hogarActivo.id,
				pagador_id: user.id,
				receptor_id: receptorId,
				monto,
				fecha: fecha ?? new Date().toISOString().slice(0, 10),
				nota,
				registrado_por: user.id
			})
			.select('id')
			.maybeSingle();

		if (error) return fail(400, { error: error.message });

		// Push al receptor para que confirme.
		try {
			const quien = await nombreDe(supabase, user.id);
			await enviarPushAUsuario(receptorId, {
				title: `${quien} dice que te pagó`,
				body: 'Confirma o rechaza el pago desde el inicio.',
				url: '/',
				tag: `pago-pendiente:${nuevoPago?.id ?? receptorId}`
			});
		} catch (e) {
			console.warn('[push] no se pudo notificar pago', e);
		}
		return { ok: true };
	},

	// El receptor confirma un pago: pasa a estado=confirmado y reduce el balance.
	confirmarPago: async ({ request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/login');
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '').trim();
		if (!id) return fail(400, { error: 'Falta el id.' });

		const { data: pagoAntes } = await supabase
			.from('pagos')
			.select('pagador_id')
			.eq('id', id)
			.maybeSingle();

		const { error, count } = await supabase
			.from('pagos')
			.update(
				{ estado: 'confirmado', confirmado_at: new Date().toISOString() },
				{ count: 'exact' }
			)
			.eq('id', id)
			.eq('estado', 'pendiente');

		if (error) return fail(400, { error: error.message });
		if (!count) return fail(403, { error: 'No se pudo confirmar el pago.' });

		if (pagoAntes?.pagador_id && pagoAntes.pagador_id !== user.id) {
			try {
				await enviarPushAUsuario(pagoAntes.pagador_id, {
					title: 'Confirmaron tu pago',
					body: 'Ya quedó registrado en el balance.',
					url: '/',
					tag: `pago-confirmado:${id}`
				});
			} catch (e) {
				console.warn('[push] no se pudo notificar confirmación de pago', e);
			}
		}
		return { ok: true };
	},

	// El receptor rechaza un pago: pasa a estado=rechazado. No afecta balance.
	rechazarPago: async ({ request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/login');
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '').trim();
		if (!id) return fail(400, { error: 'Falta el id.' });

		const { data: pagoAntes } = await supabase
			.from('pagos')
			.select('pagador_id')
			.eq('id', id)
			.maybeSingle();

		const { error, count } = await supabase
			.from('pagos')
			.update({ estado: 'rechazado' }, { count: 'exact' })
			.eq('id', id)
			.eq('estado', 'pendiente');

		if (error) return fail(400, { error: error.message });
		if (!count) return fail(403, { error: 'No se pudo rechazar el pago.' });

		if (pagoAntes?.pagador_id && pagoAntes.pagador_id !== user.id) {
			try {
				await enviarPushAUsuario(pagoAntes.pagador_id, {
					title: 'Rechazaron tu pago',
					body: 'Revisa el balance y vuelve a marcarlo si hubo un error.',
					url: '/',
					tag: `pago-rechazado:${id}`
				});
			} catch (e) {
				console.warn('[push] no se pudo notificar rechazo de pago', e);
			}
		}
		return { ok: true };
	},

	// El pagador (= registrador) cancela un pago pendiente. Solo si sigue pendiente.
	borrarPago: async ({ request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/login');
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '').trim();
		if (!id) return fail(400, { error: 'Falta el id.' });

		const { error, count } = await supabase
			.from('pagos')
			.delete({ count: 'exact' })
			.eq('id', id);

		if (error) return fail(400, { error: error.message });
		if (!count) return fail(403, { error: 'No se pudo borrar el pago.' });
		return { ok: true };
	}
};
