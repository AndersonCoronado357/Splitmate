import { text } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { vapidPublicKey } from '$lib/server/webpush';

// Clave publica VAPID para que el cliente pueda suscribirse al push.
export const GET: RequestHandler = async () => text(vapidPublicKey());
