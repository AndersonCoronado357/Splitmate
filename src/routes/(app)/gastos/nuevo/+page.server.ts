import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { listarCategorias } from '$lib/server/gastos';
import { elegirHogarActivo, listarHogares } from '$lib/server/hogares';

export const load: PageServerLoad = async ({ locals: { supabase, user }, parent }) => {
	if (!user) redirect(303, '/login');
	const { hogarActivo } = await parent();
	if (!hogarActivo) redirect(303, '/bienvenida');

	const categorias = await listarCategorias(supabase, hogarActivo.id);
	return { categorias };
};

export const actions: Actions = {
	default: async ({ request, locals: { supabase, user }, cookies }) => {
		if (!user) redirect(303, '/login');
		// `parent()` no existe en acciones → resolvemos el hogar activo desde la cookie.
		const hogarActivo = elegirHogarActivo(await listarHogares(supabase, user.id), cookies);
		if (!hogarActivo) return fail(400, { error: 'No hay hogar activo.' });

		const fd = await request.formData();
		const titulo = String(fd.get('titulo') ?? '').trim();
		const montoStr = String(fd.get('monto') ?? '').trim();
		const fecha = String(fd.get('fecha') ?? '').trim() || null;
		const categoriaRaw = String(fd.get('categoria') ?? '').trim();
		const categoria = categoriaRaw ? categoriaRaw : null;
		const modo = String(fd.get('modo') ?? 'iguales');
		const notas = String(fd.get('notas') ?? '').trim() || null;
		const divisionesRaw = String(fd.get('divisiones') ?? '[]');

		if (!titulo) return fail(400, { error: 'Escribe un título.', valores: Object.fromEntries(fd) });
		const monto = Number(montoStr.replace(/[.\s,]/g, (s) => (s === ',' ? '.' : '')));
		if (!Number.isFinite(monto) || monto <= 0) {
			return fail(400, { error: 'Monto inválido.', valores: Object.fromEntries(fd) });
		}
		if (!['iguales', 'porcentaje', 'exacto', 'partes'].includes(modo)) {
			return fail(400, { error: 'Modo inválido.', valores: Object.fromEntries(fd) });
		}

		let divisiones: Array<{ participante_id: string; monto: number }>;
		try {
			divisiones = JSON.parse(divisionesRaw);
		} catch {
			return fail(400, { error: 'Divisiones inválidas.', valores: Object.fromEntries(fd) });
		}
		if (!Array.isArray(divisiones) || divisiones.length === 0) {
			return fail(400, {
				error: 'Selecciona al menos un participante.',
				valores: Object.fromEntries(fd)
			});
		}

		const { data: nuevoId, error } = await supabase.rpc('registrar_gasto', {
			p_hogar: hogarActivo.id,
			p_categoria: categoria,
			p_titulo: titulo,
			p_monto: monto,
			p_fecha: fecha,
			p_modo: modo,
			p_notas: notas,
			p_divisiones: divisiones
		});
		if (error) {
			return fail(400, { error: error.message, valores: Object.fromEntries(fd) });
		}

		redirect(303, `/gastos/${nuevoId}`);
	}
};
