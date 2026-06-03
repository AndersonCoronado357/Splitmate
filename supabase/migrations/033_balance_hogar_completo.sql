-- ============================================================
-- 033 — Balance neto por miembro (para simplificación de deudas).
--
-- Splitmate ya tiene `balance_hogar(p_hogar)` que devuelve el saldo del
-- USUARIO LOGUEADO con cada otro miembro. Para sugerir el mínimo de
-- transferencias que cierra todas las deudas del hogar (Fase 11), se
-- necesita el saldo NETO de cada miembro: cuánto le deben o debe en
-- total.
--
-- Esta función devuelve por cada miembro su balance neto sumando:
--   + gastos compartidos donde fue pagador (descontando aportes pendientes
--     + confirmados — para consistencia con la sugerencia)
--   - gastos compartidos donde fue participante (descontando aportes)
--   - pagos directos que recibió (confirmados; los pendientes ya cuentan
--     desde el lado del pagador con `pendiente|confirmado`, pero acá la
--     simetría exige tratarlos igual desde ambos lados → usamos pendientes
--     + confirmados consistentemente)
--   + pagos directos que hizo (pendientes + confirmados)
--   + préstamos donde fue prestador (descontando devoluciones)
--   - préstamos donde fue receptor (descontando devoluciones)
--
-- saldo > 0 → al miembro LE DEBEN (acreedor)
-- saldo < 0 → el miembro DEBE (deudor)
-- ============================================================

create or replace function public.balance_hogar_completo(p_hogar uuid)
returns table (
	user_id uuid,
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
	with miembros as (
		select user_id from public.miembros_hogar where hogar_id = p_hogar
	),
	-- === Gastos compartidos: pagador acumula lo que los demás le deben ===
	gastos_como_pagador as (
		select g.pagador_id as user_id, sum(
			d.monto - coalesce((
				select sum(a.monto) from public.aportes a
				where a.division_id = d.id
					and a.estado in ('pendiente', 'confirmado')
			), 0)
		) as monto
		from public.gastos_compartidos g
		join public.gasto_divisiones d on d.gasto_id = g.id
		where g.hogar_id = p_hogar
			and d.participante_id <> g.pagador_id
		group by g.pagador_id
	),
	-- === Gastos compartidos: participante acumula lo que debe ===
	gastos_como_participante as (
		select d.participante_id as user_id, sum(
			d.monto - coalesce((
				select sum(a.monto) from public.aportes a
				where a.division_id = d.id
					and a.estado in ('pendiente', 'confirmado')
			), 0)
		) as monto
		from public.gastos_compartidos g
		join public.gasto_divisiones d on d.gasto_id = g.id
		where g.hogar_id = p_hogar
			and d.participante_id <> g.pagador_id
		group by d.participante_id
	),
	-- === Pagos directos: receptor recibe (descuenta su saldo) ===
	pagos_recibidos as (
		select receptor_id as user_id, sum(monto) as monto
		from public.pagos
		where hogar_id = p_hogar
			and estado in ('pendiente', 'confirmado')
			and prestamo_id is null
		group by receptor_id
	),
	-- === Pagos directos: pagador entrega (aumenta su saldo) ===
	pagos_hechos as (
		select pagador_id as user_id, sum(monto) as monto
		from public.pagos
		where hogar_id = p_hogar
			and estado in ('pendiente', 'confirmado')
			and prestamo_id is null
		group by pagador_id
	),
	-- === Préstamos activos: prestador acumula (le deben) ===
	prestamos_como_prestador as (
		select pr.prestador_id as user_id, sum(
			pr.monto - coalesce((
				select sum(p.monto) from public.pagos p
				where p.prestamo_id = pr.id
					and p.estado in ('pendiente', 'confirmado')
			), 0)
		) as monto
		from public.prestamos pr
		where pr.hogar_id = p_hogar and pr.estado = 'activo'
		group by pr.prestador_id
	),
	-- === Préstamos activos: receptor debe ===
	prestamos_como_receptor as (
		select pr.receptor_id as user_id, sum(
			pr.monto - coalesce((
				select sum(p.monto) from public.pagos p
				where p.prestamo_id = pr.id
					and p.estado in ('pendiente', 'confirmado')
			), 0)
		) as monto
		from public.prestamos pr
		where pr.hogar_id = p_hogar and pr.estado = 'activo'
		group by pr.receptor_id
	)
	select
		m.user_id,
		(
			coalesce(gp.monto, 0)
			- coalesce(gpa.monto, 0)
			- coalesce(pr.monto, 0)
			+ coalesce(ph.monto, 0)
			+ coalesce(plp.monto, 0)
			- coalesce(plr.monto, 0)
		)::numeric as saldo
	from miembros m
	left join gastos_como_pagador gp on gp.user_id = m.user_id
	left join gastos_como_participante gpa on gpa.user_id = m.user_id
	left join pagos_recibidos pr on pr.user_id = m.user_id
	left join pagos_hechos ph on ph.user_id = m.user_id
	left join prestamos_como_prestador plp on plp.user_id = m.user_id
	left join prestamos_como_receptor plr on plr.user_id = m.user_id;
end;
$$;

revoke all on function public.balance_hogar_completo(uuid) from public;
grant execute on function public.balance_hogar_completo(uuid) to authenticated;
