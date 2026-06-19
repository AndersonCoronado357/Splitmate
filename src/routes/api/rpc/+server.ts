import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// RPC que la UI llama directamente desde el navegador (las demas son de servidor).
const PERMITIDAS = new Set(['set_invitacion_activa']);

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) throw error(401, 'No autenticado');
	const { fn, args } = await request.json().catch(() => ({}) as any);
	if (!PERMITIDAS.has(fn)) throw error(403, 'RPC no permitida');
	const { data, error: e } = await locals.supabase.rpc(fn, args ?? {});
	if (e) throw error(400, e.message);
	return json({ data });
};
