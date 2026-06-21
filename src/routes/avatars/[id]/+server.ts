import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readAvatar } from '$lib/server/avatars';

export const GET: RequestHandler = async ({ params }) => {
	const a = await readAvatar(params.id);
	if (!a) throw error(404, 'sin avatar');
	return new Response(new Uint8Array(a.bytes), {
		headers: { 'content-type': a.type, 'cache-control': 'public, max-age=3600' }
	});
};
