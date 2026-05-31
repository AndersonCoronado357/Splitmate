-- ============================================================
-- 018_aportes_estado.sql
--
-- Unifica "pagos" y "aportes" en un solo concepto: TODO movimiento de dinero
-- entre miembros va atado a un gasto/division específico vía `aportes`.
--
-- Cambios:
--   * `aportes` gana `estado` ('pendiente' | 'confirmado' | 'rechazado')
--     y `confirmado_at`.
--   * Aportes existentes pasan a 'confirmado' (eran unilaterales y ya
--     contaban en el balance).
--   * Política de update: el pagador del gasto puede confirmar/rechazar
--     aportes pendientes sobre divisiones de su gasto.
--   * Se elimina la tabla `pagos` (queda obsoleta — todo es aporte).
-- ============================================================

-- 1. Quitar pagos por completo (la migración 015/016/017 deja de aplicar).
do $$
begin
	begin
		alter publication supabase_realtime drop table public.pagos;
	exception when undefined_object then null;
	end;
end $$;
drop table if exists public.pagos cascade;

-- 2. Estado en aportes.
alter table public.aportes
	add column if not exists estado text not null default 'confirmado'
		check (estado in ('pendiente', 'confirmado', 'rechazado'));

alter table public.aportes
	add column if not exists confirmado_at timestamptz;

-- Los aportes ya creados con el modelo viejo siguen contando como confirmados.
update public.aportes set estado = 'confirmado' where estado is null;

-- Índice para pendientes (uso típico: bandeja del pagador).
create index if not exists aportes_pendientes_idx
	on public.aportes (division_id) where estado = 'pendiente';

-- 3. RLS: confirmar/rechazar.
-- El PAGADOR del gasto puede pasar un aporte de 'pendiente' a 'confirmado' o
-- 'rechazado'. Quien registró el aporte puede cambiarlo también mientras siga
-- pendiente (por si se equivocó). Nadie puede modificar uno ya cerrado.
drop policy if exists "aportes_update" on public.aportes;
create policy "aportes_update" on public.aportes for update using (
	exists (
		select 1
		from public.gasto_divisiones d
		join public.gastos_compartidos g on g.id = d.gasto_id
		where d.id = aportes.division_id
			and public.es_miembro(g.hogar_id)
			and (
				g.pagador_id = auth.uid()
				or (aportes.registrado_por = auth.uid() and aportes.estado = 'pendiente')
			)
	)
);

-- 4. Borrar: el pagador del gasto puede borrar aportes pendientes (para
-- "deshacer" la solicitud si el deudor se equivocó). Quien lo registró puede
-- borrar siempre (regla previa).
drop policy if exists "aportes_delete" on public.aportes;
create policy "aportes_delete" on public.aportes for delete using (
	registrado_por = auth.uid()
	or exists (
		select 1
		from public.gasto_divisiones d
		join public.gastos_compartidos g on g.id = d.gasto_id
		where d.id = aportes.division_id
			and g.pagador_id = auth.uid()
			and aportes.estado = 'pendiente'
	)
);
