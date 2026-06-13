import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as auth from '$lib/server/acmsy/auth';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const expected = cookies.get('acmsy_oauth');
	cookies.delete('acmsy_oauth', { path: '/' });
	if (!code || !state || !expected || state !== expected) redirect(303, '/login?error=oauth');

	let user = null;
	try {
		const profile = await auth.googleProfileFromCode(code, url.origin);
		if (profile.email) user = await auth.upsertGoogleUser(profile);
	} catch (e) {
		console.error('[google callback]', (e as Error).message);
	}
	if (!user) redirect(303, '/login?error=oauth');

	auth.setSession(cookies, user);
	await auth.recordLogin(user.id);
	redirect(303, '/');
};
