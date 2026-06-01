-- ============================================================
-- 026_prestamo_cuotas.sql
--
-- Plan de devolución acordado al crear un préstamo. Cada cuota guarda su
-- número (1, 2, 3…), monto y fecha esperada opcional. La suma de los
-- montos tiene que igualar el monto del préstamo.
--
-- Esto es plan/acuerdo: las devoluciones reales viven en `pagos`. Las
-- cuotas sirven para que ambos vean cómo se pactó devolver.
-- ============================================================

create table if not exists public.prestamo_cuotas (
	id uuid primary key default gen_random_uuid(),
	prestamo_id uuid not null references public.prestamos(id) on delete cascade,
	numero int not null check (numero > 0),
	monto numeric(14, 2) not null check (monto > 0),
	fecha_esperada date,
	created_at timestamptz not null default now(),
	unique (prestamo_id, numero)
);

create index if not exists prestamo_cuotas_prestamo_idx
	on public.prestamo_cuotas (prestamo_id, numero);

alter table public.prestamo_cuotas enable row level security;

-- Lectura: cualquier miembro del hogar del préstamo padre.
drop policy if exists "prestamo_cuotas_select" on public.prestamo_cuotas;
create policy "prestamo_cuotas_select" on public.prestamo_cuotas for select using (
	exists (
		select 1
		from public.prestamos pr
		where pr.id = prestamo_cuotas.prestamo_id
			and public.es_miembro(pr.hogar_id)
	)
);

-- Insert/update/delete: solo el prestador (= quien registró) mientras siga
-- pendiente. Después de confirmado el plan queda congelado.
drop policy if exists "prestamo_cuotas_insert" on public.prestamo_cuotas;
create policy "prestamo_cuotas_insert" on public.prestamo_cuotas for insert with check (
	exists (
		select 1
		from public.prestamos pr
		where pr.id = prestamo_cuotas.prestamo_id
			and pr.prestador_id = auth.uid()
	)
);

drop policy if exists "prestamo_cuotas_update" on public.prestamo_cuotas;
create policy "prestamo_cuotas_update" on public.prestamo_cuotas for update using (
	exists (
		select 1
		from public.prestamos pr
		where pr.id = prestamo_cuotas.prestamo_id
			and pr.prestador_id = auth.uid()
			and pr.estado = 'pendiente'
	)
);

drop policy if exists "prestamo_cuotas_delete" on public.prestamo_cuotas;
create policy "prestamo_cuotas_delete" on public.prestamo_cuotas for delete using (
	exists (
		select 1
		from public.prestamos pr
		where pr.id = prestamo_cuotas.prestamo_id
			and pr.prestador_id = auth.uid()
	)
);

-- Realtime: que ambos lados vean cambios del plan al instante.
do $$
begin
	begin
		alter publication supabase_realtime add table public.prestamo_cuotas;
	exception when duplicate_object then null;
	end;
end $$;

alter table public.prestamo_cuotas replica identity full;
