-- ============================================================
-- 023_balance_con_prestamos.sql
--
-- El balance neteado entre dos miembros ahora incluye préstamos activos
-- y sus devoluciones (pagos con prestamo_id no nulo).
--
-- Reglas:
--   * Préstamo en estado 'activo' → el receptor le debe `monto` al prestador.
--   * Préstamo 'saldado' → ya no aporta nada (ya quedó cerrado).
--   * Préstamo 'pendiente' o 'rechazado' → no cuenta.
--   * Devoluciones (pagos con prestamo_id) descuentan del préstamo:
--       - Confirmadas: cuentan para todos.
--       - Pendientes del que devolvió (asimétrico): en su vista cuentan,
--         en la del prestador (cobrador) no, hasta confirmar.
--
-- saldo > 0  → el otro me debe.
-- saldo < 0  → yo le debo al otro.
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
	-- == Gastos compartidos: lo que el otro me debe ==
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
	-- == Gastos compartidos: lo que yo le debo al otro ==
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
	-- == Pagos genéricos recibidos (otros me pagaron, confirmados) ==
	pagos_recibidos as (
		select pagador_id as otro, sum(monto) as monto
		from public.pagos
		where hogar_id = p_hogar
			and receptor_id = (select id from me)
			and estado = 'confirmado'
			and prestamo_id is null
		group by pagador_id
	),
	-- == Pagos genéricos hechos (yo les pagué, pendientes o confirmados) ==
	pagos_hechos as (
		select receptor_id as otro, sum(monto) as monto
		from public.pagos
		where hogar_id = p_hogar
			and pagador_id = (select id from me)
			and estado in ('confirmado', 'pendiente')
			and prestamo_id is null
		group by receptor_id
	),
	-- == Préstamos donde YO soy prestador (me deben el monto) ==
	-- Descuento devoluciones confirmadas (no doy por cobrado lo pendiente).
	prestamos_les_di as (
		select
			pr.receptor_id as otro,
			pr.monto - coalesce((
				select sum(p.monto) from public.pagos p
				where p.prestamo_id = pr.id and p.estado = 'confirmado'
			), 0) as pendiente
		from public.prestamos pr
		where pr.hogar_id = p_hogar
			and pr.prestador_id = (select id from me)
			and pr.estado = 'activo'
	),
	sum_prestamos_les_di as (
		select otro, sum(pendiente) as monto from prestamos_les_di group by otro
	),
	-- == Préstamos donde YO soy receptor (les debo el monto) ==
	-- Descuento mis devoluciones pendientes + confirmadas (asimétrico).
	prestamos_me_dieron as (
		select
			pr.prestador_id as otro,
			pr.monto - coalesce((
				select sum(p.monto) from public.pagos p
				where p.prestamo_id = pr.id
					and p.estado in ('pendiente', 'confirmado')
			), 0) as pendiente
		from public.prestamos pr
		where pr.hogar_id = p_hogar
			and pr.receptor_id = (select id from me)
			and pr.estado = 'activo'
	),
	sum_prestamos_me_dieron as (
		select otro, sum(pendiente) as monto from prestamos_me_dieron group by otro
	)
	select
		p.user_id::uuid as otro_id,
		(
			coalesce(md.monto, 0)         -- gastos: me debe
			- coalesce(ld.monto, 0)       -- gastos: le debo
			- coalesce(pr.monto, 0)       -- pagos: me pagó
			+ coalesce(ph.monto, 0)       -- pagos: yo le pagué
			+ coalesce(pld.monto, 0)      -- préstamos: le di
			- coalesce(pmd.monto, 0)      -- préstamos: me dio
		)::numeric as saldo
	from pares p
	left join sum_me_deben md on md.otro = p.user_id
	left join sum_le_debo ld on ld.otro = p.user_id
	left join pagos_recibidos pr on pr.otro = p.user_id
	left join pagos_hechos ph on ph.otro = p.user_id
	left join sum_prestamos_les_di pld on pld.otro = p.user_id
	left join sum_prestamos_me_dieron pmd on pmd.otro = p.user_id;
end;
$$;
