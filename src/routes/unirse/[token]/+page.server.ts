import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Consume un link de invitación: /unirse/<token>.
// - Sin sesión → a login, recordando volver aquí (next).
// - Con sesión → intenta unirse por token y manda a la app.
export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();

	if (!user) {
		const next = encodeURIComponent(`/unirse/${params.token}`);
		redirect(303, `/login?next=${next}`);
	}

	const { error } = await supabase.rpc('unirse_por_token', { p_token: params.token });
	if (error) {
		// Token inválido, caducado o mal formado.
		redirect(303, '/enlace-invalido');
	}

	redirect(303, '/');
};
