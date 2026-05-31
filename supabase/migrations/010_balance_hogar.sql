-- ============================================================
-- 010_balance_hogar.sql — Fase 5.1: cálculo de balance entre pares.
--
-- Calcula, para el usuario logueado y un hogar dado, el saldo neto con cada
-- otro miembro del hogar a partir de los gastos compartidos y los aportes
-- (pagos parciales) ya registrados.
--
-- Convención:
--   saldo > 0  → el otro me debe a mí (saldo a favor)
--   saldo < 0  → yo le debo al otro (saldo en contra)
--   saldo = 0  → nadie le debe nada al otro
--
-- Se ignoran las divisiones donde pagador y participante son la misma persona
-- (el pagador no se debe a sí mismo por la parte que le tocó).
--
-- La función es SECURITY DEFINER pero valida explícitamente que el llamante
-- sea miembro del hogar antes de devolver datos.
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
	-- Solo miembros del hogar pueden consultar su balance.
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
		-- Los otros miembros del hogar (excepto yo).
		select user_id
		from public.miembros_hogar
		where hogar_id = p_hogar
			and user_id <> (select id from me)
	),
	-- Cuánto me debe cada uno: yo soy el pagador, ellos participan, y
	-- restamos lo que ya hayan abonado.
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
	-- Cuánto le debo a cada uno: ellos son pagadores, yo participo, menos
	-- lo que ya abone yo.
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
	)
	select
		p.user_id::uuid as otro_id,
		(coalesce(md.monto, 0) - coalesce(ld.monto, 0))::numeric as saldo
	from pares p
	left join sum_me_deben md on md.otro = p.user_id
	left join sum_le_debo ld on ld.otro = p.user_id;
end;
$$;

revoke all on function public.balance_hogar(uuid) from public;
grant execute on function public.balance_hogar(uuid) to authenticated;
