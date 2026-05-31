// Cliente de Supabase para el browser, como singleton de módulo.
// Lo creamos una sola vez al primer uso. NO lo metemos en `page.data` porque
// si lo hiciéramos, al hidratar (donde +layout.ts re-crea el client), la
// referencia cambiaría → page.data cambiaría de identidad → todos los
// `$derived(page.data.X)` re-evaluarían → la app entera re-renderizaría
// y el usuario lo percibe como un parpadeo doble al recargar.
import { createBrowserClient } from '@supabase/ssr';
import { browser } from '$app/environment';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$env/static/public';

type Cliente = ReturnType<typeof createBrowserClient>;

let _cliente: Cliente | undefined;

export function supabaseBrowser(): Cliente {
	if (!browser) {
		throw new Error('supabaseBrowser solo debe llamarse en el navegador');
	}
	if (!_cliente) {
		_cliente = createBrowserClient(
			PUBLIC_SUPABASE_URL,
			PUBLIC_SUPABASE_PUBLISHABLE_KEY
		);
	}
	return _cliente;
}
