import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { cargarSaldos, type Saldos } from '$lib/server/saldar';
import { elegirHogarActivo, listarHogares } from '$lib/server/hogares';
import { enviarPushAUsuario } from '$lib/server/push';

export const load: PageServerLoad = async ({
	locals: { supabase, user },
	parent,
	depends
}) => {
	if (!user) redirect(303, '/login');
	depends('app:saldar');

	const { hogarActivo, miembros } = await parent();
	if (!hogarActivo) redirect(303, '/bienvenida');

	const saldos = await cargarSaldos(
		supabase,
		hogarActivo.id,
		user.id,
		miembros.map((m) => ({ userId: m.userId, nombre: m.nombre, avatar: m.avatar })),
		hogarActivo.moneda
	);

	return { saldos } satisfies { saldos: Saldos };
};

export const actions: Actions = {
	// Yo (deudor) registro que ya pagué — queda pendiente hasta que el
	// receptor confirme.
	pagar: async ({ request, locals: { supabase, user }, cookies }) => {
		if (!user) redirect(303, '/login');
		const hogar = elegirHogarActivo(await listarHogares(supabase, user.id), cookies);
		if (!hogar) return fail(400, { error: 'No hay hogar activo.' });

		const fd = await request.formData();
		const receptorId = String(fd.get('receptor_id') ?? '').trim();
		const monto = Number(String(fd.get('monto') ?? '0').trim().replace(',', '.'));
		if (!receptorId) return fail(400, { error: 'Falta el receptor.' });
		if (receptorId === user.id) return fail(400, { error: 'No puedes pagarte a ti mismo.' });
		if (!Number.isFinite(monto) || monto <= 0) return fail(400, { error: 'Monto inválido.' });

		const { data: nuevoPago, error } = await supabase
			.from('pagos')
			.insert({
				hogar_id: hogar.id,
				pagador_id: user.id,
				receptor_id: receptorId,
				monto,
				fecha: new Date().toISOString().slice(0, 10),
				registrado_por: user.id
			})
			.select('id')
			.maybeSingle();
		if (error) return fail(400, { error: error.message });

		try {
			const { data: perfil } = await supabase
				.from('profiles')
				.select('display_name')
				.eq('id', user.id)
				.maybeSingle();
			const quien = perfil?.display_name || 'Alguien';
			await enviarPushAUsuario(receptorId, {
				title: `${quien} dice que te pagó`,
				body: 'Confirma o rechaza el pago desde el inicio.',
				url: '/',
				tag: `pago-pendiente:${nuevoPago?.id ?? receptorId}`
			});
		} catch (e) {
			console.warn('[push] no se pudo notificar pago desde saldar', e);
		}
		return { ok: true };
	},

	// Yo (receptor) marco que ya me llegó la plata — entra confirmado
	// directamente (RLS 036 lo permite).
	marcarRecibido: async ({ request, locals: { supabase, user }, cookies }) => {
		if (!user) redirect(303, '/login');
		const hogar = elegirHogarActivo(await listarHogares(supabase, user.id), cookies);
		if (!hogar) return fail(400, { error: 'No hay hogar activo.' });

		const fd = await request.formData();
		const pagadorId = String(fd.get('pagador_id') ?? '').trim();
		const monto = Number(String(fd.get('monto') ?? '0').trim().replace(',', '.'));
		if (!pagadorId) return fail(400, { error: 'Falta el pagador.' });
		if (pagadorId === user.id) return fail(400, { error: 'No puedes recibir de ti mismo.' });
		if (!Number.isFinite(monto) || monto <= 0) return fail(400, { error: 'Monto inválido.' });

		const ahora = new Date().toISOString();
		const { data: nuevoPago, error } = await supabase
			.from('pagos')
			.insert({
				hogar_id: hogar.id,
				pagador_id: pagadorId,
				receptor_id: user.id,
				monto,
				fecha: ahora.slice(0, 10),
				registrado_por: user.id,
				estado: 'confirmado',
				confirmado_at: ahora,
				nota: 'Marcado como recibido desde saldar'
			})
			.select('id')
			.maybeSingle();
		if (error) return fail(400, { error: error.message });

		try {
			const { data: perfil } = await supabase
				.from('profiles')
				.select('display_name')
				.eq('id', user.id)
				.maybeSingle();
			const quien = perfil?.display_name || 'Alguien';
			await enviarPushAUsuario(pagadorId, {
				title: `${quien} confirmó que le pagaste`,
				body: 'Quedó registrado en el balance del hogar.',
				url: '/saldar',
				tag: `pago-confirmado:${nuevoPago?.id ?? pagadorId}`
			});
		} catch (e) {
			console.warn('[push] no se pudo notificar pago confirmado', e);
		}
		return { ok: true };
	},

	cancelarPago: async ({ request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/login');
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '').trim();
		if (!id) return fail(400, { error: 'Falta el id.' });

		const { error, count } = await supabase
			.from('pagos')
			.delete({ count: 'exact' })
			.eq('id', id)
			.eq('estado', 'pendiente');
		if (error) return fail(400, { error: error.message });
		if (!count) return fail(403, { error: 'No se pudo cancelar el pago.' });
		return { ok: true };
	},

	confirmarPago: async ({ request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/login');
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '').trim();
		if (!id) return fail(400, { error: 'Falta el id.' });

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
		return { ok: true };
	},

	// Cadena de simplificación: el acreedor (que me debe) le paga directo
	// al deudor (a quien le debo) por un monto. Para registrarlo,
	// insertamos DOS pagos confirmados:
	//   1) acreedor → yo (RLS 036: receptor inserta confirmado)
	//   2) yo → deudor (RLS: pagador inserta con estado confirmado)
	// Net: mi balance con acreedor baja en `monto`, mi balance con
	// deudor sube en `monto`. Los otros dos miembros no necesitan
	// registrar nada — el dinero salió de uno y le llegó al otro en
	// la vida real, sin pasar por mí.
	marcarCadena: async ({ request, locals: { supabase, user }, cookies }) => {
		if (!user) redirect(303, '/login');
		const hogar = elegirHogarActivo(await listarHogares(supabase, user.id), cookies);
		if (!hogar) return fail(400, { error: 'No hay hogar activo.' });

		const fd = await request.formData();
		const acreedorId = String(fd.get('acreedor_id') ?? '').trim();
		const deudorId = String(fd.get('deudor_id') ?? '').trim();
		const monto = Number(String(fd.get('monto') ?? '0').trim().replace(',', '.'));

		if (!acreedorId || !deudorId) return fail(400, { error: 'Faltan los participantes.' });
		if (acreedorId === deudorId) return fail(400, { error: 'Acreedor y deudor no pueden ser el mismo.' });
		if (acreedorId === user.id || deudorId === user.id) {
			return fail(400, { error: 'En una cadena, tú no participas como acreedor ni deudor.' });
		}
		if (!Number.isFinite(monto) || monto <= 0) return fail(400, { error: 'Monto inválido.' });

		const ahora = new Date().toISOString();
		const fecha = ahora.slice(0, 10);
		const nota = 'Cadena de simplificación desde saldar';

		// Inserción atómica: si una falla, deshacemos la otra.
		const { data: pago1, error: e1 } = await supabase
			.from('pagos')
			.insert({
				hogar_id: hogar.id,
				pagador_id: acreedorId,
				receptor_id: user.id,
				monto,
				fecha,
				registrado_por: user.id,
				estado: 'confirmado',
				confirmado_at: ahora,
				nota
			})
			.select('id')
			.maybeSingle();
		if (e1 || !pago1) return fail(400, { error: e1?.message ?? 'No se pudo registrar la cadena.' });

		const { error: e2 } = await supabase.from('pagos').insert({
			hogar_id: hogar.id,
			pagador_id: user.id,
			receptor_id: deudorId,
			monto,
			fecha,
			registrado_por: user.id,
			estado: 'confirmado',
			confirmado_at: ahora,
			nota
		});
		if (e2) {
			// Rollback del primer pago para no dejar la BD a medias.
			await supabase.from('pagos').delete().eq('id', pago1.id);
			return fail(400, { error: `No se pudo registrar la cadena: ${e2.message}` });
		}

		// Push a ambos extremos para que vean el descuento en el balance.
		try {
			const { data: perfil } = await supabase
				.from('profiles')
				.select('display_name')
				.eq('id', user.id)
				.maybeSingle();
			const quien = perfil?.display_name || 'Alguien';
			const { enviarPushAUsuarios } = await import('$lib/server/push');
			await enviarPushAUsuarios([acreedorId, deudorId], {
				title: `${quien} registró una cadena de pago`,
				body: 'Revisa tu balance del hogar para ver el descuento.',
				url: '/saldar',
				tag: `cadena:${pago1.id}`
			});
		} catch (e) {
			console.warn('[push] no se pudo notificar cadena', e);
		}
		return { ok: true };
	},

	rechazarPago: async ({ request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/login');
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '').trim();
		if (!id) return fail(400, { error: 'Falta el id.' });

		const { error, count } = await supabase
			.from('pagos')
			.update({ estado: 'rechazado' }, { count: 'exact' })
			.eq('id', id)
			.eq('estado', 'pendiente');
		if (error) return fail(400, { error: error.message });
		if (!count) return fail(403, { error: 'No se pudo rechazar el pago.' });
		return { ok: true };
	}
};
