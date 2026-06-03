-- ============================================================
-- 036 — Permitir al receptor registrar un pago como ya recibido.
--
-- Antes: solo el pagador podía insertar un pago (RLS pagos_insert
-- exigía pagador_id = auth.uid()). El receptor tenía que esperar a que
-- el pagador lo registrara para poder confirmar/rechazar.
--
-- Cambio: el receptor también puede registrar un pago, pero SOLO si
-- entra como 'confirmado' (no tiene sentido un pendiente registrado
-- por el receptor; sería "yo digo que él me pagará"). Esto cubre el
-- caso de /saldar: "Ñala ya me transfirió, lo marco" → entra confirmado
-- y se descuenta del balance en el acto.
-- ============================================================

drop policy if exists "pagos_insert" on public.pagos;
create policy "pagos_insert" on public.pagos for insert with check (
	public.es_miembro(hogar_id)
	and registrado_por = auth.uid()
	and (
		-- Caso A: pagador registra su pago — queda pendiente para confirmar.
		pagador_id = auth.uid()
		-- Caso B: receptor registra un pago que ya recibió — entra confirmado.
		or (receptor_id = auth.uid() and estado = 'confirmado')
	)
);
