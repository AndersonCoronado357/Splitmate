-- ============================================================
-- Migración 009 — Borrar aportes con permisos más amplios.
--
-- Antes: solo quien REGISTRÓ el aporte podía borrarlo. Esto deja al usuario
-- "atrapado" cuando otra persona registró un aporte sobre su propia parte (o
-- cuando el pagador quiere revertir un cobro mal registrado).
--
-- Ahora: pueden borrar un aporte:
--   1. quien lo registró (registrado_por = auth.uid()), o
--   2. el participante dueño de la división (es su parte, su historial), o
--   3. el pagador del gasto (es "dueño" del gasto y de su cuenta).
-- ============================================================

drop policy if exists "aportes_delete" on public.aportes;

create policy "aportes_delete" on public.aportes for delete using (
	registrado_por = auth.uid()
	or exists (
		select 1
		from public.gasto_divisiones d
		join public.gastos_compartidos g on g.id = d.gasto_id
		where d.id = aportes.division_id
			and (d.participante_id = auth.uid() or g.pagador_id = auth.uid())
	)
);
