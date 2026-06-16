import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { listarPrestamos, type PrestamoListado } from '$lib/server/prestamos';
import type { PerfilMin } from '$lib/server/gastos';
import { enviarPushAUsuario } from '$lib/server/push';
import type { DbClient as SupabaseClient } from '$lib/server/sb';

// Devuelve el display_name del usuario para meterlo en el título del push.
async function nombreDe(supabase: SupabaseClient, userId: string): Promise<string> {
	const { data } = await supabase
		.from('profiles')
		.select('display_name')
		.eq('id', userId)
		.maybeSingle();
	return data?.display_name || 'Alguien';
}

// Listado de préstamos del hogar activo + acciones para confirmar, rechazar,
// borrar (si está pendiente) o registrar una devolución asociada.
export const load: PageServerLoad = async ({
	locals: { supabase, user },
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

	const prestamos = await listarPrestamos(
		supabase,
		hogarActivo.id,
		user.id,
		perfiles,
		hogarActivo.moneda
	);

	return { prestamos } satisfies { prestamos: PrestamoListado[] };
};

export const actions: Actions = {
	// El prestador registra un préstamo nuevo. Queda en estado='pendiente'.
	registrar: async ({ request, locals: { supabase, user }, cookies }) => {
		if (!user) redirect(303, '/login');

		// Necesito el hogar activo y la lista de miembros para validar.
		const { elegirHogarActivo, listarHogares } = await import('$lib/server/hogares');
		const hogarActivo = elegirHogarActivo(
			await listarHogares(supabase, user.id),
			cookies
		);
		if (!hogarActivo) return fail(400, { error: 'No hay hogar activo.' });

		const fd = await request.formData();
		const receptorId = String(fd.get('receptor_id') ?? '').trim();
		const montoStr = String(fd.get('monto') ?? '').trim().replace(',', '.');
		const fecha = String(fd.get('fecha') ?? '').trim() || null;
		const fechaEsperada =
			String(fd.get('fecha_esperada') ?? '').trim() || null;
		const motivo = String(fd.get('motivo') ?? '').trim() || null;
		const tipoPagoRaw = String(fd.get('tipo_pago') ?? 'iguales').trim();
		const tipoPagosValidos = ['iguales', 'porcentaje', 'exacto'];
		const tipoPago = tipoPagosValidos.includes(tipoPagoRaw) ? tipoPagoRaw : 'iguales';

		if (!receptorId) return fail(400, { error: 'Falta el receptor.' });
		if (receptorId === user.id) {
			return fail(400, { error: 'No puedes prestarte a ti mismo.' });
		}

		const monto = Number(montoStr);
		if (!Number.isFinite(monto) || monto <= 0) {
			return fail(400, { error: 'Monto inválido.' });
		}

		// Cuotas del plan de devolución vienen como JSON en un input oculto.
		// La suma de los montos tiene que igualar el monto del préstamo
		// (toleramos 0.01 por redondeo). Si llega vacío o inválido, generamos
		// una sola cuota igual al total para no dejar el préstamo sin plan.
		const cuotasRaw = String(fd.get('cuotas') ?? '').trim();
		type CuotaInput = { numero: number; monto: number; fecha_esperada?: string | null };
		let cuotasParsed: CuotaInput[] = [];
		if (cuotasRaw) {
			try {
				const parsed = JSON.parse(cuotasRaw) as Array<{
					numero?: number;
					monto?: number;
					fecha_esperada?: string | null;
				}>;
				if (Array.isArray(parsed)) {
					cuotasParsed = parsed
						.filter((c) => Number.isFinite(c.monto) && (c.monto ?? 0) > 0)
						.map((c, i) => ({
							numero: Number.isInteger(c.numero) ? Number(c.numero) : i + 1,
							monto: Number(c.monto),
							fecha_esperada: c.fecha_esperada || null
						}));
				}
			} catch {
				cuotasParsed = [];
			}
		}
		if (cuotasParsed.length === 0) {
			cuotasParsed = [{ numero: 1, monto }];
		}
		const sumaCuotas = cuotasParsed.reduce((a, c) => a + c.monto, 0);
		if (Math.abs(sumaCuotas - monto) > 0.01) {
			return fail(400, {
				error: `La suma de las cuotas (${sumaCuotas}) no coincide con el monto (${monto}).`
			});
		}

		// Insert préstamo + cuotas. Si falla cualquier cuota, borro el
		// préstamo para no quedar a medias (cascade en BD igualmente lo
		// limpiaría si lo borrara después).
		const { data: prestNuevo, error } = await supabase
			.from('prestamos')
			.insert({
				hogar_id: hogarActivo.id,
				prestador_id: user.id,
				receptor_id: receptorId,
				monto,
				fecha: fecha ?? new Date().toISOString().slice(0, 10),
				fecha_esperada: fechaEsperada,
				motivo,
				tipo_pago: tipoPago,
				registrado_por: user.id
			})
			.select('id')
			.single();

		if (error || !prestNuevo) return fail(400, { error: error?.message || 'No se pudo crear.' });

		const { error: eCuotas } = await supabase.from('prestamo_cuotas').insert(
			cuotasParsed.map((c) => ({
				prestamo_id: prestNuevo.id,
				numero: c.numero,
				monto: c.monto,
				fecha_esperada: c.fecha_esperada
			}))
		);
		if (eCuotas) {
			await supabase.from('prestamos').delete().eq('id', prestNuevo.id);
			return fail(400, { error: `No se pudo guardar el plan: ${eCuotas.message}` });
		}

		// Push al receptor para que confirme o rechace.
		try {
			const quien = await nombreDe(supabase, user.id);
			await enviarPushAUsuario(receptorId, {
				title: `${quien} marcó un préstamo a tu favor`,
				body: 'Confirma o rechaza desde el detalle.',
				url: `/prestamos/${prestNuevo.id}`,
				tag: `prestamo-pendiente:${prestNuevo.id}`
			});
		} catch (e) {
			console.warn('[push] no se pudo notificar préstamo nuevo', e);
		}

		return { ok: true };
	},

	// El receptor confirma el préstamo: pasa a 'activo' y empieza a contar
	// en el balance.
	confirmar: async ({ request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/login');
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '').trim();
		if (!id) return fail(400, { error: 'Falta el id.' });

		// Necesito al prestador para avisarle.
		const { data: prAntes } = await supabase
			.from('prestamos')
			.select('prestador_id')
			.eq('id', id)
			.maybeSingle();

		const { error, count } = await supabase
			.from('prestamos')
			.update(
				{ estado: 'activo', confirmado_at: new Date().toISOString() },
				{ count: 'exact' }
			)
			.eq('id', id)
			.eq('estado', 'pendiente');
		if (error) return fail(400, { error: error.message });
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
			} catch (e) {
				console.warn('[push] no se pudo notificar confirmación de préstamo', e);
			}
		}
		return { ok: true };
	},

	// El receptor rechaza el préstamo: queda en 'rechazado' (no cuenta).
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

		const { error, count } = await supabase
			.from('prestamos')
			.update({ estado: 'rechazado' }, { count: 'exact' })
			.eq('id', id)
			.eq('estado', 'pendiente');
		if (error) return fail(400, { error: error.message });
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
			} catch (e) {
				console.warn('[push] no se pudo notificar rechazo de préstamo', e);
			}
		}
		return { ok: true };
	},

	// El prestador (= registrador) cancela un préstamo pendiente.
	borrar: async ({ request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/login');
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '').trim();
		if (!id) return fail(400, { error: 'Falta el id.' });

		const { error, count } = await supabase
			.from('prestamos')
			.delete({ count: 'exact' })
			.eq('id', id);
		if (error) return fail(400, { error: error.message });
		if (!count) return fail(403, { error: 'No se pudo borrar el préstamo.' });
		return { ok: true };
	},

	// El receptor registra una devolución (total o parcial) de un préstamo
	// activo. Reusa la tabla `pagos` con `prestamo_id` poblado. Queda
	// 'pendiente' hasta que el prestador confirme.
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

		if (!prestamoId) return fail(400, { error: 'Falta el préstamo.' });
		const monto = Number(montoStr);
		if (!Number.isFinite(monto) || monto <= 0) {
			return fail(400, { error: 'Monto inválido.' });
		}

		// Necesito conocer el préstamo: receptor y prestador (yo soy receptor).
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

		// El pago se crea como pendiente; el prestador lo confirma.
		const { error } = await supabase.from('pagos').insert({
			hogar_id: hogarActivo.id,
			pagador_id: user.id,
			receptor_id: pr.prestador_id,
			monto,
			fecha: new Date().toISOString().slice(0, 10),
			registrado_por: user.id,
			prestamo_id: prestamoId
		});
		if (error) return fail(400, { error: error.message });

		// Push al prestador para que confirme la devolución.
		try {
			const quien = await nombreDe(supabase, user.id);
			await enviarPushAUsuario(pr.prestador_id, {
				title: `${quien} marcó una devolución`,
				body: 'Confirma o rechaza el pago desde el préstamo.',
				url: `/prestamos/${prestamoId}`,
				tag: `devolucion-pendiente:${prestamoId}`
			});
		} catch (e) {
			console.warn('[push] no se pudo notificar devolución', e);
		}
		return { ok: true };
	},

	// El prestador confirma una devolución del receptor. Pasa el pago a
	// 'confirmado'.
	confirmarDevolucion: async ({ request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/login');
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '').trim();
		if (!id) return fail(400, { error: 'Falta el id.' });

		const { data: pagoAntes } = await supabase
			.from('pagos')
			.select('pagador_id, prestamo_id')
			.eq('id', id)
			.maybeSingle();

		const { error, count } = await supabase
			.from('pagos')
			.update(
				{ estado: 'confirmado', confirmado_at: new Date().toISOString() },
				{ count: 'exact' }
			)
			.eq('id', id)
			.eq('estado', 'pendiente');
		if (error) return fail(400, { error: error.message });
		if (!count) return fail(403, { error: 'No se pudo confirmar la devolución.' });

		if (pagoAntes?.pagador_id && pagoAntes.pagador_id !== user.id) {
			try {
				await enviarPushAUsuario(pagoAntes.pagador_id, {
					title: 'Confirmaron tu devolución',
					body: 'Tu pago al préstamo quedó registrado.',
					url: pagoAntes.prestamo_id ? `/prestamos/${pagoAntes.prestamo_id}` : '/prestamos',
					tag: `devolucion-confirmada:${id}`
				});
			} catch (e) {
				console.warn('[push] no se pudo notificar confirmación de devolución', e);
			}
		}
		return { ok: true };
	},

	rechazarDevolucion: async ({ request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/login');
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '').trim();
		if (!id) return fail(400, { error: 'Falta el id.' });

		const { data: pagoAntes } = await supabase
			.from('pagos')
			.select('pagador_id, prestamo_id')
			.eq('id', id)
			.maybeSingle();

		const { error, count } = await supabase
			.from('pagos')
			.update({ estado: 'rechazado' }, { count: 'exact' })
			.eq('id', id)
			.eq('estado', 'pendiente');
		if (error) return fail(400, { error: error.message });
		if (!count) return fail(403, { error: 'No se pudo rechazar la devolución.' });

		if (pagoAntes?.pagador_id && pagoAntes.pagador_id !== user.id) {
			try {
				await enviarPushAUsuario(pagoAntes.pagador_id, {
					title: 'Rechazaron tu devolución',
					body: 'Revisa el préstamo y vuelve a marcarla si hubo un error.',
					url: pagoAntes.prestamo_id ? `/prestamos/${pagoAntes.prestamo_id}` : '/prestamos',
					tag: `devolucion-rechazada:${id}`
				});
			} catch (e) {
				console.warn('[push] no se pudo notificar rechazo de devolución', e);
			}
		}
		return { ok: true };
	},

	// Marcar préstamo como saldado manualmente (atajo cuando ambos saben que
	// se cerró por fuera). Solo prestador o receptor; solo si está activo.
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

		const { error, count } = await supabase
			.from('prestamos')
			.update({ estado: 'saldado' }, { count: 'exact' })
			.eq('id', id)
			.eq('estado', 'activo');
		if (error) return fail(400, { error: error.message });
		if (!count) return fail(403, { error: 'No se pudo marcar como pagado.' });

		// Push al OTRO lado (no a quien lo marcó).
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
				} catch (e) {
					console.warn('[push] no se pudo notificar saldado', e);
				}
			}
		}
		return { ok: true };
	}
};
