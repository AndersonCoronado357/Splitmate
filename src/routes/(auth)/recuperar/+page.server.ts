import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import * as auth from '$lib/server/acmsy/auth';

export const actions: Actions = {
	default: async ({ request, url }) => {
		const formData = await request.formData();
		const email = String(formData.get('email') ?? '').trim();
		if (!email) return fail(400, { email, error: 'Escribe tu correo.' });

		const user = await auth.findByEmail(email);
		if (user) {
			try {
				const token = await auth.createResetToken(user.id);
				await auth.sendResetEmail(user.email, token, url.origin);
			} catch (e) {
				console.error('[recuperar] no se pudo enviar el correo:', (e as Error).message);
			}
		}
		// Por privacidad, misma respuesta exista o no la cuenta.
		return { sent: true, email };
	}
};
