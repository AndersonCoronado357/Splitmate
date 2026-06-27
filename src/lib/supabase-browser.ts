// Reemplazo del cliente de navegador de Supabase. El "realtime" ahora es REAL:
// .channel().subscribe() abre (una sola) conexión SSE a /api/eventos; cuando el
// servidor avisa de un cambio en el hogar, refrescamos los datos (invalidateAll)
// al instante. Las RPC del cliente pasan por /api/rpc.
import { invalidateAll } from '$app/navigation';

let es: EventSource | null = null;
let refs = 0;
let debounce: ReturnType<typeof setTimeout> | null = null;
let visListener: (() => void) | null = null;

function refrescar() {
	if (debounce) clearTimeout(debounce);
	debounce = setTimeout(() => {
		if (typeof document === 'undefined' || document.visibilityState === 'visible') invalidateAll();
	}, 250);
}

function abrir() {
	if (es || typeof window === 'undefined') return;
	es = new EventSource('/api/eventos');
	es.onmessage = (ev) => {
		// El "conectado" inicial no refresca; cualquier evento real sí.
		if (ev.data && ev.data.includes('"tipo":"conectado"')) return;
		refrescar();
	};
	// EventSource reconecta solo si se cae la conexión; no hay que hacer nada.
	// Al volver a la pestaña, refrescamos por si nos perdimos algo mientras oculta.
	visListener = () => {
		if (document.visibilityState === 'visible') refrescar();
	};
	document.addEventListener('visibilitychange', visListener);
}

function cerrar() {
	if (es) {
		es.close();
		es = null;
	}
	if (debounce) {
		clearTimeout(debounce);
		debounce = null;
	}
	if (visListener) {
		document.removeEventListener('visibilitychange', visListener);
		visListener = null;
	}
}

function makeChannel() {
	const chan: {
		on: () => typeof chan;
		subscribe: () => typeof chan;
		_stop: () => void;
	} = {
		on() {
			return chan;
		},
		subscribe() {
			refs++;
			abrir();
			return chan;
		},
		_stop() {
			refs = Math.max(0, refs - 1);
			if (refs === 0) cerrar();
		}
	};
	return chan;
}

export function supabaseBrowser() {
	return {
		realtime: { setAuth(_t?: string) {} },
		channel(_name?: string, _opts?: unknown) {
			return makeChannel();
		},
		removeChannel(chan: { _stop?: () => void } | null) {
			if (chan && chan._stop) chan._stop();
		},
		async rpc(fn: string, args: Record<string, unknown> = {}) {
			try {
				const res = await fetch('/api/rpc', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ fn, args })
				});
				const body = await res.json().catch(() => ({}) as Record<string, unknown>);
				if (!res.ok)
					return { data: null, error: { message: (body as { message?: string })?.message || 'rpc error' } };
				return { data: (body as { data?: unknown }).data ?? null, error: null };
			} catch (e) {
				return { data: null, error: { message: (e as Error).message } };
			}
		}
	};
}
