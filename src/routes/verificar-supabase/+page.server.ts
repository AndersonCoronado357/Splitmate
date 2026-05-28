import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$env/static/public';
import { SUPABASE_SECRET_KEY } from '$env/static/private';

const FALTANTE = 'REEMPLAZAR';

function configurado(v: string | undefined): boolean {
	return !!v && v !== FALTANTE;
}

function enmascarar(s: string | undefined): string {
	if (!configurado(s)) return '(no configurado)';
	const v = s as string;
	if (v.length <= 12) return '***';
	return v.slice(0, 8) + '…' + v.slice(-4);
}

type Resultado = { ok: boolean; mensaje: string };

async function probarPublishable(): Promise<Resultado> {
	try {
		const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY);
		const { error } = await supabase.auth.getSession();
		return error ? { ok: false, mensaje: error.message } : { ok: true, mensaje: 'Conecta y responde.' };
	} catch (e: unknown) {
		return { ok: false, mensaje: e instanceof Error ? e.message : String(e) };
	}
}

async function probarSecret(): Promise<Resultado> {
	try {
		const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, {
			auth: { persistSession: false, autoRefreshToken: false }
		});
		// Llamada admin que NO requiere ninguna tabla: lista los primeros
		// usuarios (en un proyecto recién creado serán 0).
		const { error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
		return error
			? { ok: false, mensaje: error.message }
			: { ok: true, mensaje: 'La llave secret responde con permisos de servicio.' };
	} catch (e: unknown) {
		return { ok: false, mensaje: e instanceof Error ? e.message : String(e) };
	}
}

export const load = async () => {
	const checks = {
		url: { configurado: configurado(PUBLIC_SUPABASE_URL), valor: enmascarar(PUBLIC_SUPABASE_URL) },
		publishable: {
			configurado: configurado(PUBLIC_SUPABASE_PUBLISHABLE_KEY),
			valor: enmascarar(PUBLIC_SUPABASE_PUBLISHABLE_KEY)
		},
		secret: {
			configurado: configurado(SUPABASE_SECRET_KEY),
			valor: enmascarar(SUPABASE_SECRET_KEY)
		}
	};

	const conexionPublishable: Resultado =
		checks.url.configurado && checks.publishable.configurado
			? await probarPublishable()
			: { ok: false, mensaje: 'Sin probar (faltan llaves)' };

	const conexionSecret: Resultado =
		checks.url.configurado && checks.secret.configurado
			? await probarSecret()
			: { ok: false, mensaje: 'Sin probar (falta la secret)' };

	return { checks, conexionPublishable, conexionSecret };
};
