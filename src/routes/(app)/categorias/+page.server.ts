import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { elegirHogarActivo, listarHogares } from '$lib/server/hogares';

export const load: PageServerLoad = async ({ locals: { supabase, user }, parent, depends }) => {
	if (!user) redirect(303, '/login');
	depends('app:categorias');
	const { hogarActivo } = await parent();
	if (!hogarActivo) redirect(303, '/bienvenida');

	const { data } = await supabase
		.from('categorias')
		.select('id, nombre, icono, orden')
		.eq('hogar_id', hogarActivo.id)
		.order('orden', { ascending: true })
		.order('nombre', { ascending: true });

	return {
		categorias: (
			(data ?? []) as Array<{
				id: string;
				nombre: string;
				icono: string | null;
				orden: number;
			}>
		).map((c) => ({
			id: c.id,
			nombre: c.nombre,
			icono: c.icono,
			orden: c.orden
		}))
	};
};

// Helper: resuelve hogar activo y rola admin.
async function hogarYRol(
	supabase: import('$lib/server/sb').DbClient,
	userId: string,
	cookies: import('@sveltejs/kit').Cookies
) {
	const hogares = await listarHogares(supabase, userId);
	return elegirHogarActivo(hogares, cookies);
}

export const actions: Actions = {
	crear: async ({ request, locals: { supabase, user }, cookies }) => {
		if (!user) redirect(303, '/login');
		const hogar = await hogarYRol(supabase, user.id, cookies);
		if (!hogar) return fail(400, { error: 'No hay hogar activo.' });
		if (hogar.rol !== 'admin')
			return fail(403, { error: 'Solo el administrador edita categorías.' });

		const fd = await request.formData();
		const nombre = String(fd.get('nombre') ?? '').trim();
		const icono = String(fd.get('icono') ?? 'tag').trim() || 'tag';
		if (!nombre) return fail(400, { error: 'El nombre no puede estar vacío.' });
		if (nombre.length > 40) return fail(400, { error: 'Máximo 40 caracteres.' });

		const { error } = await supabase
			.from('categorias')
			.insert({ hogar_id: hogar.id, nombre, icono, orden: 100 });
		if (error) return fail(400, { error: error.message });

		return { ok: true };
	},

	editar: async ({ request, locals: { supabase, user }, cookies }) => {
		if (!user) redirect(303, '/login');
		const hogar = await hogarYRol(supabase, user.id, cookies);
		if (!hogar) return fail(400, { error: 'No hay hogar activo.' });
		if (hogar.rol !== 'admin')
			return fail(403, { error: 'Solo el administrador edita categorías.' });

		const fd = await request.formData();
		const id = String(fd.get('id') ?? '').trim();
		const nombre = String(fd.get('nombre') ?? '').trim();
		const icono = String(fd.get('icono') ?? '').trim() || null;
		if (!id) return fail(400, { error: 'Falta id.' });
		if (!nombre) return fail(400, { error: 'El nombre no puede estar vacío.' });
		if (nombre.length > 40) return fail(400, { error: 'Máximo 40 caracteres.' });

		const update: Record<string, unknown> = { nombre };
		if (icono) update.icono = icono;

		const { error } = await supabase
			.from('categorias')
			.update(update)
			.eq('id', id)
			.eq('hogar_id', hogar.id);
		if (error) return fail(400, { error: error.message });

		return { ok: true };
	},

	borrar: async ({ request, locals: { supabase, user }, cookies }) => {
		if (!user) redirect(303, '/login');
		const hogar = await hogarYRol(supabase, user.id, cookies);
		if (!hogar) return fail(400, { error: 'No hay hogar activo.' });
		if (hogar.rol !== 'admin')
			return fail(403, { error: 'Solo el administrador edita categorías.' });

		const fd = await request.formData();
		const id = String(fd.get('id') ?? '').trim();
		if (!id) return fail(400, { error: 'Falta id.' });

		const { error } = await supabase
			.from('categorias')
			.delete()
			.eq('id', id)
			.eq('hogar_id', hogar.id);
		if (error) return fail(400, { error: error.message });

		return { ok: true };
	}
};
