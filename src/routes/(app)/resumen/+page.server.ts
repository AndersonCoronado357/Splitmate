import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { cargarMovimientos, type MovimientoCrudo } from '$lib/server/resumen';
import { listarCategorias, type Categoria } from '$lib/server/gastos';

// La página /resumen carga TODOS los movimientos del hogar de una vez
// (sin filtros). El cliente computa todos los agregados localmente, así
// que cambiar período / Hogar-Mío / drill-down es instantáneo.
export const load: PageServerLoad = async ({ locals: { supabase, user }, parent }) => {
	if (!user) redirect(303, '/login');

	const { hogarActivo } = await parent();
	if (!hogarActivo) redirect(303, '/bienvenida');

	const [movimientos, categorias] = await Promise.all([
		cargarMovimientos(supabase, hogarActivo.id, user.id),
		listarCategorias(supabase, hogarActivo.id)
	]);

	return {
		movimientos,
		categorias,
		moneda: hogarActivo.moneda
	} satisfies {
		movimientos: MovimientoCrudo[];
		categorias: Categoria[];
		moneda: string;
	};
};
