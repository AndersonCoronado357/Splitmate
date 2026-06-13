import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import * as auth from '$lib/server/acmsy/auth';

function destinoSeguro(next: string | null): string {
	return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export const actions: Actions = {
	default: async ({ request, url, cookies }) => {
		const formData = await request.formData();
		const nombre = String(formData.get('nombre') ?? '').trim();
		const email = String(formData.get('email') ?? '').trim();
		const password = String(formData.get('password') ?? '');

		if (!nombre) return fail(400, { nombre, email, error: 'Escribe tu nombre.' });
		if (!email || !password) return fail(400, { nombre, email, error: 'Escribe tu correo y contraseña.' });
		if (password.length < 6)
			return fail(400, { nombre, email, error: 'La contraseña debe tener al menos 6 caracteres.' });

		const existing = await auth.findByEmail(email);
		let user;
		if (existing) {
			if (existing.password_hash)
				return fail(400, { nombre, email, error: 'Ya existe una cuenta con ese correo. Inicia sesión.' });
			// Existe vía Google: le añadimos contraseña (misma cuenta, no se duplica).
			await auth.setPassword(existing.id, password);
			user = existing;
		} else {
			user = await auth.createUserPassword(email, password, nombre);
		}

		auth.setSession(cookies, user);
		await auth.recordLogin(user.id);
		redirect(303, destinoSeguro(url.searchParams.get('next')));
	}
};
