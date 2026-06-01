-- ============================================================
-- 028_auto_saldar_prestamo.sql
--
-- Cuando una devolución pasa a 'confirmado', revisamos si la suma de las
-- devoluciones confirmadas ya cubre el monto del préstamo. Si sí, el
-- préstamo pasa automáticamente a 'saldado'. Así no hay que apretar
-- ningún botón.
-- ============================================================

create or replace function public.recalcular_estado_prestamo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
	v_monto numeric;
	v_estado text;
	v_sum_confirmado numeric;
begin
	-- Solo nos interesa cuando el pago está atado a un préstamo.
	if new.prestamo_id is null then
		return new;
	end if;

	select monto, estado into v_monto, v_estado
	from public.prestamos where id = new.prestamo_id;

	if v_estado is null then
		return new;
	end if;

	-- Solo intentamos auto-saldar si el préstamo está activo.
	if v_estado <> 'activo' then
		return new;
	end if;

	select coalesce(sum(monto), 0) into v_sum_confirmado
	from public.pagos
	where prestamo_id = new.prestamo_id and estado = 'confirmado';

	-- Toleramos 0.01 por redondeos.
	if v_sum_confirmado >= v_monto - 0.01 then
		update public.prestamos set estado = 'saldado' where id = new.prestamo_id;
	end if;

	return new;
end;
$$;

drop trigger if exists pagos_recalc_prestamo on public.pagos;
create trigger pagos_recalc_prestamo
	after insert or update on public.pagos
	for each row
	execute function public.recalcular_estado_prestamo();
