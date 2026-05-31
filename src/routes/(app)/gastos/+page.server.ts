import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listarGastos, type PerfilMin } from '$lib/server/gastos';

export const load: PageServerLoad = async ({ locals: { supabase, user }, parent, depends }) => {
	if (!user) redirect(303, '/login');
	depends('app:gastos-lista');

	const { hogarActivo, miembros } = await parent();
	if (!hogarActivo) redirect(303, '/bienvenida');

	// Mapa de perfiles ya cargado por el layout → evitamos la query a `profiles`.
	const perfiles = new Map<string, PerfilMin>(
		miembros.map((m) => [m.userId, { display_name: m.nombre, avatar_url: m.avatar }])
	);

	const gastos = await listarGastos(supabase, hogarActivo.id, user.id, perfiles, hogarActivo.moneda);

	return { gastos };
};
