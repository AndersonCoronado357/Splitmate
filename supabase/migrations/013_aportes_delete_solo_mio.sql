-- ============================================================
-- 013_aportes_delete_solo_mio.sql — Solo quien registró un aporte puede
-- borrarlo.
--
-- Trayectoria de esta política:
--   006: solo registrado_por = auth.uid()
--   009: registrador OR participante OR pagador del gasto
--   012: cualquier miembro del hogar
--   013 (esta): vuelta al criterio cerrado — solo quien registró
--
-- Por qué cerramos: el aporte representa un pago real (mío o tuyo). Que un
-- tercero pueda anular el registro de un pago ajeno es problemático.
-- Quien lo registra es responsable de su propio historial. Si hay un error
-- en el aporte de otra persona, hay que hablarlo, no borrarlo a sus espaldas.
-- ============================================================

drop policy if exists "aportes_delete" on public.aportes;

create policy "aportes_delete" on public.aportes for delete using (
	registrado_por = auth.uid()
);
