import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { listarGastosFijos, type FijoListado } from '$lib/server/fijos';
import { elegirHogarActivo, listarHogares } from '$lib/server/hogares';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Cookies } from '@sveltejs/kit';

// Resuelve hogar activo + rol del usuario actual (igual que en /categorias).
async function hogarYRol(supabase: SupabaseClient, userId: string, cookies: Cookies) {
	const hogares = await listarHogares(supabase, userId);
	return elegirHogarActivo(hogares, cookies);
}

export const load: PageServerLoad = async ({
	locals: { supabase, user },
	parent,
	depends
}) => {
	if (!user) redirect(303, '/login');
	depends('app:fijos');

	const { hogarActivo, miembros } = await parent();
	if (!hogarActivo) redirect(303, '/bienvenida');

	const fijos = await listarGastosFijos(
		supabase,
		hogarActivo.id,
		miembros,
		hogarActivo.moneda
	);

	return { fijos } satisfies { fijos: FijoListado[] };
};

export const actions: Actions = {
	// Registrar un aporte mío sobre la cuota de un mes.
	aportar: async ({ request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/login');
		const fd = await request.formData();
		const divisionId = String(fd.get('division_id') ?? '').trim();
		const montoStr = String(fd.get('monto') ?? '').trim().replace(',', '.');
		const fecha = String(fd.get('fecha') ?? '').trim() || null;
		const nota = String(fd.get('nota') ?? '').trim() || null;

		if (!divisionId) return fail(400, { error: 'Falta la división.' });
		const monto = Number(montoStr);
		if (!Number.isFinite(monto) || monto <= 0) {
			return fail(400, { error: 'Monto inválido.' });
		}

		const { error } = await supabase.from('gastos_fijos_aportes').insert({
			division_id: divisionId,
			monto,
			fecha: fecha ?? new Date().toISOString().slice(0, 10),
			nota,
			registrado_por: user.id
		});
		if (error) return fail(400, { error: error.message });
		return { ok: true };
	},

	// Quitar un aporte mío (solo el que lo registró).
	borrarAporte: async ({ request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/login');
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '').trim();
		if (!id) return fail(400, { error: 'Falta el id.' });

		const { error, count } = await supabase
			.from('gastos_fijos_aportes')
			.delete({ count: 'exact' })
			.eq('id', id);
		if (error) return fail(400, { error: error.message });
		if (!count) return fail(403, { error: 'No se pudo borrar el aporte.' });
		return { ok: true };
	},

	// Activar/desactivar plantilla (no la borra; archiva).
	// Solo el administrador del hogar puede archivar/restaurar.
	toggleActiva: async ({ request, locals: { supabase, user }, cookies }) => {
		if (!user) redirect(303, '/login');
		const hogar = await hogarYRol(supabase, user.id, cookies);
		if (!hogar) return fail(400, { error: 'No hay hogar activo.' });
		if (hogar.rol !== 'admin')
			return fail(403, { error: 'Solo el administrador puede archivar gastos fijos.' });

		const fd = await request.formData();
		const id = String(fd.get('id') ?? '').trim();
		const activa = fd.get('activa') === 'true';
		if (!id) return fail(400, { error: 'Falta el id.' });
		const { error } = await supabase
			.from('gastos_fijos_plantilla')
			.update({ activa })
			.eq('id', id)
			.eq('hogar_id', hogar.id);
		if (error) return fail(400, { error: error.message });
		return { ok: true };
	},

	// Solo el administrador del hogar puede eliminar.
	borrar: async ({ request, locals: { supabase, user }, cookies }) => {
		if (!user) redirect(303, '/login');
		const hogar = await hogarYRol(supabase, user.id, cookies);
		if (!hogar) return fail(400, { error: 'No hay hogar activo.' });
		if (hogar.rol !== 'admin')
			return fail(403, { error: 'Solo el administrador puede eliminar gastos fijos.' });

		const fd = await request.formData();
		const id = String(fd.get('id') ?? '').trim();
		if (!id) return fail(400, { error: 'Falta el id.' });
		const { error, count } = await supabase
			.from('gastos_fijos_plantilla')
			.delete({ count: 'exact' })
			.eq('id', id)
			.eq('hogar_id', hogar.id);
		if (error) return fail(400, { error: error.message });
		if (!count) return fail(403, { error: 'No se pudo borrar la plantilla.' });
		return { ok: true };
	}
};
