-- ============================================================
-- 025_prestamos_quitar_unico.sql
--
-- Sacamos 'unico' del enum de tipo_pago: el módulo de préstamos queda con
-- los mismos 4 modos de gastos compartidos (iguales / porcentaje / exacto
-- / partes), para mantener vocabulario consistente. Préstamos existentes
-- en 'unico' se migran a 'iguales' como default razonable.
-- ============================================================

-- 1. Migrar préstamos viejos en 'unico' a 'iguales'.
update public.prestamos set tipo_pago = 'iguales' where tipo_pago = 'unico';

-- 2. Reemplazar el check y el default.
alter table public.prestamos drop constraint if exists prestamos_tipo_pago_check;
alter table public.prestamos
	add constraint prestamos_tipo_pago_check
	check (tipo_pago in ('iguales', 'porcentaje', 'exacto', 'partes'));

alter table public.prestamos alter column tipo_pago set default 'iguales';
