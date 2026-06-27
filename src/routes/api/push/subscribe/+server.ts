import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { query } from '$lib/server/db';

// Guarda la suscripción de Web Push del usuario logueado (para enviarle push
// cuando ocurra un evento en su hogar).
export const POST: RequestHandler = async ({ locals, request }) => {
	const user = locals.user;
	if (!user) error(401, 'no auth');
	const sub = await request.json();
	if (!sub?.endpoint) error(400, 'sin suscripcion');
	await query(
		`insert into push_subscriptions (user_id, endpoint, sub) values ($1, $2, $3::jsonb)
		 on conflict (endpoint) do update set user_id = excluded.user_id, sub = excluded.sub`,
		[user.id, sub.endpoint, JSON.stringify(sub)]
	);
	return json({ ok: true });
};

// Quita la suscripción (al desactivar notificaciones).
export const DELETE: RequestHandler = async ({ locals, request }) => {
	const user = locals.user;
	if (!user) error(401, 'no auth');
	const body = await request.json().catch(() => ({}) as { endpoint?: string });
	if (body?.endpoint) {
		await query('delete from push_subscriptions where endpoint = $1', [body.endpoint]);
	} else {
		await query('delete from push_subscriptions where user_id = $1', [user.id]);
	}
	return json({ ok: true });
};
