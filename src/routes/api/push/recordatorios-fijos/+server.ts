import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env as priv } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { enviarPushAUsuario } from '$lib/server/push';

// Recordatorios mensuales — recorre las divisiones del mes activo de
// cada gasto fijo activo, y a cada participante que todavía tiene
// pendiente le manda UN push por mes (registrado en
// `push_recordatorios_enviados` para no duplicar).
//
// No es un endpoint público: hay que mandarle el header
// `x-cron-secret` con el valor de `CRON_SECRET` del .env. La idea es
// dispararlo desde un cron externo (Windows Task Scheduler en dev, o
// Cloudflare Cron Triggers en prod cuando lleguemos a la Fase 13).
//
// Uso manual:
//   curl -X POST http://localhost:5173/api/push/recordatorios-fijos \
//     -H "x-cron-secret: $CRON_SECRET"
export const POST: RequestHandler = async ({ request }) => {
	const secretEsperado = priv.CRON_SECRET;
	if (!secretEsperado) throw error(500, 'CRON_SECRET no configurado en el servidor.');
	const got = request.headers.get('x-cron-secret') ?? '';
	if (got !== secretEsperado) throw error(401, 'No autorizado');

	const sec = priv.SUPABASE_SECRET_KEY;
	if (!sec) throw error(500, 'SUPABASE_SECRET_KEY no configurado.');
	const supa = createClient(PUBLIC_SUPABASE_URL, sec, {
		auth: { autoRefreshToken: false, persistSession: false }
	});

	// Mes actual (UTC sirve: solo lo usamos para acotar la query).
	const d = new Date();
	const anio = d.getFullYear();
	const mes = d.getMonth() + 1;

	// Traemos todas las divisiones del mes actual con su plantilla y aportes.
	// Calculamos pendiente en JS para reusar la misma lógica de
	// `src/lib/server/fijos.ts` (pagado = suma de aportes; pendiente = monto - pagado).
	const { data: meses, error: e1 } = await supa
		.from('gastos_fijos_mes')
		.select(
			`id, plantilla_id, anio, mes,
			 gastos_fijos_plantilla!inner(id, nombre, activa, hogar_id),
			 gastos_fijos_mes_division (id, participante_id, monto, gastos_fijos_aportes(monto))`
		)
		.eq('anio', anio)
		.eq('mes', mes);
	if (e1) throw error(500, e1.message);

	type Plantilla = { id: string; nombre: string; activa: boolean; hogar_id: string };
	type Aporte = { monto: number };
	type Division = {
		id: string;
		participante_id: string;
		monto: number;
		gastos_fijos_aportes: Aporte[] | null;
	};
	type Mes = {
		id: string;
		plantilla_id: string;
		anio: number;
		mes: number;
		gastos_fijos_plantilla: Plantilla | Plantilla[];
		gastos_fijos_mes_division: Division[] | null;
	};

	let enviados = 0;
	let saltados = 0;
	const errores: string[] = [];

	for (const m of (meses ?? []) as unknown as Mes[]) {
		const p = Array.isArray(m.gastos_fijos_plantilla)
			? m.gastos_fijos_plantilla[0]
			: m.gastos_fijos_plantilla;
		if (!p || !p.activa) continue;

		for (const d of m.gastos_fijos_mes_division ?? []) {
			const pagado = (d.gastos_fijos_aportes ?? []).reduce((acc, a) => acc + Number(a.monto), 0);
			const pendiente = Number(d.monto) - pagado;
			if (pendiente <= 0.01) {
				saltados++;
				continue;
			}

			// ¿Ya le mandamos recordatorio de ESTA división este mes?
			const { data: ya } = await supa
				.from('push_recordatorios_enviados')
				.select('id')
				.eq('user_id', d.participante_id)
				.eq('tipo', 'fijo_mes_pendiente')
				.eq('referencia', d.id)
				.maybeSingle();
			if (ya) {
				saltados++;
				continue;
			}

			try {
				await enviarPushAUsuario(d.participante_id, {
					title: `Recordatorio: ${p.nombre}`,
					body: `Te queda pendiente $${Math.round(pendiente).toLocaleString('es-CO')} de este mes.`,
					url: `/fijos/${p.id}`,
					tag: `recordatorio-fijo:${d.id}`
				});
				await supa.from('push_recordatorios_enviados').insert({
					user_id: d.participante_id,
					tipo: 'fijo_mes_pendiente',
					referencia: d.id
				});
				enviados++;
			} catch (er) {
				errores.push(`${d.id}: ${(er as Error).message}`);
			}
		}
	}

	return json({ ok: true, anio, mes, enviados, saltados, errores });
};
