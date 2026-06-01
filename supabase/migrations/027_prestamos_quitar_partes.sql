-- ============================================================
-- 027_prestamos_quitar_partes.sql
--
-- El modo 'partes' no aporta valor sobre 'porcentaje' / 'exacto'. Lo quitamos
-- del enum de `tipo_pago` de préstamos para no confundir al usuario.
-- Préstamos viejos en 'partes' se migran a 'iguales' (valor seguro).
-- ============================================================

update public.prestamos set tipo_pago = 'iguales' where tipo_pago = 'partes';

alter table public.prestamos drop constraint if exists prestamos_tipo_pago_check;
alter table public.prestamos
	add constraint prestamos_tipo_pago_check
	check (tipo_pago in ('iguales', 'porcentaje', 'exacto'));
