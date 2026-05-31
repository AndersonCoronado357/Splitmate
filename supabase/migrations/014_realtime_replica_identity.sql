-- ============================================================
-- 014_realtime_replica_identity.sql — Hace que Realtime emita los eventos
-- DELETE/UPDATE con datos suficientes para que el cliente reciba la
-- notificación. Sin esto, los DELETE no traen la fila vieja y el filtro
-- del cliente (`hogar_id=eq.X`) se queda mudo.
-- ============================================================

alter table public.gastos_compartidos replica identity full;
alter table public.gasto_divisiones replica identity full;
alter table public.aportes replica identity full;
