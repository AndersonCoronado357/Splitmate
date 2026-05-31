import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Pantalla principal: muestra el balance del usuario con cada otro miembro del
// hogar activo. Llamamos al RPC `balance_hogar` (migración 010) que entrega
// el saldo neto ya con aportes restados. Los datos de cada miembro
// (display_name + avatar) se reusan del mapa que ya cargó el layout.
export type SaldoPorPersona = {
	id: string;
	nombre: string;
	avatar: string | null;
	saldo: number;
};

export type ResumenInicio = {
	saldoNeto: number;
	aFavor: number;
	enContra: number;
	personas: SaldoPorPersona[];
};

export const load: PageServerLoad = async ({
	locals: { supabase, user },
	parent,
	depends
}) => {
	if (!user) redirect(303, '/login');
	// Para que las acciones de gastos/aportes/categorías puedan invalidar
	// SOLO la pantalla principal cuando cambie el balance, sin re-correr el layout.
	depends('app:inicio');

	const { hogarActivo, miembros } = await parent();
	if (!hogarActivo) redirect(303, '/bienvenida');

	const { data: filas, error } = await supabase.rpc('balance_hogar', {
		p_hogar: hogarActivo.id
	});

	if (error) {
		// Si la función falla (raro), devolvemos una vista vacía en lugar de
		// romper la pantalla; el usuario al menos ve la cabecera.
		const vacio: ResumenInicio = { saldoNeto: 0, aFavor: 0, enContra: 0, personas: [] };
		return { resumen: vacio };
	}

	const pares = ((filas ?? []) as Array<{ otro_id: string; saldo: number | string }>).map(
		(f) => {
			const m = miembros.find((mm) => mm.userId === f.otro_id);
			return {
				id: f.otro_id,
				nombre: m?.nombre || 'Sin nombre',
				avatar: m?.avatar ?? null,
				saldo: Number(f.saldo)
			} satisfies SaldoPorPersona;
		}
	);

	// Solo mostramos a la gente con saldo distinto de 0 (los que están en cero
	// no aportan información; aparecen igualmente en /hogar si querés verlos).
	const personas = pares
		.filter((p) => Math.abs(p.saldo) > 0.01)
		.sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo));

	const saldoNeto = personas.reduce((acc, p) => acc + p.saldo, 0);
	const aFavor = personas.filter((p) => p.saldo > 0).reduce((s, p) => s + p.saldo, 0);
	const enContra = personas.filter((p) => p.saldo < 0).reduce((s, p) => s - p.saldo, 0);

	const resumen: ResumenInicio = {
		saldoNeto,
		aFavor,
		enContra,
		personas
	};

	return { resumen };
};
