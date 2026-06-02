-- ============================================================
-- 031 — Notificaciones: idempotencia de recordatorios mensuales.
--
-- Splitmate manda notificaciones vía Supabase Realtime broadcast +
-- la `Notification` API (sin Web Push / SW / FCM, ver
-- `src/lib/server/push.ts`). El único estado persistente que
-- necesitamos es esta tabla, que evita que el cron de recordatorios
-- mensuales de gastos fijos mande el mismo aviso dos veces en el mes.
-- ============================================================

create table if not exists public.push_recordatorios_enviados (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users(id) on delete cascade,
	tipo text not null check (tipo in ('fijo_mes_pendiente')),
	referencia uuid not null, -- p.ej. id de gastos_fijos_mes_division
	enviado_at timestamptz not null default now(),
	constraint push_recordatorios_uniq unique (user_id, tipo, referencia)
);

alter table public.push_recordatorios_enviados enable row level security;
-- Sin policy para clientes: solo el server (service_role) la usa.
