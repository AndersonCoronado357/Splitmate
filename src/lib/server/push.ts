// Notificaciones server-side por Web Push. Las acciones de la app llaman a estas
// funciones con el/los usuario(s) destinatario(s) y un texto ya personalizado
// ("Ana registró un gasto", "Confirmaron tu pago"...). Aquí solo es el transporte:
// buscamos las suscripciones de esos usuarios y enviamos el push.
import { query } from './db';
import { enviarPush, type PushSub } from './webpush';

export type PushPayload = {
	title: string;
	body?: string;
	url?: string;
	tag?: string;
	icon?: string;
	badge?: string;
};

export async function enviarPushAUsuarios(userIds: string[], payload: PushPayload): Promise<void> {
	const ids = [...new Set((userIds || []).filter(Boolean))];
	if (ids.length === 0) return;
	const subs = await query<{ sub: PushSub; endpoint: string }>(
		'select sub, endpoint from push_subscriptions where user_id = any($1::uuid[])',
		[ids]
	);
	if (subs.length === 0) return;
	const cuerpo = {
		title: payload.title,
		body: payload.body || '',
		url: payload.url || '/',
		icon: payload.icon || '/apple-touch-icon.png',
		tag: payload.tag
	};
	await Promise.all(
		subs.map(async (r) => {
			try {
				await enviarPush(r.sub, cuerpo);
			} catch (err) {
				// Suscripción caducada/cancelada en el navegador → limpiarla.
				const code = (err as { statusCode?: number })?.statusCode;
				if (code === 404 || code === 410) {
					await query('delete from push_subscriptions where endpoint = $1', [r.endpoint]).catch(
						() => {}
					);
				}
			}
		})
	);
}

export async function enviarPushAUsuario(userId: string, payload: PushPayload): Promise<void> {
	return enviarPushAUsuarios([userId], payload);
}
