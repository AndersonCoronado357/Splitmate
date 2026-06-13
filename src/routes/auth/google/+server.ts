import { redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { RequestHandler } from './$types';
import * as auth from '$lib/server/acmsy/auth';
import { randomToken } from '$lib/server/acmsy/security';

export const GET: RequestHandler = async ({ url, cookies }) => {
	if (!auth.googleEnabled()) redirect(303, '/login');
	// El state lleva el subdominio destino al final ("<csrf>~<sub>") para que el
	// relay de acmsy.com sepa a que app reenviar al volver de Google.
	const state = randomToken(16) + auth.oauthStateSuffix();
	cookies.set('acmsy_oauth', state, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		maxAge: 600
	});
	redirect(303, auth.googleAuthUrl(url.origin, state));
};
