// Endpoint GET para fetchear el detalle de un gasto en JSON.
// Lo usa el modal de /gastos para abrir el detalle sin navegar de URL.
// Devuelve la misma estructura que la página /gastos/[id].
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cargarGasto, type PerfilMin } from '$lib/server/gastos';
import { cargarMiembros, listarHogares, elegirHogarActivo } from '$lib/server/hogares';

export const GET: RequestHandler = async ({ locals, params, cookies }) => {
	const { user } = await locals.safeGetSession();
	if (!user) error(401, 'No autenticado');

	const hogares = await listarHogares(locals.supabase, user.id);
	const activo = elegirHogarActivo(hogares, cookies);
	if (!activo) error(400, 'Sin hogar activo');

	// Necesitamos el mapa de perfiles del hogar para resolver display_name/avatar
	// dentro de cargarGasto (evitando una query extra a `profiles`).
	const miembros = await cargarMiembros(locals.supabase, activo.id, user.id);
	const perfiles = new Map<string, PerfilMin>(
		miembros.map((m) => [m.userId, { display_name: m.nombre, avatar_url: m.avatar }])
	);

	const gasto = await cargarGasto(locals.supabase, params.id, perfiles);
	if (!gasto || gasto.hogarId !== activo.id) error(404, 'Gasto no encontrado');

	// no-store: que el browser NUNCA sirva una versión cacheada de este JSON.
	// Si lo cacheara, después de borrar/agregar un aporte, la próxima petición
	// devolvería data vieja y el aporte borrado aparecería "vuelto a aparecer".
	return json(gasto, { headers: { 'cache-control': 'no-store' } });
};
