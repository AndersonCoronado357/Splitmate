import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

const BUCKET = 'avatares';
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export const actions: Actions = {
	// Salir del hogar activo (borra mi membresía). Si era el único, el layout
	// te manda a /bienvenida.
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
			await supabase
				.from('miembros_hogar')
				.delete()
				.eq('hogar_id', data.hogar_id)
				.eq('user_id', user.id);
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
		if (nombre.length > 60)
			return fail(400, { seccion: 'perfil', error: 'Máximo 60 caracteres.' });

		const { error } = await supabase
			.from('profiles')
			.upsert({ id: user.id, display_name: nombre });
		if (error) return fail(400, { seccion: 'perfil', error: error.message });

		return { seccion: 'perfil', ok: true };
	},

	// Subir / reemplazar la foto de perfil.
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

		// Una sola foto por usuario: misma ruta, se sobreescribe.
		const path = `${user.id}/avatar`;
		const { error: upErr } = await supabase.storage
			.from(BUCKET)
			.upload(path, file, { upsert: true, contentType: file.type });
		if (upErr) return fail(400, { seccion: 'foto', error: upErr.message });

		const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
		// ?v=… rompe la caché del navegador para que se vea la nueva foto al instante.
		const url = `${pub.publicUrl}?v=${Date.now()}`;

		const { error: dbErr } = await supabase
			.from('profiles')
			.upsert({ id: user.id, avatar_url: url });
		if (dbErr) return fail(400, { seccion: 'foto', error: dbErr.message });

		return { seccion: 'foto', ok: true };
	},

	// Quitar la foto subida (vuelve a la de Google o a las iniciales).
	quitarFoto: async ({ locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { seccion: 'foto', error: 'Sesión no válida.' });

		await supabase.storage.from(BUCKET).remove([`${user.id}/avatar`]);
		const { error } = await supabase
			.from('profiles')
			.upsert({ id: user.id, avatar_url: null });
		if (error) return fail(400, { seccion: 'foto', error: error.message });

		return { seccion: 'foto', ok: true };
	},

	// Cambiar la contraseña de la cuenta (pide la actual y la verifica).
	cambiarContrasena: async ({ request, locals: { supabase, safeGetSession } }) => {
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

		// Verificar la contraseña actual reautenticando al mismo usuario.
		const { error: verErr } = await supabase.auth.signInWithPassword({
			email: user.email,
			password: actual
		});
		if (verErr) return fail(400, { seccion: 'clave', error: 'La contraseña actual no es correcta.' });

		const { error } = await supabase.auth.updateUser({ password: nueva });
		if (error) return fail(400, { seccion: 'clave', error: error.message });

		return { seccion: 'clave', ok: true };
	}
};
