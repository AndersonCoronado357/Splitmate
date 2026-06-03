-- ============================================================
-- 034 — Balance neto por miembro: usar SOLO transacciones confirmadas.
--
-- La versión 033 contaba aportes/pagos/devoluciones en estado
-- pendiente desde ambos lados (simétrico). Eso anulaba deudas
-- recíprocas demasiado pronto: si A pagó un gasto donde B tenía un
-- aporte pendiente, ambos quedaban a 0 ⇒ /saldar se mostraba vacío
-- aunque la home seguía indicando "te deben $X".
--
-- La home (balance_hogar) usa una regla asimétrica: para "me deben"
-- solo cuenta confirmados, para "le debo" cuenta pendientes y
-- confirmados. Eso no es transponible a una vista global por miembro
-- (la suma de saldos dejaría de ser cero).
--
-- Solución correcta para la simplificación: regla ESTRICTA — solo
-- transacciones confirmadas. Los pendientes son "promesas" que no han
-- sido verificadas; no afectan la deuda hasta que el otro las acepte.
-- Así la suma de saldos cuadra a cero y /saldar concuerda con lo que
-- la home muestra en "te deben".
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
					and a.estado = 'confirmado'
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
					and a.estado = 'confirmado'
			), 0)
		) as monto
		from public.gastos_compartidos g
		join public.gasto_divisiones d on d.gasto_id = g.id
		where g.hogar_id = p_hogar
			and d.participante_id <> g.pagador_id
		group by d.participante_id
	),
	-- === Pagos directos: receptor recibe ===
	pagos_recibidos as (
		select receptor_id as user_id, sum(monto) as monto
		from public.pagos
		where hogar_id = p_hogar
			and estado = 'confirmado'
			and prestamo_id is null
		group by receptor_id
	),
	-- === Pagos directos: pagador entrega ===
	pagos_hechos as (
		select pagador_id as user_id, sum(monto) as monto
		from public.pagos
		where hogar_id = p_hogar
			and estado = 'confirmado'
			and prestamo_id is null
		group by pagador_id
	),
	-- === Préstamos activos: prestador acumula (le deben) ===
	prestamos_como_prestador as (
		select pr.prestador_id as user_id, sum(
			pr.monto - coalesce((
				select sum(p.monto) from public.pagos p
				where p.prestamo_id = pr.id
					and p.estado = 'confirmado'
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
					and p.estado = 'confirmado'
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
