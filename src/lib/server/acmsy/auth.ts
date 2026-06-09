// Auth de acmsy para Splitmate (sobre PostgreSQL de acmsy, reemplaza a Supabase
// Auth). Los usuarios viven en auth.users (UUID); el trigger handle_new_user
// crea su public.profiles automaticamente. La sesion es una cookie firmada.
import type { Cookies } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { query } from '../db';
import * as sec from './security';
import * as google from './google';
import { sendEmail, passwordResetEmail } from './mailer';

export const APP_NAME = 'Splitmate';
const COOKIE = 'acmsy_session';
const RESET_MINUTES = 30;

export type AuthUser = {
	id: string;
	email: string;
	raw_user_meta_data: Record<string, unknown>;
	password_hash: string | null;
	google_id: string | null;
	email_verified: boolean;
	created_at: string;
};

const norm = (e: string) => String(e || '').trim().toLowerCase();

export async function findByEmail(email: string): Promise<AuthUser | null> {
	const rows = await query<AuthUser>('select * from auth.users where email = $1 limit 1', [norm(email)]);
	return rows[0] ?? null;
}
export async function findById(id: string): Promise<AuthUser | null> {
	const rows = await query<AuthUser>('select * from auth.users where id = $1 limit 1', [id]);
	return rows[0] ?? null;
}

// Crea una cuenta de correo/contrasena. El trigger crea el profile.
export async function createUserPassword(
	email: string,
	password: string,
	name?: string | null
): Promise<AuthUser> {
	const meta = name ? { full_name: name, name } : {};
	const rows = await query<AuthUser>(
		`insert into auth.users (email, password_hash, email_verified, raw_user_meta_data)
		 values ($1, $2, false, $3::jsonb) returning *`,
		[norm(email), sec.hashPassword(password), JSON.stringify(meta)]
	);
	return rows[0];
}

// Busca por correo y vincula Google; si no existe, la crea. (Misma cuenta por
// correo: Google + contrasena no se duplican.)
export async function upsertGoogleUser(p: google.GoogleProfile): Promise<AuthUser> {
	const existing = await findByEmail(p.email);
	const meta = JSON.stringify({ full_name: p.name, name: p.name, picture: p.picture, avatar_url: p.picture });
	if (existing) {
		const rows = await query<AuthUser>(
			`update auth.users set google_id = coalesce(google_id, $2), email_verified = true,
			 raw_user_meta_data = raw_user_meta_data || $3::jsonb where id = $1 returning *`,
			[existing.id, p.googleId, meta]
		);
		return rows[0];
	}
	const rows = await query<AuthUser>(
		`insert into auth.users (email, google_id, email_verified, raw_user_meta_data)
		 values ($1, $2, true, $3::jsonb) returning *`,
		[norm(p.email), p.googleId, meta]
	);
	return rows[0];
}

export async function setPassword(id: string, password: string): Promise<void> {
	await query('update auth.users set password_hash = $2 where id = $1', [id, sec.hashPassword(password)]);
}

export async function recordLogin(id: string): Promise<void> {
	await query(
		'update auth.users set last_login_at = now(), last_seen_at = now(), login_count = login_count + 1 where id = $1',
		[id]
	);
}
export async function touchSeen(id: string): Promise<void> {
	await query(
		"update auth.users set last_seen_at = now() where id = $1 and (last_seen_at is null or last_seen_at < now() - interval '60 seconds')",
		[id]
	);
}
export async function markOffline(id: string): Promise<void> {
	await query('update auth.users set last_seen_at = null where id = $1', [id]);
}

// --- Tokens de recuperacion (un solo uso) ---
export async function createResetToken(userId: string): Promise<string> {
	const token = sec.randomToken(32);
	const expires = new Date(Date.now() + RESET_MINUTES * 60 * 1000);
	await query('insert into auth.tokens (user_id, kind, token_hash, expires_at) values ($1, $2, $3, $4)', [
		userId,
		'reset',
		sec.sha256(token),
		expires
	]);
	return token;
}
export async function useResetToken(rawToken: string): Promise<string | null> {
	const rows = await query<{ id: string; user_id: string; expires_at: string }>(
		'select * from auth.tokens where kind = $1 and token_hash = $2 and used = false limit 1',
		['reset', sec.sha256(rawToken)]
	);
	const t = rows[0];
	if (!t || new Date(t.expires_at).getTime() < Date.now()) return null;
	await query('update auth.tokens set used = true where id = $1', [t.id]);
	return t.user_id;
}

export async function sendResetEmail(email: string, token: string, origin: string): Promise<void> {
	const url = `${origin}/nueva-contrasena?token=${token}`;
	const t = passwordResetEmail({ appName: APP_NAME, url, minutes: RESET_MINUTES });
	await sendEmail({ to: email, subject: t.subject, html: t.html, text: t.text, displayName: APP_NAME });
}

// --- Google helpers (URL + intercambio) ---
export function googleEnabled(): boolean {
	return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

// Relevo de OAuth en acmsy.com: en produccion Google vuelve por acmsy.com/oauth/relay
// y de ahi a esta app, igual que hacia Supabase via su propio dominio. Asi el
// navegador movil (Brave) NO le pega el "modo escritorio" al subdominio. En local
// (sin subdominio acmsy) se usa el callback directo.
// Google vuelve DIRECTO a esta app, en tu propio dominio (sin relevo ni dominio
// aparte). En Brave movil esto deja la app en "modo escritorio" (limite del
// navegador); el login por correo no tiene ese problema.
function googleRedirectUri(origin: string): string {
	return `${origin}/auth/callback`;
}
export function oauthStateSuffix(): string {
	return '';
}

export function googleAuthUrl(origin: string, state: string): string {
	return google.authUrl({
		clientId: env.GOOGLE_CLIENT_ID!,
		redirectUri: googleRedirectUri(origin),
		state
	});
}
export async function googleProfileFromCode(code: string, origin: string): Promise<google.GoogleProfile> {
	const tokens = await google.exchangeCode({
		code,
		clientId: env.GOOGLE_CLIENT_ID!,
		clientSecret: env.GOOGLE_CLIENT_SECRET!,
		redirectUri: googleRedirectUri(origin)
	});
	return google.fetchProfile(tokens.access_token);
}

// --- Sesion (cookie firmada) ---
export function setSession(cookies: Cookies, user: { id: string; email: string }): void {
	cookies.set(COOKIE, sec.sign({ uid: user.id, email: user.email }), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev, // en dev (http) no-secure para que la cookie persista
		maxAge: 60 * 60 * 24 * 30
	});
}
export function clearSession(cookies: Cookies): void {
	cookies.delete(COOKIE, { path: '/' });
}
export function readSessionUid(cookies: Cookies): string | null {
	const raw = cookies.get(COOKIE);
	const data = raw ? sec.unsign<{ uid: string; email: string }>(raw) : null;
	return data?.uid ?? null;
}

// --- Forma de `user` y `session` que espera la app (compatible con Supabase) ---
export function toLocalsUser(u: AuthUser) {
	return {
		id: u.id,
		email: u.email,
		created_at: u.created_at,
		user_metadata: u.raw_user_meta_data ?? {}
	};
}
export function sessionObject() {
	// La app solo lee truthiness y, para el Realtime (ya reemplazado), access_token.
	return { access_token: '', refresh_token: '', expires_at: 0, expires_in: 0, token_type: 'bearer' };
}
