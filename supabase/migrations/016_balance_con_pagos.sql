-- ============================================================
-- 016_balance_con_pagos.sql — El balance ahora considera pagos confirmados.
--
-- Regla:
--   saldo > 0  → el otro me debe.
--   saldo < 0  → yo le debo al otro.
--
-- Componentes del saldo entre yo y "otro":
--   + lo que el otro me debe por gastos (yo pagué, otro participa, − aportes del otro)
--   − lo que yo le debo por gastos (otro pagó, yo participo, − aportes míos)
--   − pagos CONFIRMADOS que el otro me hizo (me pagó → ya no me debe eso)
--   + pagos CONFIRMADOS que yo le hice (yo le pagué → ya no le debo eso = baja mi deuda)
-- ============================================================

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
		-- Otros me han pagado (confirmado) → me deben ESE monto menos.
		select pagador_id as otro, sum(monto) as monto
		from public.pagos
		where hogar_id = p_hogar
			and receptor_id = (select id from me)
			and estado = 'confirmado'
		group by pagador_id
	),
	pagos_hechos as (
		-- Yo les he pagado (confirmado) → les debo ESE monto menos.
		select receptor_id as otro, sum(monto) as monto
		from public.pagos
		where hogar_id = p_hogar
			and pagador_id = (select id from me)
			and estado = 'confirmado'
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
