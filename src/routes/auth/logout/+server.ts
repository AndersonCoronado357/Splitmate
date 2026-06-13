import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as auth from '$lib/server/acmsy/auth';

export const POST: RequestHandler = async ({ cookies, locals }) => {
	if (locals.user) await auth.markOffline(locals.user.id).catch(() => {});
	auth.clearSession(cookies);
	redirect(303, '/login');
};
