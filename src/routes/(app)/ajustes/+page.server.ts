import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import * as auth from '$lib/server/acmsy/auth';
import { verifyPassword } from '$lib/server/acmsy/security';
import { saveAvatar, removeAvatar } from '$lib/server/avatars';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export const actions: Actions = {
	// Salir del hogar activo (borra mi membresia).
	salirHogar: async ({ locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) redirect(303, '/login');

		const { data } = await supabase
			.from('miembros_hogar')
			.select('hogar_id')
			.eq('user_id', user.id)
			.order('created_at', { ascending: true })
			.limit(1)
			.maybeSingle();

		if (data?.hogar_id) {
			await supabase.from('miembros_hogar').delete().eq('hogar_id', data.hogar_id).eq('user_id', user.id);
		}
		redirect(303, '/');
	},

	// Cambiar el nombre visible (profiles.display_name).
	guardarNombre: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { seccion: 'perfil', error: 'Sesión no válida.' });

		const fd = await request.formData();
		const nombre = String(fd.get('nombre') ?? '').trim();
		if (!nombre) return fail(400, { seccion: 'perfil', error: 'Escribe tu nombre.' });
		if (nombre.length > 60) return fail(400, { seccion: 'perfil', error: 'Máximo 60 caracteres.' });

		const { error } = await supabase.from('profiles').update({ display_name: nombre }).eq('id', user.id);
		if (error) return fail(400, { seccion: 'perfil', error: error.message });
		return { seccion: 'perfil', ok: true };
	},

	// Subir / reemplazar la foto de perfil (guardada en disco por acmsy).
	subirFoto: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { seccion: 'foto', error: 'Sesión no válida.' });

		const fd = await request.formData();
		const file = fd.get('foto');
		if (!(file instanceof File) || file.size === 0)
			return fail(400, { seccion: 'foto', error: 'Elige una imagen.' });
		if (!file.type.startsWith('image/'))
			return fail(400, { seccion: 'foto', error: 'El archivo debe ser una imagen.' });
		if (file.size > MAX_BYTES)
			return fail(400, { seccion: 'foto', error: 'La imagen no puede pesar más de 5 MB.' });

		const bytes = Buffer.from(await file.arrayBuffer());
		await saveAvatar(user.id, bytes, file.type);
		const url = `/avatars/${user.id}?v=${Date.now()}`;

		const { error: dbErr } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);
		if (dbErr) return fail(400, { seccion: 'foto', error: dbErr.message });
		return { seccion: 'foto', ok: true };
	},

	// Quitar la foto subida (vuelve a la de Google o a las iniciales).
	quitarFoto: async ({ locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { seccion: 'foto', error: 'Sesión no válida.' });

		await removeAvatar(user.id);
		const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id);
		if (error) return fail(400, { seccion: 'foto', error: error.message });
		return { seccion: 'foto', ok: true };
	},

	// Cambiar la contraseña (verifica la actual con el hash scrypt de acmsy).
	cambiarContrasena: async ({ request, locals: { safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user?.email) return fail(401, { seccion: 'clave', error: 'Sesión no válida.' });

		const fd = await request.formData();
		const actual = String(fd.get('actual') ?? '');
		const nueva = String(fd.get('nueva') ?? '');
		const repetir = String(fd.get('repetir') ?? '');

		if (!actual) return fail(400, { seccion: 'clave', error: 'Escribe tu contraseña actual.' });
		if (nueva.length < 8)
			return fail(400, { seccion: 'clave', error: 'La nueva debe tener al menos 8 caracteres.' });
		if (nueva !== repetir)
			return fail(400, { seccion: 'clave', error: 'Las contraseñas nuevas no coinciden.' });

		const dbUser = await auth.findById(user.id);
		if (!dbUser?.password_hash || !verifyPassword(actual, dbUser.password_hash)) {
			return fail(400, { seccion: 'clave', error: 'La contraseña actual no es correcta.' });
		}

		await auth.setPassword(user.id, nueva);
		return { seccion: 'clave', ok: true };
	}
};
