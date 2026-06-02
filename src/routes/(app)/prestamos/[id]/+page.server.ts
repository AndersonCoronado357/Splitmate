import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { listarPrestamos, type PrestamoListado } from '$lib/server/prestamos';
import type { PerfilMin } from '$lib/server/gastos';
import { enviarPushAUsuario } from '$lib/server/push';
import type { SupabaseClient } from '@supabase/supabase-js';

async function nombreDe(supabase: SupabaseClient, userId: string): Promise<string> {
	const { data } = await supabase
		.from('profiles')
		.select('display_name')
		.eq('id', userId)
		.maybeSingle();
	return data?.display_name || 'Alguien';
}

// Detalle de un préstamo: header, historial completo de devoluciones,
// y el formulario para registrar devolución (con monto vacío por defecto).
// Reusamos `listarPrestamos` y filtramos por id para evitar duplicar lógica.
export const load: PageServerLoad = async ({
	locals: { supabase, user },
	params,
	parent,
	depends
}) => {
	if (!user) redirect(303, '/login');
	depends('app:prestamos');

	const { hogarActivo, miembros } = await parent();
	if (!hogarActivo) redirect(303, '/bienvenida');

	const perfiles = new Map<string, PerfilMin>(
		miembros.map((m) => [m.userId, { display_name: m.nombre, avatar_url: m.avatar }])
	);

	const todos = await listarPrestamos(
		supabase,
		hogarActivo.id,
		user.id,
		perfiles,
		hogarActivo.moneda
	);
	const prestamo = todos.find((p) => p.id === params.id);
	if (!prestamo) error(404, 'Préstamo no encontrado');
	if (prestamo.hogarId !== hogarActivo.id) error(404, 'Préstamo no encontrado');

	return { prestamo } satisfies { prestamo: PrestamoListado };
};

// Los acciones reutilizan los del listado (../+page.server.ts) pero las
// definimos también aquí para que `?/accion` posteado desde /prestamos/[id]
// resuelva en esta misma ruta. Es duplicación mínima — todo va a la BD igual.
export const actions: Actions = {
	confirmar: async ({ request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/login');
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '').trim();
		if (!id) return fail(400, { error: 'Falta el id.' });

		const { data: prAntes } = await supabase
			.from('prestamos')
			.select('prestador_id')
			.eq('id', id)
			.maybeSingle();

		const { error: e, count } = await supabase
			.from('prestamos')
			.update(
				{ estado: 'activo', confirmado_at: new Date().toISOString() },
				{ count: 'exact' }
			)
			.eq('id', id)
			.eq('estado', 'pendiente');
		if (e) return fail(400, { error: e.message });
		if (!count) return fail(403, { error: 'No se pudo confirmar el préstamo.' });

		if (prAntes?.prestador_id && prAntes.prestador_id !== user.id) {
			try {
				const quien = await nombreDe(supabase, user.id);
				await enviarPushAUsuario(prAntes.prestador_id, {
					title: `${quien} confirmó el préstamo`,
					body: 'Ya cuenta en el balance del hogar.',
					url: `/prestamos/${id}`,
					tag: `prestamo-confirmado:${id}`
				});
			} catch (er) {
				console.warn('[push] no se pudo notificar confirmación', er);
			}
		}
		return { ok: true };
	},

	rechazar: async ({ request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/login');
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '').trim();
		if (!id) return fail(400, { error: 'Falta el id.' });

		const { data: prAntes } = await supabase
			.from('prestamos')
			.select('prestador_id')
			.eq('id', id)
			.maybeSingle();

		const { error: e, count } = await supabase
			.from('prestamos')
			.update({ estado: 'rechazado' }, { count: 'exact' })
			.eq('id', id)
			.eq('estado', 'pendiente');
		if (e) return fail(400, { error: e.message });
		if (!count) return fail(403, { error: 'No se pudo rechazar el préstamo.' });

		if (prAntes?.prestador_id && prAntes.prestador_id !== user.id) {
			try {
				const quien = await nombreDe(supabase, user.id);
				await enviarPushAUsuario(prAntes.prestador_id, {
					title: `${quien} rechazó el préstamo`,
					body: 'No se registrará en el balance.',
					url: `/prestamos/${id}`,
					tag: `prestamo-rechazado:${id}`
				});
			} catch (er) {
				console.warn('[push] no se pudo notificar rechazo', er);
			}
		}
		return { ok: true };
	},

	borrar: async ({ request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/login');
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '').trim();
		if (!id) return fail(400, { error: 'Falta el id.' });

		const { error: e, count } = await supabase
			.from('prestamos')
			.delete({ count: 'exact' })
			.eq('id', id);
		if (e) return fail(400, { error: e.message });
		if (!count) return fail(403, { error: 'No se pudo borrar el préstamo.' });
		return { ok: true };
	},

	devolver: async ({ request, locals: { supabase, user }, cookies }) => {
		if (!user) redirect(303, '/login');
		const { elegirHogarActivo, listarHogares } = await import('$lib/server/hogares');
		const hogarActivo = elegirHogarActivo(
			await listarHogares(supabase, user.id),
			cookies
		);
		if (!hogarActivo) return fail(400, { error: 'No hay hogar activo.' });

		const fd = await request.formData();
		const prestamoId = String(fd.get('prestamo_id') ?? '').trim();
		const montoStr = String(fd.get('monto') ?? '').trim().replace(',', '.');
		// El cliente manda la fecha LOCAL del usuario. Si no llega, el server
		// cae a su fecha en UTC (que puede estar adelantada un día respecto a
		// Colombia después de las 7pm).
		const fechaCliente = String(fd.get('fecha') ?? '').trim();
		const fecha = /^\d{4}-\d{2}-\d{2}$/.test(fechaCliente)
			? fechaCliente
			: new Date().toISOString().slice(0, 10);

		if (!prestamoId) return fail(400, { error: 'Falta el préstamo.' });
		const monto = Number(montoStr);
		if (!Number.isFinite(monto) || monto <= 0) {
			return fail(400, { error: 'Monto inválido.' });
		}

		const { data: pr } = await supabase
			.from('prestamos')
			.select('id, prestador_id, receptor_id, estado')
			.eq('id', prestamoId)
			.maybeSingle();
		if (!pr) return fail(404, { error: 'Préstamo no encontrado.' });
		if (pr.receptor_id !== user.id) {
			return fail(403, { error: 'Solo el receptor puede devolver.' });
		}
		if (pr.estado !== 'activo') {
			return fail(400, { error: 'El préstamo no está activo.' });
		}

		const { error: e } = await supabase.from('pagos').insert({
			hogar_id: hogarActivo.id,
			pagador_id: user.id,
			receptor_id: pr.prestador_id,
			monto,
			fecha,
			registrado_por: user.id,
			prestamo_id: prestamoId
		});
		if (e) return fail(400, { error: e.message });

		try {
			const quien = await nombreDe(supabase, user.id);
			await enviarPushAUsuario(pr.prestador_id, {
				title: `${quien} marcó una devolución`,
				body: 'Confirma o rechaza el pago desde el préstamo.',
				url: `/prestamos/${prestamoId}`,
				tag: `devolucion-pendiente:${prestamoId}`
			});
		} catch (er) {
			console.warn('[push] no se pudo notificar devolución', er);
		}
		return { ok: true };
	},

	confirmarDevolucion: async ({ request, locals: { supabase, user }, params }) => {
		if (!user) redirect(303, '/login');
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '').trim();
		if (!id) return fail(400, { error: 'Falta el id.' });

		const { data: pagoAntes } = await supabase
			.from('pagos')
			.select('pagador_id')
			.eq('id', id)
			.maybeSingle();

		const { error: e, count } = await supabase
			.from('pagos')
			.update(
				{ estado: 'confirmado', confirmado_at: new Date().toISOString() },
				{ count: 'exact' }
			)
			.eq('id', id)
			.eq('estado', 'pendiente');
		if (e) return fail(400, { error: e.message });
		if (!count) return fail(403, { error: 'No se pudo confirmar la devolución.' });

		if (pagoAntes?.pagador_id && pagoAntes.pagador_id !== user.id) {
			try {
				await enviarPushAUsuario(pagoAntes.pagador_id, {
					title: 'Confirmaron tu devolución',
					body: 'Tu pago al préstamo quedó registrado.',
					url: `/prestamos/${params.id}`,
					tag: `devolucion-confirmada:${id}`
				});
			} catch (er) {
				console.warn('[push] no se pudo notificar confirmación', er);
			}
		}
		return { ok: true };
	},

	rechazarDevolucion: async ({ request, locals: { supabase, user }, params }) => {
		if (!user) redirect(303, '/login');
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '').trim();
		if (!id) return fail(400, { error: 'Falta el id.' });

		const { data: pagoAntes } = await supabase
			.from('pagos')
			.select('pagador_id')
			.eq('id', id)
			.maybeSingle();

		const { error: e, count } = await supabase
			.from('pagos')
			.update({ estado: 'rechazado' }, { count: 'exact' })
			.eq('id', id)
			.eq('estado', 'pendiente');
		if (e) return fail(400, { error: e.message });
		if (!count) return fail(403, { error: 'No se pudo rechazar la devolución.' });

		if (pagoAntes?.pagador_id && pagoAntes.pagador_id !== user.id) {
			try {
				await enviarPushAUsuario(pagoAntes.pagador_id, {
					title: 'Rechazaron tu devolución',
					body: 'Revisa el préstamo y vuelve a marcarla si hubo un error.',
					url: `/prestamos/${params.id}`,
					tag: `devolucion-rechazada:${id}`
				});
			} catch (er) {
				console.warn('[push] no se pudo notificar rechazo', er);
			}
		}
		return { ok: true };
	},

	marcarSaldado: async ({ request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/login');
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '').trim();
		if (!id) return fail(400, { error: 'Falta el id.' });

		const { data: prAntes } = await supabase
			.from('prestamos')
			.select('prestador_id, receptor_id')
			.eq('id', id)
			.maybeSingle();

		const { error: e, count } = await supabase
			.from('prestamos')
			.update({ estado: 'saldado' }, { count: 'exact' })
			.eq('id', id)
			.eq('estado', 'activo');
		if (e) return fail(400, { error: e.message });
		if (!count) return fail(403, { error: 'No se pudo marcar como pagado.' });

		if (prAntes) {
			const otro =
				prAntes.prestador_id === user.id ? prAntes.receptor_id : prAntes.prestador_id;
			if (otro) {
				try {
					const quien = await nombreDe(supabase, user.id);
					await enviarPushAUsuario(otro, {
						title: `${quien} marcó el préstamo como saldado`,
						body: 'Ya no cuenta en el balance.',
						url: `/prestamos/${id}`,
						tag: `prestamo-saldado:${id}`
					});
				} catch (er) {
					console.warn('[push] no se pudo notificar saldado', er);
				}
			}
		}
		return { ok: true };
	}
};
