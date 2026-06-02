// ============================================================
// Notificaciones server-side — broadcast vía Supabase Realtime.
//
// Splitmate quitó Web Push (FCM/WNS/MPNS lo rechazan en muchos
// navegadores). Sólo usamos broadcast: el cliente conectado al canal
// `user-notif:<userId>` (via `AppNotifier.svelte`) recibe el payload y
// muestra una `Notification` nativa. Llega con la pestaña abierta.
//
// Uso típico desde una server action:
//   await enviarPushAUsuario(userId, {
//     title: 'Te incluyeron en un gasto',
//     body: 'Anderson registró "Mercado" — tu parte: $25.000',
//     url: '/gastos/abc',
//     tag: 'gasto:abc'
//   });
// ============================================================

import { env as priv } from '$env/dynamic/private';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';

// Cliente con service_role: permite enviar broadcasts a canales de
// otros usuarios sin pelearse con RLS.
let _serviceClient: SupabaseClient | null = null;
function service(): SupabaseClient {
	if (_serviceClient) return _serviceClient;
	const key = priv.SUPABASE_SECRET_KEY;
	if (!key) throw new Error('SUPABASE_SECRET_KEY no configurado.');
	_serviceClient = createClient(PUBLIC_SUPABASE_URL, key, {
		auth: { autoRefreshToken: false, persistSession: false }
	});
	return _serviceClient;
}

export type PushPayload = {
	title: string;
	body?: string;
	url?: string;
	tag?: string;
	icon?: string;
	badge?: string;
};

// Manda un broadcast al canal privado del usuario. Si el cliente está
// conectado (pestaña abierta), `AppNotifier` lo escucha y muestra la
// notificación. Si no, el evento se pierde — Splitmate no persiste
// notificaciones, este es el trade-off de no usar Web Push.
async function broadcastA(userId: string, payload: PushPayload): Promise<void> {
	try {
		const canal = service().channel(`user-notif:${userId}`, {
			config: { broadcast: { ack: false, self: false } }
		});
		await new Promise<void>((resolve) => {
			canal.subscribe((status: string) => {
				if (status === 'SUBSCRIBED') resolve();
				else if (
					status === 'CHANNEL_ERROR' ||
					status === 'TIMED_OUT' ||
					status === 'CLOSED'
				) {
					resolve(); // best-effort: no bloqueamos la acción
				}
			});
		});
		await canal.send({ type: 'broadcast', event: 'notif', payload });
		// Cleanup async (no esperamos)
		void service().removeChannel(canal);
	} catch (e) {
		console.warn('[notif] broadcast falló', e);
	}
}

/**
 * Notifica al usuario con la pestaña abierta. Best-effort: si Realtime
 * está caído o el usuario no está conectado, no rompe la acción
 * principal (el push es complemento, no requisito).
 */
export async function enviarPushAUsuario(userId: string, payload: PushPayload): Promise<void> {
	await broadcastA(userId, payload);
}

/**
 * Notifica a varios usuarios a la vez (p.ej. todos los participantes
 * de un gasto recién creado). Hace un broadcast por canal en paralelo.
 */
export async function enviarPushAUsuarios(userIds: string[], payload: PushPayload): Promise<void> {
	const unicos = [...new Set(userIds)];
	if (unicos.length === 0) return;
	await Promise.all(unicos.map((u) => broadcastA(u, payload)));
}
