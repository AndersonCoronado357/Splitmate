-- ============================================================
-- 011_realtime_gastos.sql — Fase 5.3: Tiempo real.
--
-- Habilita la publicación de Supabase Realtime sobre las tres tablas que
-- afectan al balance del hogar: gastos_compartidos, gasto_divisiones y
-- aportes. Cuando otro miembro del hogar crea/edita/borra cualquiera de
-- estas filas, los clientes suscritos reciben el evento y refrescan el
-- balance al instante.
--
-- La publicación `supabase_realtime` ya existe en proyectos de Supabase.
-- `add table` es idempotente con `if not exists`-style si la tabla ya está
-- incluida; aquí usamos un DO block defensivo para no fallar al reaplicar.
-- ============================================================

do $$
begin
	-- gastos_compartidos
	begin
		alter publication supabase_realtime add table public.gastos_compartidos;
	exception when duplicate_object then null;
	end;

	-- gasto_divisiones
	begin
		alter publication supabase_realtime add table public.gasto_divisiones;
	exception when duplicate_object then null;
	end;

	-- aportes
	begin
		alter publication supabase_realtime add table public.aportes;
	exception when duplicate_object then null;
	end;
end $$;
