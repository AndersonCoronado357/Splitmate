import { fail, redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { Cookies } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { HOGAR_COOKIE } from '$lib/server/hogares';

// Deja un hogar como activo (mismo criterio de cookie que el resto de la app).
function fijarActivo(cookies: Cookies, id: string) {
	cookies.set(HOGAR_COOKIE, id, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		maxAge: 60 * 60 * 24 * 365
	});
}

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();
	if (!session || !user) {
		redirect(303, '/login');
	}

	// La bienvenida es SOLO la primera vez (cuando no tiene ningún hogar). Para
	// crear/unirse a OTRO hogar existe /hogar/nuevo dentro de la app.
	const { data: filas } = await supabase
		.from('miembros_hogar')
		.select('hogar_id')
		.eq('user_id', user.id)
		.limit(1);
	if ((filas ?? []).length > 0) {
		redirect(303, '/');
	}

	// Nombre para el saludo (perfil → metadatos → prefijo del correo).
	const { data: perfil } = await supabase
		.from('profiles')
		.select('display_name')
		.eq('id', user.id)
		.maybeSingle();

	const nombre =
		perfil?.display_name ||
		(user.user_metadata?.full_name as string | undefined) ||
		(user.user_metadata?.name as string | undefined) ||
		user.email?.split('@')[0] ||
		'';

	return { nombre };
};

export const actions: Actions = {
	crear: async ({ request, locals: { supabase }, cookies }) => {
		const fd = await request.formData();
		const nombre = String(fd.get('nombre') ?? '').trim();
		const moneda = String(fd.get('moneda') ?? 'COP').trim() || 'COP';

		if (!nombre) {
			return fail(400, { modo: 'crear', error: 'Escribe el nombre del hogar.' });
		}

		const { data: nuevoId, error } = await supabase.rpc('crear_hogar', {
			p_nombre: nombre,
			p_moneda: moneda
		});
		if (error) {
			return fail(400, { modo: 'crear', error: error.message });
		}

		// El hogar recién creado queda como activo.
		if (typeof nuevoId === 'string') fijarActivo(cookies, nuevoId);

		redirect(303, '/');
	},

	unir: async ({ request, locals: { supabase }, cookies }) => {
		const fd = await request.formData();
		const codigo = String(fd.get('codigo') ?? '').trim();

		if (!codigo) {
			return fail(400, { modo: 'unir', error: 'Escribe el código de invitación.' });
		}

		const { data: nuevoId, error } = await supabase.rpc('unirse_a_hogar', { p_codigo: codigo });
		if (error) {
			return fail(400, { modo: 'unir', error: 'Código inválido o expirado.' });
		}

		// El hogar al que me uní queda como activo.
		if (typeof nuevoId === 'string') fijarActivo(cookies, nuevoId);

		redirect(303, '/');
	}
};
