-- ============================================================
-- 017_balance_pagos_propios_pendientes.sql
--
-- Cambio de semántica del balance:
--   * Mis pagos salientes (yo soy pagador) reducen mi deuda al instante,
--     SIN ESPERAR a que el receptor confirme. Si yo digo "te mandé 50.000",
--     mi pantalla deja de cobrarme esos 50k mientras la otra persona
--     decide si confirmar o rechazar.
--   * Pagos entrantes (otros me deben pagar) siguen contando SOLO si están
--     confirmados — porque no puedo dar por cobrado algo solo porque la
--     otra persona dice que pagó.
--
-- Si el receptor rechaza el pago, vuelve a aparecer la deuda original
-- (porque el estado pasa a 'rechazado' y deja de contar).
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
		-- Otros me han pagado y YO confirmé. Solo CONFIRMADOS.
		select pagador_id as otro, sum(monto) as monto
		from public.pagos
		where hogar_id = p_hogar
			and receptor_id = (select id from me)
			and estado = 'confirmado'
		group by pagador_id
	),
	pagos_hechos as (
		-- Yo les he pagado: cuentan los CONFIRMADOS y los PENDIENTES.
		-- Mi pantalla refleja al instante lo que yo digo haber pagado.
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
