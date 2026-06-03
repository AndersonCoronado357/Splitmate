import type { LayoutServerLoad } from './$types';

// El hook `authState` (hooks.server.ts) ya validó al usuario UNA vez por
// request y dejó session+user en locals. Los reusamos en vez de volver a
// llamar `safeGetSession()` (que pegaría otra vez a Supabase Auth).
//
// IMPORTANTE: NO devolvemos el `session` crudo de Supabase. Su `.user`
// está wrappeado con un Proxy que emite el warning
//   "Using the user object as returned from supabase.auth.getSession()..."
// cada vez que se accede. Cuando SvelteKit serializa el objeto para
// mandarlo al cliente itera todas las propiedades → dispara el warning.
// Reconstruimos un objeto plano con SOLO los campos que el cliente
// necesita (access_token para Realtime, expires_at, etc.). El `user`
// validado va separado.
export const load: LayoutServerLoad = async ({ locals: { session, user }, cookies }) => {
	const sessionPlana = session
		? {
				access_token: session.access_token,
				refresh_token: session.refresh_token,
				expires_at: session.expires_at,
				expires_in: session.expires_in,
				token_type: session.token_type
			}
		: null;

	return {
		session: sessionPlana,
		user,
		cookies: cookies.getAll()
	};
};
