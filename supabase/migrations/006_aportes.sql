-- ============================================================
-- 006_aportes.sql
-- Permite registrar que un participante ya pagó (total o parcial) su parte de
-- un gasto compartido, con historial. No es el módulo de Pagos completo de la
-- Fase 6 (no hay confirmación del receptor todavía); es la versión mínima que
-- responde a "marcar como pagado / aportar a la deuda / ver historial".
--
-- Crea:
--   * aportes — una fila por contribución (pueden ser varias parciales hasta
--     completar la parte que le toca al participante)
--   * RLS:
--       - Lectura: miembros del hogar del gasto.
--       - Insert: el propio participante o el pagador del gasto (registrar
--         en nombre del participante). registrado_por debe ser auth.uid().
--       - Delete: solo quien lo registró.
-- ============================================================

create table if not exists public.aportes (
	id uuid primary key default gen_random_uuid(),
	division_id uuid not null references public.gasto_divisiones(id) on delete cascade,
	monto numeric(14, 2) not null check (monto > 0),
	fecha date not null default current_date,
	registrado_por uuid not null references auth.users(id) on delete restrict,
	nota text,
	created_at timestamptz not null default now()
);

create index if not exists aportes_division_idx
	on public.aportes (division_id, created_at desc);

alter table public.aportes enable row level security;

drop policy if exists "aportes_select" on public.aportes;
create policy "aportes_select" on public.aportes for select using (
	exists (
		select 1
		from public.gasto_divisiones d
		join public.gastos_compartidos g on g.id = d.gasto_id
		where d.id = aportes.division_id and public.es_miembro(g.hogar_id)
	)
);

drop policy if exists "aportes_insert" on public.aportes;
create policy "aportes_insert" on public.aportes for insert with check (
	registrado_por = auth.uid()
	and exists (
		select 1
		from public.gasto_divisiones d
		join public.gastos_compartidos g on g.id = d.gasto_id
		where d.id = aportes.division_id
			and public.es_miembro(g.hogar_id)
			and (d.participante_id = auth.uid() or g.pagador_id = auth.uid())
	)
);

drop policy if exists "aportes_delete" on public.aportes;
create policy "aportes_delete" on public.aportes for delete using (
	registrado_por = auth.uid()
);
