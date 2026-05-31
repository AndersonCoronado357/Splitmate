-- ============================================================
-- 021_aportes_pendientes_visibles.sql
--
-- Reactivamos el flujo "pendiente / confirmado / rechazado" en `aportes`
-- (la columna `estado` ya existe desde 018, default 'confirmado'). La idea:
--
--   * Si yo soy el deudor (participante de la división) y registro un aporte,
--     queda en estado 'pendiente' hasta que el pagador del gasto confirme.
--   * Si el pagador del gasto registra un aporte (declarando "X me pagó"),
--     queda 'confirmado' directo: la autoridad de cobro es suya.
--
-- Y en el balance, semántica asimétrica:
--
--   * En MI vista, mis aportes pendientes cuentan: la deuda baja al instante.
--   * En la vista de mi acreedor, esos aportes NO cuentan hasta que confirme.
--
-- Esta migración solo toca `balance_hogar` y las políticas de RLS para
-- permitir confirmar/rechazar/borrar pendientes desde la app. La estructura
-- de la tabla queda igual que en 018.
-- ============================================================

-- RLS: el pagador del gasto puede actualizar/borrar aportes pendientes; quien
-- registró puede actualizar/borrar mientras siga pendiente. Nadie toca los
-- confirmados (solo el que lo registró puede borrarlo, regla previa).
drop policy if exists "aportes_update" on public.aportes;
create policy "aportes_update" on public.aportes for update using (
	exists (
		select 1
		from public.gasto_divisiones d
		join public.gastos_compartidos g on g.id = d.gasto_id
		where d.id = aportes.division_id
			and public.es_miembro(g.hogar_id)
			and (
				g.pagador_id = auth.uid()
				or (aportes.registrado_por = auth.uid() and aportes.estado = 'pendiente')
			)
	)
);

drop policy if exists "aportes_delete" on public.aportes;
create policy "aportes_delete" on public.aportes for delete using (
	registrado_por = auth.uid()
	or exists (
		select 1
		from public.gasto_divisiones d
		join public.gastos_compartidos g on g.id = d.gasto_id
		where d.id = aportes.division_id
			and g.pagador_id = auth.uid()
			and aportes.estado = 'pendiente'
	)
);

-- Balance asimétrico: yo descuento mis pendientes; el cobrador no descuenta
-- los pendientes que el otro registró. Pagos siguen igual que en 017.
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
	-- Lo que el otro me debe: gastos donde yo pagué. Solo descuento APORTES
	-- CONFIRMADOS (los pendientes son una promesa del deudor que aún no
	-- confirmé, así que no los doy por cobrados).
	me_deben as (
		select
			d.participante_id as otro,
			d.monto - coalesce((
				select sum(a.monto) from public.aportes a
				where a.division_id = d.id and a.estado = 'confirmado'
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
	-- Lo que yo le debo al otro: gastos donde el otro pagó y yo participo.
	-- Aquí cuento mis aportes PENDIENTES + CONFIRMADOS: mi pantalla refleja
	-- al instante lo que digo haber abonado, esperando confirmación o no.
	le_debo as (
		select
			g.pagador_id as otro,
			d.monto - coalesce((
				select sum(a.monto) from public.aportes a
				where a.division_id = d.id
					and a.estado in ('pendiente', 'confirmado')
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
		select pagador_id as otro, sum(monto) as monto
		from public.pagos
		where hogar_id = p_hogar
			and receptor_id = (select id from me)
			and estado = 'confirmado'
		group by pagador_id
	),
	pagos_hechos as (
		-- Mis pagos salientes asimétricos: cuentan apenas los registro.
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
