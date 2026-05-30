import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

// Solo permitimos destinos internos (evita redirecciones abiertas).
function destinoSeguro(next: string | null): string {
	return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export const actions: Actions = {
	default: async ({ request, url, locals: { supabase } }) => {
		const formData = await request.formData();
		const nombre = String(formData.get('nombre') ?? '').trim();
		const email = String(formData.get('email') ?? '').trim();
		const password = String(formData.get('password') ?? '');

		if (!nombre) {
			return fail(400, { nombre, email, error: 'Escribe tu nombre.' });
		}
		if (!email || !password) {
			return fail(400, { nombre, email, error: 'Escribe tu correo y contraseña.' });
		}
		if (password.length < 6) {
			return fail(400, { nombre, email, error: 'La contraseña debe tener al menos 6 caracteres.' });
		}

		// El nombre va en user_metadata como full_name; el trigger handle_new_user
		// lo copia a profiles.display_name y se usa en toda la app.
		const { data, error } = await supabase.auth.signUp({
			email,
			password,
			options: { data: { full_name: nombre } }
		});
		if (error) {
			return fail(400, { nombre, email, error: error.message });
		}

		// Con la confirmación de email desactivada, signUp devuelve sesión.
		if (!data.session) {
			return fail(400, {
				nombre,
				email,
				error: 'Revisa tu correo para confirmar la cuenta antes de entrar.'
			});
		}

		redirect(303, destinoSeguro(url.searchParams.get('next')));
	}
};
