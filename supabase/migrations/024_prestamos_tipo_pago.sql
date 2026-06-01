-- ============================================================
-- 024_prestamos_tipo_pago.sql
--
-- Cuando un prestador registra un préstamo, ahora también acuerda CÓMO le
-- van a devolver la plata. Es solo informativo (no fuerza estructura de
-- cuotas) — el receptor sigue devolviendo con la cantidad que quiera,
-- pero queda registrado el acuerdo.
--
-- Los 4 modos espejan los de gastos compartidos para mantener vocabulario
-- consistente entre módulos:
--   * iguales    — N cuotas del mismo monto.
--   * porcentaje — porcentajes del total cada cuota.
--   * exacto     — cuotas con montos específicos pactados.
--   * partes     — cuotas en partes proporcionales (1, 2, 3…).
-- Más 'unico' como default (devolución en un único pago).
-- ============================================================

alter table public.prestamos
	add column if not exists tipo_pago text not null default 'unico'
		check (tipo_pago in ('unico', 'iguales', 'porcentaje', 'exacto', 'partes'));
