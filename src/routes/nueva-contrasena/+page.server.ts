import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { safeGetSession } }) => {
	// Solo se llega aquí con la sesión de recuperación creada por el enlace
	// del correo (vía /auth/callback). Sin sesión, fuera.
	const { session } = await safeGetSession();
	if (!session) {
		redirect(303, '/login');
	}
	return {};
};

export const actions: Actions = {
	default: async ({ request, locals: { supabase } }) => {
		const formData = await request.formData();
		const password = String(formData.get('password') ?? '');
		const confirm = String(formData.get('password_confirm') ?? '');

		if (password.length < 6) {
			return fail(400, { error: 'La contraseña debe tener al menos 6 caracteres.' });
		}
		if (password !== confirm) {
			return fail(400, { error: 'Las contraseñas no coinciden.' });
		}

		const { error } = await supabase.auth.updateUser({ password });
		if (error) {
			return fail(400, { error: error.message });
		}

		redirect(303, '/');
	}
};
