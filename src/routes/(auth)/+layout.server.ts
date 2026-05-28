import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { safeGetSession } }) => {
	const { session } = await safeGetSession();
	// Si ya hay sesión, no mostrar login/registro.
	if (session) {
		redirect(303, '/');
	}
	return {};
};
