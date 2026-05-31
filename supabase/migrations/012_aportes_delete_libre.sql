-- ============================================================
-- 012_aportes_delete_libre.sql — Borrar aportes lo puede hacer cualquier
-- miembro del hogar.
--
-- Antes (migración 009): solo el registrador, el participante dueño de la
-- división o el pagador del gasto podían borrar.
-- Ahora: cualquier miembro del hogar puede borrar cualquier aporte. El
-- modelo de Splitmate es colaborativo dentro del hogar; quien quiera
-- corregir un aporte ajeno debería poder.
-- ============================================================

drop policy if exists "aportes_delete" on public.aportes;

create policy "aportes_delete" on public.aportes for delete using (
	exists (
		select 1
		from public.gasto_divisiones d
		join public.gastos_compartidos g on g.id = d.gasto_id
		where d.id = aportes.division_id
			and public.es_miembro(g.hogar_id)
	)
);
