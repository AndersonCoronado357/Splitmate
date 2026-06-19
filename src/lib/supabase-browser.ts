// Reemplazo del cliente de navegador de Supabase. acmsy no tiene realtime, asi
// que convertimos cualquier suscripcion en POLLING: .channel().subscribe()
// arranca un intervalo que refresca los datos (invalidateAll) mientras la
// pestana este visible. Las RPC del cliente pasan por /api/rpc.
import { invalidateAll } from '$app/navigation';

function makeChannel() {
	let id: ReturnType<typeof setInterval> | null = null;
	const chan: any = {
		on() {
			return chan;
		},
		subscribe() {
			if (id == null && typeof document !== 'undefined') {
				id = setInterval(() => {
					if (document.visibilityState === 'visible') invalidateAll();
				}, 12000);
			}
			return chan;
		},
		_stop() {
			if (id != null) {
				clearInterval(id);
				id = null;
			}
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
		removeChannel(chan: any) {
			if (chan && chan._stop) chan._stop();
		},
		async rpc(fn: string, args: Record<string, unknown> = {}) {
			try {
				const res = await fetch('/api/rpc', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ fn, args })
				});
				const body = await res.json().catch(() => ({}) as any);
				if (!res.ok) return { data: null, error: { message: body?.message || 'rpc error' } };
				return { data: body.data ?? null, error: null };
			} catch (e: any) {
				return { data: null, error: { message: e.message } };
			}
		}
	};
}
