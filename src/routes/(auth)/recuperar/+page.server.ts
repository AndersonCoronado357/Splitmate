import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, url, locals: { supabase } }) => {
		const formData = await request.formData();
		const email = String(formData.get('email') ?? '').trim();

		if (!email) {
			return fail(400, { email, error: 'Escribe tu correo.' });
		}

		const { error } = await supabase.auth.resetPasswordForEmail(email, {
			redirectTo: `${url.origin}/auth/callback?next=/nueva-contrasena`
		});

		if (error) {
			return fail(400, { email, error: error.message });
		}

		// Por privacidad, mostramos "enviado" exista o no la cuenta.
		return { sent: true, email };
	}
};
