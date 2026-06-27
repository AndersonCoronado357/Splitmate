import type { RequestHandler } from './$types';
import { suscribir } from '$lib/server/eventos';
import { query } from '$lib/server/db';

// Realtime por SSE. La pestaña abre esta conexión; el servidor le envía un evento
// en cuanto cambia algo de su(s) hogar(es), y la app refresca al instante.
export const GET: RequestHandler = async ({ locals }) => {
	const user = locals.user;
	if (!user) return new Response('no auth', { status: 401 });

	const rows = await query<{ hogar_id: string }>(
		'select hogar_id from miembros_hogar where user_id = $1',
		[user.id]
	);
	const hogares = rows.map((r) => r.hogar_id);

	const enc = new TextEncoder();
	let cleanup: Array<() => void> = [];
	let hb: ReturnType<typeof setInterval> | null = null;

	const stream = new ReadableStream({
		async start(controller) {
			const send = (s: string) => {
				try {
					controller.enqueue(enc.encode(s));
				} catch {
					/* conexión cerrada */
				}
			};
			send('retry: 5000\n\n');
			send('data: {"tipo":"conectado"}\n\n');
			for (const h of hogares) {
				const off = await suscribir(h, (e) => send('data: ' + JSON.stringify(e) + '\n\n'));
				cleanup.push(off);
			}
			// Latido cada 25 s para que Cloudflare/Caddy no corten la conexión inactiva.
			hb = setInterval(() => send(': hb\n\n'), 25000);
		},
		cancel() {
			if (hb) clearInterval(hb);
			for (const off of cleanup) {
				try {
					off();
				} catch {
					/* noop */
				}
			}
			cleanup = [];
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': 'text/event-stream',
			'cache-control': 'no-cache, no-transform',
			connection: 'keep-alive',
			'x-accel-buffering': 'no'
		}
	});
};
