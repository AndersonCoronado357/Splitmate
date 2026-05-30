import type { SupabaseClient } from '@supabase/supabase-js';
import type { Cookies } from '@sveltejs/kit';

// Cookie que recuerda cuál es el hogar activo del usuario (por dispositivo).
export const HOGAR_COOKIE = 'hogar_activo';

export type HogarMin = { id: string; nombre: string; moneda: string; rol: string };

// Todos los hogares del usuario (la RLS ya limita a los suyos), del más antiguo
// al más nuevo: así el "primero" es estable y sirve de predeterminado.
export async function listarHogares(
	supabase: SupabaseClient,
	userId: string
): Promise<HogarMin[]> {
	const { data } = await supabase
		.from('miembros_hogar')
		.select('rol, created_at, hogares ( id, nombre, moneda )')
		.eq('user_id', userId)
		.order('created_at', { ascending: true });

	type Fila = { rol: string; hogares: unknown };
	return ((data ?? []) as Fila[])
		.map((f) => {
			const h = (Array.isArray(f.hogares) ? f.hogares[0] : f.hogares) as
				| { id: string; nombre: string; moneda: string }
				| undefined;
			return h ? { id: h.id, nombre: h.nombre, moneda: h.moneda, rol: f.rol } : null;
		})
		.filter((h): h is HogarMin => h !== null);
}

// Hogar activo: el de la cookie si sigo siendo miembro; si no, el primero.
export function elegirHogarActivo(hogares: HogarMin[], cookies: Cookies): HogarMin | null {
	if (hogares.length === 0) return null;
	const id = cookies.get(HOGAR_COOKIE);
	return hogares.find((h) => h.id === id) ?? hogares[0];
}

export type MiembroHogar = {
	userId: string;
	rol: string;
	nombre: string;
	avatar: string | null;
	soyYo: boolean;
};

// Miembros del hogar (+ perfiles), ordenados: admins primero; yo primero; luego
// por nombre. Se cachea con el layout para que /hogar abra sin consultar.
export async function cargarMiembros(
	supabase: SupabaseClient,
	hogarId: string,
	miId: string
): Promise<MiembroHogar[]> {
	const { data: ms } = await supabase
		.from('miembros_hogar')
		.select('user_id, rol')
		.eq('hogar_id', hogarId);

	const ids = (ms ?? []).map((m) => m.user_id);
	const { data: profs } = ids.length
		? await supabase.from('profiles').select('id, display_name, avatar_url').in('id', ids)
		: { data: [] as { id: string; display_name: string; avatar_url: string | null }[] };

	const mapa = new Map((profs ?? []).map((p) => [p.id, p]));

	return (ms ?? [])
		.map((m) => ({
			userId: m.user_id,
			rol: m.rol as string,
			nombre: mapa.get(m.user_id)?.display_name || 'Sin nombre',
			avatar: mapa.get(m.user_id)?.avatar_url || null,
			soyYo: m.user_id === miId
		}))
		.sort((a, b) => {
			if (a.rol !== b.rol) return a.rol === 'admin' ? -1 : 1;
			if (a.soyYo !== b.soyYo) return a.soyYo ? -1 : 1;
			return a.nombre.localeCompare(b.nombre);
		});
}

export type InvitacionHogar = {
	codigo: string;
	token: string;
	expira: string;
	activa: boolean;
};

// Invitación del hogar. Solo el admin la ve (la RLS lo refuerza → null si no).
export async function cargarInvitacion(
	supabase: SupabaseClient,
	hogarId: string
): Promise<InvitacionHogar | null> {
	const { data } = await supabase
		.from('invitaciones')
		.select('codigo, token, expires_at, activa')
		.eq('hogar_id', hogarId)
		.order('created_at', { ascending: false })
		.limit(1)
		.maybeSingle();
	if (!data) return null;
	return {
		codigo: data.codigo as string,
		token: data.token as string,
		expira: data.expires_at as string,
		activa: data.activa as boolean
	};
}
