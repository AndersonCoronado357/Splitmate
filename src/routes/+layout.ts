import type { LayoutLoad } from './$types';

// Solo forwardeamos session/user al cliente. El supabase del browser se
// instancia LAZY y como singleton en `$lib/supabase-browser.ts`, así NO entra
// en page.data — eso evita que al hidratar cambie la identidad del objeto
// page.data y se gatille un re-render de toda la app (= doble parpadeo).
export const load: LayoutLoad = async ({ data, depends }) => {
	depends('supabase:auth');
	return { session: data.session, user: data.user };
};
