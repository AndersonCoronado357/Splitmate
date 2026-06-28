import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { listarCategorias } from '$lib/server/gastos';
import { elegirHogarActivo, listarHogares } from '$lib/server/hogares';
import { enviarPushAUsuarios } from '$lib/server/push';

export const load: PageServerLoad = async ({
	locals: { supabase, user },
	parent
}) => {
	if (!user) redirect(303, '/login');
	const { hogarActivo } = await parent();
	if (!hogarActivo) redirect(303, '/bienvenida');

	const categorias = await listarCategorias(supabase, hogarActivo.id);
	return { categorias };
};

export const actions: Actions = {
	default: async ({ request, locals: { supabase, user }, cookies }) => {
		if (!user) redirect(303, '/login');
		const hogarActivo = elegirHogarActivo(
			await listarHogares(supabase, user.id),
			cookies
		);
		if (!hogarActivo) return fail(400, { error: 'No hay hogar activo.' });

		const fd = await request.formData();
		const nombre = String(fd.get('nombre') ?? '').trim();
		const montoStr = String(fd.get('monto') ?? '').trim();
		const modo = String(fd.get('modo') ?? 'iguales');
		const categoriaRaw = String(fd.get('categoria') ?? '').trim();
		const categoria = categoriaRaw ? categoriaRaw : null;
		const diaStr = String(fd.get('dia_vencimiento') ?? '1').trim();
		const notas = String(fd.get('notas') ?? '').trim() || null;
		const divisionesRaw = String(fd.get('divisiones') ?? '[]');

		if (!nombre)
			return fail(400, { error: 'Escribe un nombre.', valores: Object.fromEntries(fd) });
		const monto = Number(montoStr);
		if (!Number.isFinite(monto) || monto <= 0) {
			return fail(400, { error: 'Monto inválido.', valores: Object.fromEntries(fd) });
		}
		if (!['iguales', 'porcentaje', 'exacto', 'partes'].includes(modo)) {
			return fail(400, { error: 'Modo inválido.', valores: Object.fromEntries(fd) });
		}
		let diaVencimiento = parseInt(diaStr, 10);
		if (!Number.isFinite(diaVencimiento)) diaVencimiento = 1;
		if (diaVencimiento < 1) diaVencimiento = 1;
		if (diaVencimiento > 28) diaVencimiento = 28;

		let divisiones: Array<{ participante_id: string; valor: number }>;
		try {
			divisiones = JSON.parse(divisionesRaw);
		} catch {
			return fail(400, {
				error: 'Distribución inválida.',
				valores: Object.fromEntries(fd)
			});
		}
		if (!Array.isArray(divisiones) || divisiones.length === 0) {
			return fail(400, {
				error: 'Selecciona al menos un participante.',
				valores: Object.fromEntries(fd)
			});
		}

		const { data: nuevoId, error } = await supabase.rpc('registrar_gasto_fijo', {
			p_hogar: hogarActivo.id,
			p_nombre: nombre,
			p_monto: monto,
			p_modo: modo,
			p_categoria: categoria,
			p_dia_vencimiento: diaVencimiento,
			p_notas: notas,
			p_divisiones: divisiones
		});
		if (error) {
			return fail(400, { error: error.message, valores: Object.fromEntries(fd) });
		}

		// Aviso a los demás participantes (no a mí). Best-effort: si el push falla
		// no rompemos la creación del gasto fijo.
		const otrosIds = divisiones
			.map((d) => d.participante_id)
			.filter((id) => id && id !== user.id);
		if (otrosIds.length > 0) {
			const { data: perfil } = await supabase
				.from('profiles')
				.select('display_name')
				.eq('id', user.id)
				.maybeSingle();
			const quien = perfil?.display_name || 'Alguien';
			try {
				await enviarPushAUsuarios(otrosIds, {
					title: `${quien} agregó un gasto fijo`,
					body: `${nombre} — toca para verlo`,
					url: `/fijos/${nuevoId}`
				});
			} catch {
				/* best-effort */
			}
		}

		redirect(303, `/fijos/${nuevoId}`);
	}
};
