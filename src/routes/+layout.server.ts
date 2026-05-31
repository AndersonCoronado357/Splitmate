import type { LayoutServerLoad } from './$types';

// El hook `authState` (hooks.server.ts) ya validó al usuario UNA vez por
// request y dejó session+user en locals. Los reusamos en vez de volver a
// llamar `safeGetSession()` (que pegaría otra vez a Supabase Auth).
// El `user` también se devuelve al cliente para que el +layout.ts NO tenga
// que re-validar con la red al hidratar (era la causa del doble parpadeo).
export const load: LayoutServerLoad = async ({ locals: { session, user }, cookies }) => {
	return {
		session,
		user,
		cookies: cookies.getAll()
	};
};
