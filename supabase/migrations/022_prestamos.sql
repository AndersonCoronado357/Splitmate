-- ============================================================
-- 022_prestamos.sql — Fase 7: préstamos directos (módulo 2).
--
-- Un préstamo es una transferencia DIRECTA de dinero entre dos miembros
-- del hogar SIN relación con un gasto compartido. Vive en su propia
-- pestaña, con su propio historial, separado visualmente de "gastos".
-- El balance neteado sí los combina (porque al final ambos representan
-- deuda entre dos personas).
--
-- Flujo:
--   1. El prestador registra → estado = 'pendiente' (no afecta balance).
--   2. El receptor confirma → estado = 'activo' (a partir de aquí cuenta
--      en el balance: receptor le debe el monto al prestador).
--   3. El receptor rechaza → estado = 'rechazado' (no cuenta).
--   4. Cuando los pagos confirmados igualan el monto → 'saldado'.
--
-- Las devoluciones reutilizan la tabla `pagos`: agregamos columna
-- opcional `prestamo_id`. Si está poblada, ese pago descuenta del
-- préstamo (no del balance de gastos).
-- ============================================================

create table if not exists public.prestamos (
	id uuid primary key default gen_random_uuid(),
	hogar_id uuid not null references public.hogares (id) on delete cascade,
	prestador_id uuid not null references auth.users (id) on delete restrict,
	receptor_id uuid not null references auth.users (id) on delete restrict,
	monto numeric(14, 2) not null check (monto > 0),
	fecha date not null default current_date,
	motivo text,
	fecha_esperada date,
	estado text not null default 'pendiente'
		check (estado in ('pendiente', 'activo', 'saldado', 'rechazado')),
	registrado_por uuid not null references auth.users (id) on delete restrict,
	confirmado_at timestamptz,
	created_at timestamptz not null default now(),
	check (prestador_id <> receptor_id)
);

create index if not exists prestamos_hogar_idx
	on public.prestamos (hogar_id, created_at desc);
create index if not exists prestamos_pendientes_idx
	on public.prestamos (hogar_id, receptor_id) where estado = 'pendiente';
create index if not exists prestamos_activos_idx
	on public.prestamos (hogar_id) where estado = 'activo';

alter table public.prestamos enable row level security;

drop policy if exists "prestamos_select" on public.prestamos;
create policy "prestamos_select" on public.prestamos for select using (
	public.es_miembro(hogar_id)
);

-- Solo el prestador registra. registrado_por = auth.uid().
drop policy if exists "prestamos_insert" on public.prestamos;
create policy "prestamos_insert" on public.prestamos for insert with check (
	public.es_miembro(hogar_id)
	and registrado_por = auth.uid()
	and prestador_id = auth.uid()
);

-- Update:
--   * Receptor: puede mover entre estados (confirmar/rechazar) mientras
--     siga pendiente; también puede marcar saldado de forma manual sobre
--     un activo si así lo desea.
--   * Prestador: puede editar monto/fecha/motivo MIENTRAS esté pendiente
--     (por si se equivocó); también puede marcar saldado.
drop policy if exists "prestamos_update" on public.prestamos;
create policy "prestamos_update" on public.prestamos for update using (
	public.es_miembro(hogar_id)
	and (
		receptor_id = auth.uid()
		or (prestador_id = auth.uid() and estado = 'pendiente')
		or (prestador_id = auth.uid() and estado = 'activo')
	)
);

-- Borrar: solo el registrador, y solo si sigue pendiente.
drop policy if exists "prestamos_delete" on public.prestamos;
create policy "prestamos_delete" on public.prestamos for delete using (
	public.es_miembro(hogar_id)
	and registrado_por = auth.uid()
	and estado = 'pendiente'
);

-- Realtime: el receptor recibe al instante la solicitud de confirmación,
-- el prestador ve al instante cuando se le confirma/rechaza.
do $$
begin
	begin
		alter publication supabase_realtime add table public.prestamos;
	exception when duplicate_object then null;
	end;
end $$;

alter table public.prestamos replica identity full;

-- ============================================================
-- pagos: agregamos prestamo_id opcional para asociar devoluciones a
-- un préstamo concreto. Si está nulo, el pago es genérico (Fase 6).
-- ============================================================

alter table public.pagos
	add column if not exists prestamo_id uuid references public.prestamos(id) on delete cascade;

create index if not exists pagos_prestamo_idx on public.pagos (prestamo_id)
	where prestamo_id is not null;
