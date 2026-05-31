-- ============================================================
-- 015_pagos.sql — Fase 6: pagos que saldan deuda.
--
-- Un "pago" es una transferencia DIRECTA de un miembro del hogar a otro
-- (pagador → receptor) por un monto dado. Sirve para saldar saldos netos
-- (cuando A le debe a B y le pasa la plata por fuera de cualquier gasto
-- específico). Es DISTINTO de un `aporte`, que es la fracción que se paga
-- sobre una división puntual de un gasto compartido.
--
-- Flujo:
--   1. Pagador registra el pago → estado='pendiente'.
--   2. Mientras esté 'pendiente', NO afecta el balance (es la versión
--      "lo dije pero no me lo confirmaron").
--   3. Receptor confirma → estado='confirmado', confirmado_at=now().
--      A partir de ahí, el balance entre los dos se reduce en ese monto.
--   4. Receptor puede rechazar → estado='rechazado'. Tampoco afecta balance.
--   5. Solo el registrador puede borrar, y solo si todavía está 'pendiente'.
-- ============================================================

create table if not exists public.pagos (
	id uuid primary key default gen_random_uuid(),
	hogar_id uuid not null references public.hogares (id) on delete cascade,
	pagador_id uuid not null references auth.users (id) on delete restrict,
	receptor_id uuid not null references auth.users (id) on delete restrict,
	monto numeric(14, 2) not null check (monto > 0),
	fecha date not null default current_date,
	nota text,
	estado text not null default 'pendiente'
		check (estado in ('pendiente', 'confirmado', 'rechazado')),
	registrado_por uuid not null references auth.users (id) on delete restrict,
	confirmado_at timestamptz,
	created_at timestamptz not null default now(),
	check (pagador_id <> receptor_id)
);

create index if not exists pagos_hogar_idx on public.pagos (hogar_id, created_at desc);
create index if not exists pagos_pendientes_idx
	on public.pagos (hogar_id, receptor_id) where estado = 'pendiente';

alter table public.pagos enable row level security;

drop policy if exists "pagos_select" on public.pagos;
create policy "pagos_select" on public.pagos for select using (
	public.es_miembro(hogar_id)
);

drop policy if exists "pagos_insert" on public.pagos;
create policy "pagos_insert" on public.pagos for insert with check (
	public.es_miembro(hogar_id)
	and registrado_por = auth.uid()
	-- El que registra debe ser el pagador (no se registra "en nombre de
	-- otro" porque sería un pago que yo no hice).
	and pagador_id = auth.uid()
);

-- Confirmar / rechazar / editar:
--   * Receptor: puede pasar estado entre cualquier valor (confirmar o rechazar
--     uno pendiente, o cambiar de opinión).
--   * Pagador: puede editar monto/fecha/nota MIENTRAS esté pendiente
--     (por si se equivocó en el monto, etc.).
drop policy if exists "pagos_update" on public.pagos;
create policy "pagos_update" on public.pagos for update using (
	public.es_miembro(hogar_id)
	and (
		receptor_id = auth.uid()
		or (pagador_id = auth.uid() and estado = 'pendiente')
	)
);

-- Borrar: solo el registrador, y solo si sigue pendiente. Un pago confirmado
-- ya quedó registrado en la historia; para deshacerlo el receptor debería
-- rechazarlo (pero rechazar solo aplica si estaba pendiente — para deshacer
-- un confirmado habría que cambiar el estado a rechazado vía update).
drop policy if exists "pagos_delete" on public.pagos;
create policy "pagos_delete" on public.pagos for delete using (
	public.es_miembro(hogar_id)
	and registrado_por = auth.uid()
	and estado = 'pendiente'
);

-- Realtime: para que el receptor reciba al instante el pago a confirmar,
-- y el pagador vea al instante cuando se le confirma/rechaza.
do $$
begin
	begin
		alter publication supabase_realtime add table public.pagos;
	exception when duplicate_object then null;
	end;
end $$;

alter table public.pagos replica identity full;
