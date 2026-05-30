import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import {
	listarHogares,
	elegirHogarActivo,
	cargarMiembros,
	cargarInvitacion
} from '$lib/server/hogares';

export const load: LayoutServerLoad = async ({
	locals: { supabase, user, session },
	cookies
}) => {
	// El hook `authState` ya validó al usuario (getUser) una sola vez por
	// request; reusamos locals en vez de re-llamar safeGetSession() (que vuelve
	// a pegarle a la red y, de paso, hace que este load se re-ejecute en cada
	// navegación). Así el layout queda cacheable y la navegación es instantánea.
	if (!session || !user) {
		redirect(303, '/login');
	}

	// Perfil y lista de hogares son independientes → en paralelo (menos latencia).
	const [{ data: perfilRow }, hogares] = await Promise.all([
		supabase.from('profiles').select('display_name, avatar_url').eq('id', user.id).maybeSingle(),
		listarHogares(supabase, user.id)
	]);

	// Sin hogar todavía → a la bienvenida (crear o unirse).
	if (hogares.length === 0) {
		redirect(303, '/bienvenida');
	}

	// El activo sale de la cookie (o el primero si no hay/ya no aplica).
	const activo = elegirHogarActivo(hogares, cookies)!;

	// Contexto del hogar activo (miembros + invitación), en paralelo. Va en el
	// layout y se cachea: así abrir /hogar es instantáneo (no consulta de nuevo).
	const [miembros, invitacion] = await Promise.all([
		cargarMiembros(supabase, activo.id, user.id),
		cargarInvitacion(supabase, activo.id)
	]);

	const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
	// Prioridad: foto subida por el usuario → foto de Google → sin foto.
	const avatar =
		perfilRow?.avatar_url ||
		(typeof meta.avatar_url === 'string' && meta.avatar_url) ||
		(typeof meta.picture === 'string' && meta.picture) ||
		null;

	return {
		perfil: {
			display_name: perfilRow?.display_name ?? '',
			email: user.email ?? '',
			avatar,
			// true si la foto la subió el usuario (no la de Google) → permite quitarla.
			fotoPropia: !!perfilRow?.avatar_url,
			// Fecha de alta de la cuenta (para "Miembro desde").
			desde: user.created_at ?? null
		},
		hogares,
		hogarActivo: { ...activo, miembros: miembros.length },
		// Datos del hogar activo, cacheados con el layout (los usa /hogar al instante).
		miembros,
		invitacion
	};
};
