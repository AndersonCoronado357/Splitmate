-- ============================================================
-- 019_balance_aportes_estado.sql
--
-- El balance ya no consulta `pagos` (la tabla murió en 018). Todos los
-- movimientos están en `aportes` con estado.
--
-- Semántica asimétrica:
--   * Lo que YO debo a otros (le_debo): cuento aportes míos en estado
--     'pendiente' o 'confirmado'. Mi pantalla refleja al instante lo que
--     yo digo haber abonado, incluso si la contraparte no confirmó aún.
--   * Lo que OTROS me deben (me_deben): solo descuento aportes 'confirmado'.
--     No puedo dar por cobrado lo que aún no confirmé.
--
-- saldo > 0 → el otro me debe.
-- saldo < 0 → yo le debo al otro.
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
	-- Lo que el otro me debe (yo soy pagador, otro participa).
	-- Aportes de OTROS sobre mis gastos: cuento solo CONFIRMADOS
	-- (yo no puedo dar por cobrado lo que aún no confirmé).
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
	-- Lo que yo le debo al otro (otro es pagador, yo participo).
	-- Aportes MÍOS: cuento PENDIENTES + CONFIRMADOS (mi pantalla refleja
	-- al instante lo que dije haber abonado).
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
	)
	select
		p.user_id::uuid as otro_id,
		(
			coalesce(md.monto, 0) - coalesce(ld.monto, 0)
		)::numeric as saldo
	from pares p
	left join sum_me_deben md on md.otro = p.user_id
	left join sum_le_debo ld on ld.otro = p.user_id;
end;
$$;
