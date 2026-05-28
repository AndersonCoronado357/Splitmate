import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SECRET_KEY } from '$env/static/private';

// Cliente con permisos de servicio (llave "secret" de Supabase, antes
// "service_role"). SALTA TODAS las políticas RLS. Solo usar desde
// código de servidor (+server.ts, +page.server.ts, acciones, hooks).
// Nunca importar desde un componente del navegador.
export const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, {
	auth: { persistSession: false, autoRefreshToken: false }
});
