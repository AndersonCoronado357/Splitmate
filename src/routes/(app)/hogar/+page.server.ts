import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { HOGAR_COOKIE, listarHogares, elegirHogarActivo } from '$lib/server/hogares';

export const load: PageServerLoad = async ({ parent }) => {
	// Miembros e invitación ya vienen del layout (cacheados) → /hogar abre sin
	// consultar nada. Aquí solo derivamos los datos del hogar activo.
	const { hogarActivo } = await parent();
	if (!hogarActivo) redirect(303, '/bienvenida');

	return {
		hogar: {
			id: hogarActivo.id,
			nombre: hogarActivo.nombre,
			moneda: hogarActivo.moneda,
			esAdmin: hogarActivo.rol === 'admin'
		}
	};
};

export const actions: Actions = {
	// Editar nombre y moneda del hogar (solo admin; RLS lo refuerza).
	guardar: async ({ request, locals: { supabase, safeGetSession }, cookies }) => {
		const { user } = await safeGetSession();
		if (!user) redirect(303, '/login');
		const hogar = elegirHogarActivo(await listarHogares(supabase, user.id), cookies);
		if (!hogar) return fail(400, { seccion: 'datos', error: 'No hay hogar activo.' });

		const fd = await request.formData();
		const nombre = String(fd.get('nombre') ?? '').trim();
		const moneda = String(fd.get('moneda') ?? '').trim() || 'COP';
		if (!nombre) return fail(400, { seccion: 'datos', error: 'El nombre no puede estar vacío.' });

		const { error } = await supabase.from('hogares').update({ nombre, moneda }).eq('id', hogar.id);
		if (error) return fail(400, { seccion: 'datos', error: error.message });

		return { seccion: 'datos', ok: true };
	},

	// Regenerar la invitación (solo admin).
	regenerar: async ({ locals: { supabase, safeGetSession }, cookies }) => {
		const { user } = await safeGetSession();
		if (!user) redirect(303, '/login');
		const hogar = elegirHogarActivo(await listarHogares(supabase, user.id), cookies);
		if (!hogar) return fail(400, { seccion: 'invitacion', error: 'No hay hogar activo.' });

		const { error } = await supabase.rpc('regenerar_invitacion', { p_hogar: hogar.id });
		if (error) return fail(400, { seccion: 'invitacion', error: error.message });

		return { seccion: 'invitacion', ok: true };
	},

	// Salir del hogar (borra mi membresía). Si era el único, vuelve a bienvenida.
	salir: async ({ locals: { supabase, safeGetSession }, cookies }) => {
		const { user } = await safeGetSession();
		if (!user) redirect(303, '/login');
		const hogar = elegirHogarActivo(await listarHogares(supabase, user.id), cookies);
		if (!hogar) return fail(400, { seccion: 'salir', error: 'No hay hogar activo.' });

		const { error } = await supabase
			.from('miembros_hogar')
			.delete()
			.eq('hogar_id', hogar.id)
			.eq('user_id', user.id);
		if (error) return fail(400, { seccion: 'salir', error: error.message });

		// La cookie apuntaba a este hogar; la limpiamos para que el activo se
		// recalcule (al primero que quede, o a bienvenida si no queda ninguno).
		cookies.delete(HOGAR_COOKIE, { path: '/' });

		redirect(303, '/');
	}
};
