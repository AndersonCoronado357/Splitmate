import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

// Solo permitimos destinos internos (evita redirecciones abiertas).
function destinoSeguro(next: string | null): string {
	return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export const actions: Actions = {
	default: async ({ request, url, locals: { supabase } }) => {
		const formData = await request.formData();
		const email = String(formData.get('email') ?? '').trim();
		const password = String(formData.get('password') ?? '');

		if (!email || !password) {
			return fail(400, { email, error: 'Escribe tu correo y contraseña.' });
		}

		const { error } = await supabase.auth.signInWithPassword({ email, password });
		if (error) {
			return fail(400, { email, error: 'Correo o contraseña incorrectos.' });
		}

		redirect(303, destinoSeguro(url.searchParams.get('next')));
	}
};
