-- ============================================================
-- 005_gastos_compartidos.sql
-- Fase 4 del plan: módulo Gastos compartidos.
--
-- Crea:
--   * categorias        — predefinidas (hogar_id NULL) o por hogar
--   * gastos_compartidos — cabecera del gasto (pagador, monto, modo…)
--   * gasto_divisiones   — línea por participante con su parte
--   * RPC registrar_gasto / actualizar_gasto — operación atómica
--   * trigger updated_at en gastos_compartidos
--
-- Reglas (de PLAN_DESARROLLO.md / DECISIONES.md):
--   * Solo miembros del hogar ven sus gastos (RLS).
--   * Solo el PAGADOR (quien lo registró) puede editar/borrar el gasto.
--   * Modos de división: iguales | porcentaje | exacto | partes.
--   * Validación: monto > 0, sum(divisiones) = monto (toleramos 0.01 cop).
--   * Operación atómica: cabecera + líneas en una transacción.
-- ============================================================

-- ============================================================
-- CATEGORIAS
-- hogar_id NULL = predefinida (visible para cualquier autenticado).
-- ============================================================
create table if not exists public.categorias (
	id uuid primary key default gen_random_uuid(),
	hogar_id uuid references public.hogares(id) on delete cascade,
	nombre text not null,
	icono text, -- nombre de un icono lucide (mapeado en el cliente)
	orden int not null default 0,
	created_at timestamptz not null default now(),
	-- nombres únicos dentro del mismo hogar (y dentro de las predefinidas)
	unique (hogar_id, nombre)
);

alter table public.categorias enable row level security;

-- Lectura: predefinidas para todos, propias para miembros del hogar.
drop policy if exists "categorias_select" on public.categorias;
create policy "categorias_select" on public.categorias for select using (
	hogar_id is null or public.es_miembro(hogar_id)
);

-- Crear/editar/borrar categorías propias: cualquier miembro del hogar.
drop policy if exists "categorias_insert" on public.categorias;
create policy "categorias_insert" on public.categorias for insert with check (
	hogar_id is not null and public.es_miembro(hogar_id)
);
drop policy if exists "categorias_update" on public.categorias;
create policy "categorias_update" on public.categorias for update using (
	hogar_id is not null and public.es_miembro(hogar_id)
) with check (
	hogar_id is not null and public.es_miembro(hogar_id)
);
drop policy if exists "categorias_delete" on public.categorias;
create policy "categorias_delete" on public.categorias for delete using (
	hogar_id is not null and public.es_miembro(hogar_id)
);

-- Seed: categorías predefinidas (idempotente).
insert into public.categorias (hogar_id, nombre, icono, orden) values
	(null, 'Mercado',    'shopping-cart', 1),
	(null, 'Domicilios', 'bike',          2),
	(null, 'Salidas',    'utensils',      3),
	(null, 'Transporte', 'car',           4),
	(null, 'Hogar',      'house',         5),
	(null, 'Salud',      'heart-pulse',   6),
	(null, 'Otros',      'tag',           7)
on conflict (hogar_id, nombre) do nothing;

-- ============================================================
-- GASTOS_COMPARTIDOS (cabecera)
-- ============================================================
create table if not exists public.gastos_compartidos (
	id uuid primary key default gen_random_uuid(),
	hogar_id uuid not null references public.hogares(id) on delete cascade,
	pagador_id uuid not null references auth.users(id) on delete restrict,
	categoria_id uuid references public.categorias(id) on delete set null,
	titulo text not null check (length(trim(titulo)) > 0),
	monto numeric(14, 2) not null check (monto > 0),
	fecha date not null default current_date,
	modo text not null check (modo in ('iguales', 'porcentaje', 'exacto', 'partes')),
	notas text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index if not exists gastos_compartidos_hogar_fecha_idx
	on public.gastos_compartidos (hogar_id, fecha desc, created_at desc);

alter table public.gastos_compartidos enable row level security;

drop policy if exists "gastos_select" on public.gastos_compartidos;
create policy "gastos_select" on public.gastos_compartidos for select using (
	public.es_miembro(hogar_id)
);
drop policy if exists "gastos_insert" on public.gastos_compartidos;
create policy "gastos_insert" on public.gastos_compartidos for insert with check (
	public.es_miembro(hogar_id) and pagador_id = auth.uid()
);
drop policy if exists "gastos_update" on public.gastos_compartidos;
create policy "gastos_update" on public.gastos_compartidos for update using (
	public.es_miembro(hogar_id) and pagador_id = auth.uid()
) with check (
	public.es_miembro(hogar_id) and pagador_id = auth.uid()
);
drop policy if exists "gastos_delete" on public.gastos_compartidos;
create policy "gastos_delete" on public.gastos_compartidos for delete using (
	public.es_miembro(hogar_id) and pagador_id = auth.uid()
);

-- updated_at automático.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
	new.updated_at := now();
	return new;
end;
$$;

drop trigger if exists gastos_compartidos_updated_at on public.gastos_compartidos;
create trigger gastos_compartidos_updated_at
	before update on public.gastos_compartidos
	for each row execute function public.set_updated_at();

-- ============================================================
-- GASTO_DIVISIONES (línea por participante)
-- ============================================================
create table if not exists public.gasto_divisiones (
	id uuid primary key default gen_random_uuid(),
	gasto_id uuid not null references public.gastos_compartidos(id) on delete cascade,
	participante_id uuid not null references auth.users(id) on delete cascade,
	monto numeric(14, 2) not null check (monto >= 0),
	unique (gasto_id, participante_id)
);

create index if not exists gasto_divisiones_participante_idx
	on public.gasto_divisiones (participante_id);

alter table public.gasto_divisiones enable row level security;

-- Las divisiones se ven si el gasto padre es visible (miembro del hogar).
drop policy if exists "divisiones_select" on public.gasto_divisiones;
create policy "divisiones_select" on public.gasto_divisiones for select using (
	exists (
		select 1 from public.gastos_compartidos g
		where g.id = gasto_divisiones.gasto_id and public.es_miembro(g.hogar_id)
	)
);
-- Solo el pagador del gasto puede modificar sus líneas.
drop policy if exists "divisiones_insert" on public.gasto_divisiones;
create policy "divisiones_insert" on public.gasto_divisiones for insert with check (
	exists (
		select 1 from public.gastos_compartidos g
		where g.id = gasto_divisiones.gasto_id and g.pagador_id = auth.uid()
	)
);
drop policy if exists "divisiones_update" on public.gasto_divisiones;
create policy "divisiones_update" on public.gasto_divisiones for update using (
	exists (
		select 1 from public.gastos_compartidos g
		where g.id = gasto_divisiones.gasto_id and g.pagador_id = auth.uid()
	)
);
drop policy if exists "divisiones_delete" on public.gasto_divisiones;
create policy "divisiones_delete" on public.gasto_divisiones for delete using (
	exists (
		select 1 from public.gastos_compartidos g
		where g.id = gasto_divisiones.gasto_id and g.pagador_id = auth.uid()
	)
);

-- ============================================================
-- RPC: registrar_gasto (atómico) — devuelve id del gasto creado.
-- p_divisiones: jsonb array [{ "participante_id": uuid, "monto": numeric }, ...]
-- ============================================================
create or replace function public.registrar_gasto(
	p_hogar uuid,
	p_categoria uuid,
	p_titulo text,
	p_monto numeric,
	p_fecha date,
	p_modo text,
	p_notas text,
	p_divisiones jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
	v_gasto_id uuid;
	v_total numeric := 0;
	v_div jsonb;
begin
	if not public.es_miembro(p_hogar) then
		raise exception 'No perteneces a este hogar' using errcode = '42501';
	end if;
	if p_monto is null or p_monto <= 0 then
		raise exception 'El monto debe ser mayor a 0' using errcode = '22023';
	end if;
	if p_modo not in ('iguales', 'porcentaje', 'exacto', 'partes') then
		raise exception 'Modo de división inválido' using errcode = '22023';
	end if;
	if p_divisiones is null or jsonb_array_length(p_divisiones) = 0 then
		raise exception 'Debe haber al menos un participante' using errcode = '22023';
	end if;

	-- Suma de divisiones tiene que igualar el monto (tolerancia 0.01).
	for v_div in select * from jsonb_array_elements(p_divisiones) loop
		v_total := v_total + (v_div->>'monto')::numeric;
	end loop;
	if abs(v_total - p_monto) > 0.01 then
		raise exception 'La suma de divisiones (%) no coincide con el monto (%)', v_total, p_monto
			using errcode = '22023';
	end if;

	insert into public.gastos_compartidos
		(hogar_id, pagador_id, categoria_id, titulo, monto, fecha, modo, notas)
	values
		(p_hogar, auth.uid(), p_categoria, trim(p_titulo), p_monto, coalesce(p_fecha, current_date), p_modo, nullif(trim(p_notas), ''))
	returning id into v_gasto_id;

	insert into public.gasto_divisiones (gasto_id, participante_id, monto)
	select v_gasto_id, (d->>'participante_id')::uuid, (d->>'monto')::numeric
	from jsonb_array_elements(p_divisiones) d;

	return v_gasto_id;
end;
$$;

grant execute on function public.registrar_gasto(uuid, uuid, text, numeric, date, text, text, jsonb) to authenticated;

-- ============================================================
-- RPC: actualizar_gasto (atómico) — reemplaza cabecera y divisiones.
-- Solo el pagador puede editar; la RLS lo refuerza para UPDATE/INSERT/DELETE.
-- ============================================================
create or replace function public.actualizar_gasto(
	p_gasto uuid,
	p_categoria uuid,
	p_titulo text,
	p_monto numeric,
	p_fecha date,
	p_modo text,
	p_notas text,
	p_divisiones jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
	v_hogar uuid;
	v_pagador uuid;
	v_total numeric := 0;
	v_div jsonb;
begin
	select hogar_id, pagador_id into v_hogar, v_pagador
	from public.gastos_compartidos where id = p_gasto;

	if v_hogar is null then
		raise exception 'Gasto no encontrado' using errcode = '02000';
	end if;
	if v_pagador <> auth.uid() then
		raise exception 'Solo el pagador puede editar el gasto' using errcode = '42501';
	end if;
	if p_monto is null or p_monto <= 0 then
		raise exception 'El monto debe ser mayor a 0' using errcode = '22023';
	end if;
	if p_modo not in ('iguales', 'porcentaje', 'exacto', 'partes') then
		raise exception 'Modo de división inválido' using errcode = '22023';
	end if;
	if p_divisiones is null or jsonb_array_length(p_divisiones) = 0 then
		raise exception 'Debe haber al menos un participante' using errcode = '22023';
	end if;

	for v_div in select * from jsonb_array_elements(p_divisiones) loop
		v_total := v_total + (v_div->>'monto')::numeric;
	end loop;
	if abs(v_total - p_monto) > 0.01 then
		raise exception 'La suma de divisiones (%) no coincide con el monto (%)', v_total, p_monto
			using errcode = '22023';
	end if;

	update public.gastos_compartidos
	set categoria_id = p_categoria,
		titulo = trim(p_titulo),
		monto = p_monto,
		fecha = coalesce(p_fecha, current_date),
		modo = p_modo,
		notas = nullif(trim(p_notas), '')
	where id = p_gasto;

	-- Reemplaza todas las divisiones (la cardinalidad puede cambiar).
	delete from public.gasto_divisiones where gasto_id = p_gasto;
	insert into public.gasto_divisiones (gasto_id, participante_id, monto)
	select p_gasto, (d->>'participante_id')::uuid, (d->>'monto')::numeric
	from jsonb_array_elements(p_divisiones) d;
end;
$$;

grant execute on function public.actualizar_gasto(uuid, uuid, text, numeric, date, text, text, jsonb) to authenticated;
