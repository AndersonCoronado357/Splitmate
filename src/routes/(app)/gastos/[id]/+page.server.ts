import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { cargarGasto, type PerfilMin } from '$lib/server/gastos';

export const load: PageServerLoad = async ({
	locals: { supabase, user },
	params,
	parent,
	depends
}) => {
	if (!user) redirect(303, '/login');
	// Dependencia local: la usamos para invalidar SOLO el detalle del gasto tras
	// un aporte/borrar/etc., sin volver a pedir la sesión/hogar/miembros (el
	// layout NO depende de este key, así que no se vuelve a correr).
	depends('app:gasto-detalle');
	const { hogarActivo, miembros } = await parent();
	if (!hogarActivo) redirect(303, '/bienvenida');

	// Mapa de perfiles (display_name + avatar) ya viene del layout. Lo reusamos
	// aquí para evitar otra query a `profiles` al cargar el gasto.
	const perfiles = new Map<string, PerfilMin>(
		miembros.map((m) => [m.userId, { display_name: m.nombre, avatar_url: m.avatar }])
	);

	const gasto = await cargarGasto(supabase, params.id, perfiles);
	if (!gasto) error(404, 'Gasto no encontrado');
	// La RLS ya garantiza que solo veas gastos de tu hogar; este chequeo es
	// defensivo por si la URL apunta a otro hogar al que perteneces y no es el
	// activo (raro, pero limpio).
	if (gasto.hogarId !== hogarActivo.id) error(404, 'Gasto no encontrado');

	return { gasto };
};

export const actions: Actions = {
	borrar: async ({ locals: { supabase, user }, params }) => {
		if (!user) redirect(303, '/login');

		const { error, count } = await supabase
			.from('gastos_compartidos')
			.delete({ count: 'exact' })
			.eq('id', params.id);
		// La RLS limita el delete a quien sea pagador; si no, error.
		if (error) return fail(400, { error: error.message });
		if (!count) {
			return fail(403, {
				seccion: 'borrar',
				error: 'No se pudo borrar el gasto (sin permisos o ya no existe).'
			});
		}

		// No redireccionamos. El cliente (modal en /gastos o página /gastos/[id])
		// decide qué hacer tras éxito (cerrar modal o navegar a /gastos).
		return { seccion: 'borrar', ok: true };
	},

	// Registrar un aporte (pago parcial o total) a una división del gasto.
	//   * Si lo registra el DEUDOR (participante de la división) → estado
	//     'pendiente' hasta que el pagador del gasto confirme. Mi vista lo
	//     descuenta al instante; la del cobrador no.
	//   * Si lo registra el PAGADOR del gasto → estado 'confirmado' directo:
	//     él es la autoridad de cobro.
	aportar: async ({ request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/login');

		const fd = await request.formData();
		const divisionId = String(fd.get('division_id') ?? '').trim();
		const montoStr = String(fd.get('monto') ?? '')
			.trim()
			.replace(',', '.');
		const fecha = String(fd.get('fecha') ?? '').trim() || null;
		const nota = String(fd.get('nota') ?? '').trim() || null;

		if (!divisionId) return fail(400, { seccion: 'aportar', error: 'Falta la división.' });
		const monto = Number(montoStr);
		if (!Number.isFinite(monto) || monto <= 0) {
			return fail(400, { seccion: 'aportar', error: 'Monto inválido.' });
		}

		// Necesito saber quién es el pagador del gasto para decidir el estado.
		const { data: div } = await supabase
			.from('gasto_divisiones')
			.select('id, gasto_id, gastos_compartidos(pagador_id)')
			.eq('id', divisionId)
			.maybeSingle();
		type DivRow = {
			gastos_compartidos: { pagador_id: string } | { pagador_id: string }[] | null;
		};
		const g = div ? ((div as unknown) as DivRow).gastos_compartidos : null;
		const pagadorId = g ? (Array.isArray(g) ? g[0]?.pagador_id : g.pagador_id) : null;
		const esPagador = pagadorId === user.id;
		const estado = esPagador ? 'confirmado' : 'pendiente';
		const confirmadoAt = esPagador ? new Date().toISOString() : null;

		const { error } = await supabase.from('aportes').insert({
			division_id: divisionId,
			monto,
			fecha: fecha ?? new Date().toISOString().slice(0, 10),
			registrado_por: user.id,
			nota,
			estado,
			confirmado_at: confirmadoAt
		});
		if (error) return fail(400, { seccion: 'aportar', error: error.message });

		return { seccion: 'aportar', ok: true };
	},

	// El pagador del gasto confirma un aporte pendiente del deudor.
	confirmarAporte: async ({ request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/login');
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '').trim();
		if (!id) return fail(400, { seccion: 'aportar', error: 'Falta el id.' });

		const { error, count } = await supabase
			.from('aportes')
			.update(
				{ estado: 'confirmado', confirmado_at: new Date().toISOString() },
				{ count: 'exact' }
			)
			.eq('id', id)
			.eq('estado', 'pendiente');
		if (error) return fail(400, { seccion: 'aportar', error: error.message });
		if (!count) {
			return fail(403, { seccion: 'aportar', error: 'No se pudo confirmar el aporte.' });
		}
		return { seccion: 'aportar', ok: true };
	},

	// El pagador del gasto rechaza un aporte pendiente.
	rechazarAporte: async ({ request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/login');
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '').trim();
		if (!id) return fail(400, { seccion: 'aportar', error: 'Falta el id.' });

		const { error, count } = await supabase
			.from('aportes')
			.update({ estado: 'rechazado' }, { count: 'exact' })
			.eq('id', id)
			.eq('estado', 'pendiente');
		if (error) return fail(400, { seccion: 'aportar', error: error.message });
		if (!count) {
			return fail(403, { seccion: 'aportar', error: 'No se pudo rechazar el aporte.' });
		}
		return { seccion: 'aportar', ok: true };
	},

	// Borrar un aporte. La RLS permite borrarlo a quien lo registró siempre,
	// o al pagador del gasto si el aporte sigue pendiente.
	borrarAporte: async ({ request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/login');
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '').trim();
		if (!id) return fail(400, { seccion: 'aportar', error: 'Falta el id.' });

		const { error, count } = await supabase
			.from('aportes')
			.delete({ count: 'exact' })
			.eq('id', id);
		if (error) return fail(400, { seccion: 'aportar', error: error.message });
		if (!count) {
			return fail(403, {
				seccion: 'aportar',
				error: 'No se pudo borrar el aporte (sin permisos o ya no existe).'
			});
		}
		return { seccion: 'aportar', ok: true };
	}
};
