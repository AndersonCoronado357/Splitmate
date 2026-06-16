import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	cargarFijo,
	cargarDivisionesPlantilla,
	type FijoMes,
	type FijoPlantilla,
	type FijoDivisionPlantilla
} from '$lib/server/fijos';
import { elegirHogarActivo, listarHogares } from '$lib/server/hogares';
import type { DbClient as SupabaseClient } from '$lib/server/sb';
import type { Cookies } from '@sveltejs/kit';

async function hogarYRol(supabase: SupabaseClient, userId: string, cookies: Cookies) {
	const hogares = await listarHogares(supabase, userId);
	return elegirHogarActivo(hogares, cookies);
}

export const load: PageServerLoad = async ({
	locals: { supabase, user },
	params,
	parent,
	depends
}) => {
	if (!user) redirect(303, '/login');
	depends('app:fijos');

	const { hogarActivo, miembros } = await parent();
	if (!hogarActivo) redirect(303, '/bienvenida');

	const r = await cargarFijo(supabase, params.id, miembros, hogarActivo.moneda);
	if (!r) error(404, 'Gasto fijo no encontrado');
	if (r.plantilla.hogarId !== hogarActivo.id) error(404, 'Gasto fijo no encontrado');

	const divPlantilla = await cargarDivisionesPlantilla(supabase, params.id, miembros);

	return {
		plantilla: r.plantilla,
		meses: r.meses,
		divisionesPlantilla: divPlantilla
	} satisfies {
		plantilla: FijoPlantilla;
		meses: FijoMes[];
		divisionesPlantilla: FijoDivisionPlantilla[];
	};
};

export const actions: Actions = {
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

		const { error: e } = await supabase.from('gastos_fijos_aportes').insert({
			division_id: divisionId,
			monto,
			fecha: fecha ?? new Date().toISOString().slice(0, 10),
			nota,
			registrado_por: user.id
		});
		if (e) return fail(400, { error: e.message });
		return { ok: true };
	},

	borrarAporte: async ({ request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/login');
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '').trim();
		if (!id) return fail(400, { error: 'Falta el id.' });
		const { error: e, count } = await supabase
			.from('gastos_fijos_aportes')
			.delete({ count: 'exact' })
			.eq('id', id);
		if (e) return fail(400, { error: e.message });
		if (!count) return fail(403, { error: 'No se pudo borrar el aporte.' });
		return { ok: true };
	},

	// Solo el administrador del hogar puede archivar/restaurar.
	toggleActiva: async ({ request, locals: { supabase, user }, params, cookies }) => {
		if (!user) redirect(303, '/login');
		const hogar = await hogarYRol(supabase, user.id, cookies);
		if (!hogar) return fail(400, { error: 'No hay hogar activo.' });
		if (hogar.rol !== 'admin')
			return fail(403, { error: 'Solo el administrador puede archivar gastos fijos.' });

		const fd = await request.formData();
		const activa = fd.get('activa') === 'true';
		const { error: e } = await supabase
			.from('gastos_fijos_plantilla')
			.update({ activa })
			.eq('id', params.id)
			.eq('hogar_id', hogar.id);
		if (e) return fail(400, { error: e.message });
		return { ok: true };
	},

	// Solo el administrador del hogar puede eliminar.
	borrar: async ({ locals: { supabase, user }, params, cookies }) => {
		if (!user) redirect(303, '/login');
		const hogar = await hogarYRol(supabase, user.id, cookies);
		if (!hogar) return fail(400, { error: 'No hay hogar activo.' });
		if (hogar.rol !== 'admin')
			return fail(403, { error: 'Solo el administrador puede eliminar gastos fijos.' });

		const { error: e, count } = await supabase
			.from('gastos_fijos_plantilla')
			.delete({ count: 'exact' })
			.eq('id', params.id)
			.eq('hogar_id', hogar.id);
		if (e) return fail(400, { error: e.message });
		if (!count) return fail(403, { error: 'No se pudo borrar.' });
		redirect(303, '/fijos');
	}
};
