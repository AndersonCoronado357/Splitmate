import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Cierre del flujo OAuth (Google): Supabase redirige aquí con un ?code que
// intercambiamos por una sesión y luego mandamos al usuario a la app.
export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	const code = url.searchParams.get('code');
	const next = url.searchParams.get('next') ?? '/';

	if (code) {
		const { error } = await supabase.auth.exchangeCodeForSession(code);
		if (!error) {
			redirect(303, next);
		}
	}

	redirect(303, '/login?error=oauth');
};
