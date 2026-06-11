import type { Handle } from '@sveltejs/kit';
import { createDb } from '$lib/server/sb';
import * as auth from '$lib/server/acmsy/auth';

// Auth de acmsy: lee la cookie de sesion firmada, valida al usuario contra la
// base, y deja en locals el usuario, la sesion y el "cliente de datos"
// (adaptador compatible con Supabase sobre pg+RLS, con el usuario ya fijado).
export const handle: Handle = async ({ event, resolve }) => {
	const uid = auth.readSessionUid(event.cookies);
	let user: ReturnType<typeof auth.toLocalsUser> | null = null;
	if (uid) {
		const row = await auth.findById(uid);
		if (row) {
			user = auth.toLocalsUser(row);
			auth.touchSeen(uid).catch(() => {});
		}
	}

	event.locals.user = user;
	event.locals.session = user ? auth.sessionObject() : null;
	event.locals.supabase = createDb(user ? user.id : null);
	event.locals.safeGetSession = async () => ({
		session: event.locals.session,
		user: event.locals.user
	});

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range';
		}
	});
};
