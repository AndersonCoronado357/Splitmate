import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import * as auth from '$lib/server/acmsy/auth';
import { verifyPassword } from '$lib/server/acmsy/security';

// Solo permitimos destinos internos (evita redirecciones abiertas).
function destinoSeguro(next: string | null): string {
	return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export const actions: Actions = {
	default: async ({ request, url, cookies }) => {
		const formData = await request.formData();
		const email = String(formData.get('email') ?? '').trim();
		const password = String(formData.get('password') ?? '');

		if (!email || !password) {
			return fail(400, { email, error: 'Escribe tu correo y contraseña.' });
		}

		const user = await auth.findByEmail(email);
		if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
			return fail(400, { email, error: 'Correo o contraseña incorrectos.' });
		}

		auth.setSession(cookies, user);
		await auth.recordLogin(user.id);
		redirect(303, destinoSeguro(url.searchParams.get('next')));
	}
};
