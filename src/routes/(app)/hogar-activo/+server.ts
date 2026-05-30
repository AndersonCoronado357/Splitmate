import { json, error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { RequestHandler } from './$types';
import { HOGAR_COOKIE, listarHogares } from '$lib/server/hogares';

// Fija el hogar activo en una cookie. Valida que el usuario pertenezca a ese
// hogar antes de guardarla (no confiamos en el id que llega del cliente).
export const POST: RequestHandler = async ({
	request,
	cookies,
	locals: { supabase, safeGetSession }
}) => {
	const { user } = await safeGetSession();
	if (!user) error(401, 'No autenticado.');

	const body = (await request.json().catch(() => null)) as { id?: string } | null;
	const id = body?.id;
	if (!id) error(400, 'Falta el id del hogar.');

	const hogares = await listarHogares(supabase, user.id);
	if (!hogares.some((h) => h.id === id)) {
		error(403, 'No perteneces a ese hogar.');
	}

	cookies.set(HOGAR_COOKIE, id, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev, // en dev servimos por HTTP (LAN), el navegador descarta Secure
		maxAge: 60 * 60 * 24 * 365 // 1 año
	});

	return json({ ok: true });
};
