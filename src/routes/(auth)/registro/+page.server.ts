import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals: { supabase } }) => {
		const formData = await request.formData();
		const email = String(formData.get('email') ?? '').trim();
		const password = String(formData.get('password') ?? '');

		if (!email || !password) {
			return fail(400, { email, error: 'Escribe tu correo y contraseña.' });
		}
		if (password.length < 6) {
			return fail(400, { email, error: 'La contraseña debe tener al menos 6 caracteres.' });
		}

		const { data, error } = await supabase.auth.signUp({ email, password });
		if (error) {
			return fail(400, { email, error: error.message });
		}

		// Con la confirmación de email desactivada, signUp devuelve sesión y el
		// usuario queda logueado. Si estuviera activada, no habría sesión y
		// habría que avisar "revisa tu correo".
		if (!data.session) {
			return fail(400, {
				email,
				error: 'Revisa tu correo para confirmar la cuenta antes de entrar.'
			});
		}

		redirect(303, '/');
	}
};
