import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as auth from '$lib/server/acmsy/auth';

export const load: PageServerLoad = async ({ url }) => {
	// El token viene en el enlace del correo: /nueva-contrasena?token=XXX
	return { token: url.searchParams.get('token') ?? '' };
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const formData = await request.formData();
		const token = String(formData.get('token') ?? '');
		const password = String(formData.get('password') ?? '');
		const confirm = String(formData.get('password_confirm') ?? '');

		if (password.length < 6) return fail(400, { token, error: 'La contraseña debe tener al menos 6 caracteres.' });
		if (password !== confirm) return fail(400, { token, error: 'Las contraseñas no coinciden.' });

		const userId = await auth.useResetToken(token);
		if (!userId) return fail(400, { token, error: 'El enlace caducó o ya se usó. Pide uno nuevo.' });

		await auth.setPassword(userId, password);
		const user = await auth.findById(userId);
		if (user) {
			auth.setSession(cookies, user);
			await auth.recordLogin(user.id);
		}
		redirect(303, '/');
	}
};
