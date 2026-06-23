import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env as priv } from '$env/dynamic/private';

// Recordatorios mensuales. Deshabilitado en acmsy (no hay transporte de push por
// ahora). Se conserva el endpoint y su auth por CRON_SECRET para no romper el cron.
export const POST: RequestHandler = async ({ request }) => {
	const secretEsperado = priv.CRON_SECRET;
	if (!secretEsperado) throw error(500, 'CRON_SECRET no configurado en el servidor.');
	if ((request.headers.get('x-cron-secret') ?? '') !== secretEsperado) throw error(401, 'No autorizado');
	return json({ ok: true, sent: 0, note: 'push deshabilitado en acmsy' });
};
