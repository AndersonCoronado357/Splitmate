-- ============================================================
-- 035 — Fix RPC balance_hogar_completo.
--
-- La 033/034 fallaban con "column reference 'user_id' is ambiguous":
-- la función declara `returns table (user_id uuid, saldo numeric)`
-- y dentro hace `where user_id = auth.uid()` contra `miembros_hogar`.
-- PostgreSQL no sabe si `user_id` se refiere a la columna de salida
-- o a la columna de la tabla. Como resultado, la función NUNCA se
-- ejecutaba con éxito y /saldar mostraba siempre "Todo cuadrado".
--
-- Fix: renombrar la columna de salida a `miembro_id`. El cliente JS
-- (`src/lib/server/saldar.ts`) lee `f.user_id`, así que también hay
-- que actualizarlo ahí (lo hago en este mismo commit).
-- ============================================================

drop function if exists public.balance_hogar_completo(uuid);

create or replace function public.balance_hogar_completo(p_hogar uuid)
returns table (
	miembro_id uuid,
	saldo numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
	if not exists (
		select 1 from public.miembros_hogar mh
		where mh.hogar_id = p_hogar and mh.user_id = auth.uid()
	) then
		raise exception 'no_es_miembro_del_hogar';
	end if;

	return query
	with miembros as (
		select mh.user_id as uid from public.miembros_hogar mh where mh.hogar_id = p_hogar
	),
	gastos_como_pagador as (
		select g.pagador_id as uid, sum(
			d.monto - coalesce((
				select sum(a.monto) from public.aportes a
				where a.division_id = d.id and a.estado = 'confirmado'
			), 0)
		) as monto
		from public.gastos_compartidos g
		join public.gasto_divisiones d on d.gasto_id = g.id
		where g.hogar_id = p_hogar
			and d.participante_id <> g.pagador_id
		group by g.pagador_id
	),
	gastos_como_participante as (
		select d.participante_id as uid, sum(
			d.monto - coalesce((
				select sum(a.monto) from public.aportes a
				where a.division_id = d.id and a.estado = 'confirmado'
			), 0)
		) as monto
		from public.gastos_compartidos g
		join public.gasto_divisiones d on d.gasto_id = g.id
		where g.hogar_id = p_hogar
			and d.participante_id <> g.pagador_id
		group by d.participante_id
	),
	pagos_recibidos as (
		select pg.receptor_id as uid, sum(pg.monto) as monto
		from public.pagos pg
		where pg.hogar_id = p_hogar
			and pg.estado = 'confirmado'
			and pg.prestamo_id is null
		group by pg.receptor_id
	),
	pagos_hechos as (
		select pg.pagador_id as uid, sum(pg.monto) as monto
		from public.pagos pg
		where pg.hogar_id = p_hogar
			and pg.estado = 'confirmado'
			and pg.prestamo_id is null
		group by pg.pagador_id
	),
	prestamos_como_prestador as (
		select pr.prestador_id as uid, sum(
			pr.monto - coalesce((
				select sum(p.monto) from public.pagos p
				where p.prestamo_id = pr.id and p.estado = 'confirmado'
			), 0)
		) as monto
		from public.prestamos pr
		where pr.hogar_id = p_hogar and pr.estado = 'activo'
		group by pr.prestador_id
	),
	prestamos_como_receptor as (
		select pr.receptor_id as uid, sum(
			pr.monto - coalesce((
				select sum(p.monto) from public.pagos p
				where p.prestamo_id = pr.id and p.estado = 'confirmado'
			), 0)
		) as monto
		from public.prestamos pr
		where pr.hogar_id = p_hogar and pr.estado = 'activo'
		group by pr.receptor_id
	)
	select
		m.uid as miembro_id,
		(
			coalesce(gp.monto, 0)
			- coalesce(gpa.monto, 0)
			- coalesce(pr.monto, 0)
			+ coalesce(ph.monto, 0)
			+ coalesce(plp.monto, 0)
			- coalesce(plr.monto, 0)
		)::numeric as saldo
	from miembros m
	left join gastos_como_pagador gp on gp.uid = m.uid
	left join gastos_como_participante gpa on gpa.uid = m.uid
	left join pagos_recibidos pr on pr.uid = m.uid
	left join pagos_hechos ph on ph.uid = m.uid
	left join prestamos_como_prestador plp on plp.uid = m.uid
	left join prestamos_como_receptor plr on plr.uid = m.uid;
end;
$$;

revoke all on function public.balance_hogar_completo(uuid) from public;
grant execute on function public.balance_hogar_completo(uuid) to authenticated;
