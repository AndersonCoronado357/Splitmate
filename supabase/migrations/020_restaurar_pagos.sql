-- ============================================================
-- 020_restaurar_pagos.sql
--
-- La migración 018 había eliminado la tabla `pagos` para unificar todo en
-- aportes con estado. Decidimos volver atrás: pagos genéricos vuelven y la
-- columna `estado` de aportes deja de usarse (no la tiramos, pero queda
-- inerte: todos los aportes nuevos asumen 'confirmado' como antes).
--
-- Esta migración:
--   1. Recrea `pagos` (clon de 015 + 017).
--   2. Restaura `balance_hogar` a la versión 017 (asimétrica con pagos).
--   3. Vuelve a agregar `pagos` a la publicación de realtime con REPLICA
--      IDENTITY FULL.
-- ============================================================

-- 1. Tabla pagos.
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
	and pagador_id = auth.uid()
);

drop policy if exists "pagos_update" on public.pagos;
create policy "pagos_update" on public.pagos for update using (
	public.es_miembro(hogar_id)
	and (
		receptor_id = auth.uid()
		or (pagador_id = auth.uid() and estado = 'pendiente')
	)
);

drop policy if exists "pagos_delete" on public.pagos;
create policy "pagos_delete" on public.pagos for delete using (
	public.es_miembro(hogar_id)
	and registrado_por = auth.uid()
	and estado = 'pendiente'
);

do $$
begin
	begin
		alter publication supabase_realtime add table public.pagos;
	exception when duplicate_object then null;
	end;
end $$;

alter table public.pagos replica identity full;

-- 2. balance_hogar — vuelve a la versión 017 (asimétrica con pagos propios
-- pendientes).
create or replace function public.balance_hogar(p_hogar uuid)
returns table (
	otro_id uuid,
	saldo numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
	if not exists (
		select 1 from public.miembros_hogar
		where hogar_id = p_hogar and user_id = auth.uid()
	) then
		raise exception 'no_es_miembro_del_hogar';
	end if;

	return query
	with me as (
		select auth.uid() as id
	),
	pares as (
		select user_id from public.miembros_hogar
		where hogar_id = p_hogar
			and user_id <> (select id from me)
	),
	me_deben as (
		select
			d.participante_id as otro,
			d.monto - coalesce((
				select sum(a.monto) from public.aportes a where a.division_id = d.id
			), 0) as pendiente
		from public.gastos_compartidos g
		join public.gasto_divisiones d on d.gasto_id = g.id
		where g.hogar_id = p_hogar
			and g.pagador_id = (select id from me)
			and d.participante_id <> (select id from me)
	),
	sum_me_deben as (
		select otro, sum(pendiente) as monto from me_deben group by otro
	),
	le_debo as (
		select
			g.pagador_id as otro,
			d.monto - coalesce((
				select sum(a.monto) from public.aportes a where a.division_id = d.id
			), 0) as pendiente
		from public.gastos_compartidos g
		join public.gasto_divisiones d on d.gasto_id = g.id
		where g.hogar_id = p_hogar
			and d.participante_id = (select id from me)
			and g.pagador_id <> (select id from me)
	),
	sum_le_debo as (
		select otro, sum(pendiente) as monto from le_debo group by otro
	),
	pagos_recibidos as (
		-- Solo CONFIRMADOS (no puedo dar por cobrado lo que no confirmé).
		select pagador_id as otro, sum(monto) as monto
		from public.pagos
		where hogar_id = p_hogar
			and receptor_id = (select id from me)
			and estado = 'confirmado'
		group by pagador_id
	),
	pagos_hechos as (
		-- Mis pagos salientes cuentan apenas los registro (asimétrico): si
		-- yo digo que pagué, mi pantalla deja de cobrarme ese monto al
		-- instante. Si el receptor rechaza luego, vuelve a aparecer.
		select receptor_id as otro, sum(monto) as monto
		from public.pagos
		where hogar_id = p_hogar
			and pagador_id = (select id from me)
			and estado in ('confirmado', 'pendiente')
		group by receptor_id
	)
	select
		p.user_id::uuid as otro_id,
		(
			coalesce(md.monto, 0)
			- coalesce(ld.monto, 0)
			- coalesce(pr.monto, 0)
			+ coalesce(ph.monto, 0)
		)::numeric as saldo
	from pares p
	left join sum_me_deben md on md.otro = p.user_id
	left join sum_le_debo ld on ld.otro = p.user_id
	left join pagos_recibidos pr on pr.otro = p.user_id
	left join pagos_hechos ph on ph.otro = p.user_id;
end;
$$;
