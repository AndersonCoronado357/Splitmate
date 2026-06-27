// Web Push real (VAPID). Configura web-push con las claves del entorno y expone
// un helper para enviar. Las notificaciones llegan al telefono via el servicio
// de push del navegador, aunque el navegador este cerrado.
import webpush from 'web-push';
import { env } from '$env/dynamic/private';

let configurado = false;
function configurar(): boolean {
	if (configurado) return true;
	const pub = env.VAPID_PUBLIC;
	const priv = env.VAPID_PRIVATE;
	if (!pub || !priv) return false;
	webpush.setVapidDetails(env.VAPID_SUBJECT || 'mailto:noreply@acmsy.com', pub, priv);
	configurado = true;
	return true;
}

export function vapidPublicKey(): string {
	return env.VAPID_PUBLIC || '';
}

export type PushSub = { endpoint: string; keys: { p256dh: string; auth: string } };

export async function enviarPush(sub: PushSub, payload: Record<string, unknown>): Promise<void> {
	if (!configurar()) throw new Error('VAPID no configurado');
	await webpush.sendNotification(sub as unknown as webpush.PushSubscription, JSON.stringify(payload));
}
