-- ============================================================
-- 029_gastos_fijos.sql — Fase 9: gastos fijos (módulo 3).
--
-- Es un módulo APARTE de gastos compartidos. Vive en su propia pestaña.
-- Modelo:
--   * `gastos_fijos_plantilla`            — el acuerdo del gasto mensual
--                                          (arriendo, internet, etc.).
--   * `gastos_fijos_plantilla_division`   — cómo se reparte entre miembros.
--   * `gastos_fijos_mes`                  — la instancia mensual generada
--                                          (un préstamo mes a mes).
--   * `gastos_fijos_mes_division`         — snapshot del reparto del mes.
--   * `gastos_fijos_aportes`              — quién ha pagado su parte y cuándo.
-- Importante: este módulo NO genera deuda entre personas (no toca
-- balance_hogar). Solo lleva el estado del mes.
-- ============================================================

-- ============================================================
-- 1. PLANTILLA — la regla recurrente
-- ============================================================
create table if not exists public.gastos_fijos_plantilla (
	id uuid primary key default gen_random_uuid(),
	hogar_id uuid not null references public.hogares (id) on delete cascade,
	nombre text not null check (length(trim(nombre)) > 0),
	monto numeric(14, 2) not null check (monto > 0),
	modo text not null check (modo in ('iguales', 'porcentaje', 'exacto', 'partes')),
	categoria_id uuid references public.categorias (id) on delete set null,
	-- Día del mes en que se considera "vence" (1-28 para evitar feb 30).
	dia_vencimiento int not null default 1 check (dia_vencimiento between 1 and 28),
	activa boolean not null default true,
	notas text,
	registrado_por uuid not null references auth.users (id) on delete restrict,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index if not exists gastos_fijos_plantilla_hogar_idx
	on public.gastos_fijos_plantilla (hogar_id, activa, created_at desc);

alter table public.gastos_fijos_plantilla enable row level security;

drop policy if exists "fijos_plantilla_select" on public.gastos_fijos_plantilla;
create policy "fijos_plantilla_select" on public.gastos_fijos_plantilla for select using (
	public.es_miembro(hogar_id)
);

drop policy if exists "fijos_plantilla_insert" on public.gastos_fijos_plantilla;
create policy "fijos_plantilla_insert" on public.gastos_fijos_plantilla for insert with check (
	public.es_miembro(hogar_id) and registrado_por = auth.uid()
);

drop policy if exists "fijos_plantilla_update" on public.gastos_fijos_plantilla;
create policy "fijos_plantilla_update" on public.gastos_fijos_plantilla for update using (
	public.es_miembro(hogar_id)
) with check (
	public.es_miembro(hogar_id)
);

drop policy if exists "fijos_plantilla_delete" on public.gastos_fijos_plantilla;
create policy "fijos_plantilla_delete" on public.gastos_fijos_plantilla for delete using (
	public.es_miembro(hogar_id)
);

drop trigger if exists gastos_fijos_plantilla_updated_at on public.gastos_fijos_plantilla;
create trigger gastos_fijos_plantilla_updated_at
	before update on public.gastos_fijos_plantilla
	for each row execute function public.set_updated_at();

-- ============================================================
-- 2. DISTRIBUCIÓN DE LA PLANTILLA — cuánto le toca a cada miembro
-- El `valor` interpreta según el modo de la plantilla:
--   * 'iguales'   → ignorado (se calcula al generar)
--   * 'porcentaje'→ % del total (0-100)
--   * 'exacto'    → monto absoluto
--   * 'partes'    → peso proporcional
-- ============================================================
create table if not exists public.gastos_fijos_plantilla_division (
	id uuid primary key default gen_random_uuid(),
	plantilla_id uuid not null references public.gastos_fijos_plantilla(id) on delete cascade,
	participante_id uuid not null references auth.users(id) on delete cascade,
	valor numeric(14, 4) not null default 0 check (valor >= 0),
	unique (plantilla_id, participante_id)
);

alter table public.gastos_fijos_plantilla_division enable row level security;

drop policy if exists "fijos_plantilla_div_select" on public.gastos_fijos_plantilla_division;
create policy "fijos_plantilla_div_select" on public.gastos_fijos_plantilla_division for select using (
	exists (
		select 1 from public.gastos_fijos_plantilla p
		where p.id = gastos_fijos_plantilla_division.plantilla_id
			and public.es_miembro(p.hogar_id)
	)
);

drop policy if exists "fijos_plantilla_div_insert" on public.gastos_fijos_plantilla_division;
create policy "fijos_plantilla_div_insert" on public.gastos_fijos_plantilla_division for insert with check (
	exists (
		select 1 from public.gastos_fijos_plantilla p
		where p.id = gastos_fijos_plantilla_division.plantilla_id
			and public.es_miembro(p.hogar_id)
	)
);

drop policy if exists "fijos_plantilla_div_update" on public.gastos_fijos_plantilla_division;
create policy "fijos_plantilla_div_update" on public.gastos_fijos_plantilla_division for update using (
	exists (
		select 1 from public.gastos_fijos_plantilla p
		where p.id = gastos_fijos_plantilla_division.plantilla_id
			and public.es_miembro(p.hogar_id)
	)
);

drop policy if exists "fijos_plantilla_div_delete" on public.gastos_fijos_plantilla_division;
create policy "fijos_plantilla_div_delete" on public.gastos_fijos_plantilla_division for delete using (
	exists (
		select 1 from public.gastos_fijos_plantilla p
		where p.id = gastos_fijos_plantilla_division.plantilla_id
			and public.es_miembro(p.hogar_id)
	)
);

-- ============================================================
-- 3. INSTANCIA MENSUAL — un préstamo por mes, generada desde la plantilla.
-- ============================================================
create table if not exists public.gastos_fijos_mes (
	id uuid primary key default gen_random_uuid(),
	plantilla_id uuid not null references public.gastos_fijos_plantilla(id) on delete cascade,
	hogar_id uuid not null references public.hogares(id) on delete cascade,
	anio int not null check (anio >= 2024 and anio < 2100),
	mes int not null check (mes between 1 and 12),
	monto numeric(14, 2) not null check (monto > 0),
	estado text not null default 'abierto' check (estado in ('abierto', 'cerrado')),
	cerrado_at timestamptz,
	created_at timestamptz not null default now(),
	unique (plantilla_id, anio, mes)
);

create index if not exists gastos_fijos_mes_hogar_idx
	on public.gastos_fijos_mes (hogar_id, anio desc, mes desc);

alter table public.gastos_fijos_mes enable row level security;

drop policy if exists "fijos_mes_select" on public.gastos_fijos_mes;
create policy "fijos_mes_select" on public.gastos_fijos_mes for select using (
	public.es_miembro(hogar_id)
);

drop policy if exists "fijos_mes_insert" on public.gastos_fijos_mes;
create policy "fijos_mes_insert" on public.gastos_fijos_mes for insert with check (
	public.es_miembro(hogar_id)
);

drop policy if exists "fijos_mes_update" on public.gastos_fijos_mes;
create policy "fijos_mes_update" on public.gastos_fijos_mes for update using (
	public.es_miembro(hogar_id)
) with check (
	public.es_miembro(hogar_id)
);

drop policy if exists "fijos_mes_delete" on public.gastos_fijos_mes;
create policy "fijos_mes_delete" on public.gastos_fijos_mes for delete using (
	public.es_miembro(hogar_id)
);

-- ============================================================
-- 4. DIVISIÓN DEL MES — snapshot del reparto en el momento de generación.
-- ============================================================
create table if not exists public.gastos_fijos_mes_division (
	id uuid primary key default gen_random_uuid(),
	mes_id uuid not null references public.gastos_fijos_mes(id) on delete cascade,
	participante_id uuid not null references auth.users(id) on delete cascade,
	monto numeric(14, 2) not null check (monto >= 0),
	unique (mes_id, participante_id)
);

alter table public.gastos_fijos_mes_division enable row level security;

drop policy if exists "fijos_mes_div_select" on public.gastos_fijos_mes_division;
create policy "fijos_mes_div_select" on public.gastos_fijos_mes_division for select using (
	exists (
		select 1 from public.gastos_fijos_mes m
		where m.id = gastos_fijos_mes_division.mes_id
			and public.es_miembro(m.hogar_id)
	)
);

drop policy if exists "fijos_mes_div_insert" on public.gastos_fijos_mes_division;
create policy "fijos_mes_div_insert" on public.gastos_fijos_mes_division for insert with check (
	exists (
		select 1 from public.gastos_fijos_mes m
		where m.id = gastos_fijos_mes_division.mes_id
			and public.es_miembro(m.hogar_id)
	)
);

drop policy if exists "fijos_mes_div_delete" on public.gastos_fijos_mes_division;
create policy "fijos_mes_div_delete" on public.gastos_fijos_mes_division for delete using (
	exists (
		select 1 from public.gastos_fijos_mes m
		where m.id = gastos_fijos_mes_division.mes_id
			and public.es_miembro(m.hogar_id)
	)
);

-- ============================================================
-- 5. APORTES — quién pagó su parte del mes.
-- ============================================================
create table if not exists public.gastos_fijos_aportes (
	id uuid primary key default gen_random_uuid(),
	division_id uuid not null references public.gastos_fijos_mes_division(id) on delete cascade,
	monto numeric(14, 2) not null check (monto > 0),
	fecha date not null default current_date,
	nota text,
	registrado_por uuid not null references auth.users(id) on delete restrict,
	created_at timestamptz not null default now()
);

create index if not exists gastos_fijos_aportes_division_idx
	on public.gastos_fijos_aportes (division_id, created_at desc);

alter table public.gastos_fijos_aportes enable row level security;

drop policy if exists "fijos_aportes_select" on public.gastos_fijos_aportes;
create policy "fijos_aportes_select" on public.gastos_fijos_aportes for select using (
	exists (
		select 1 from public.gastos_fijos_mes_division d
		join public.gastos_fijos_mes m on m.id = d.mes_id
		where d.id = gastos_fijos_aportes.division_id
			and public.es_miembro(m.hogar_id)
	)
);

drop policy if exists "fijos_aportes_insert" on public.gastos_fijos_aportes;
create policy "fijos_aportes_insert" on public.gastos_fijos_aportes for insert with check (
	registrado_por = auth.uid()
	and exists (
		select 1 from public.gastos_fijos_mes_division d
		join public.gastos_fijos_mes m on m.id = d.mes_id
		where d.id = gastos_fijos_aportes.division_id
			and public.es_miembro(m.hogar_id)
			-- El aporte lo puede registrar el propio participante.
			and d.participante_id = auth.uid()
	)
);

drop policy if exists "fijos_aportes_delete" on public.gastos_fijos_aportes;
create policy "fijos_aportes_delete" on public.gastos_fijos_aportes for delete using (
	registrado_por = auth.uid()
);

-- ============================================================
-- 6. RPC: registrar_gasto_fijo — crear plantilla + reparto en una transacción.
-- ============================================================
create or replace function public.registrar_gasto_fijo(
	p_hogar uuid,
	p_nombre text,
	p_monto numeric,
	p_modo text,
	p_categoria uuid,
	p_dia_vencimiento int,
	p_notas text,
	p_divisiones jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
	v_plantilla_id uuid;
	v_div jsonb;
begin
	if not public.es_miembro(p_hogar) then
		raise exception 'No perteneces a este hogar' using errcode = '42501';
	end if;
	if p_monto is null or p_monto <= 0 then
		raise exception 'El monto debe ser mayor a 0' using errcode = '22023';
	end if;
	if p_modo not in ('iguales', 'porcentaje', 'exacto', 'partes') then
		raise exception 'Modo de reparto inválido' using errcode = '22023';
	end if;
	if p_divisiones is null or jsonb_array_length(p_divisiones) = 0 then
		raise exception 'Debe haber al menos un participante' using errcode = '22023';
	end if;

	insert into public.gastos_fijos_plantilla
		(hogar_id, nombre, monto, modo, categoria_id, dia_vencimiento, notas, registrado_por)
	values
		(p_hogar, trim(p_nombre), p_monto, p_modo, p_categoria,
		 coalesce(p_dia_vencimiento, 1), nullif(trim(p_notas), ''), auth.uid())
	returning id into v_plantilla_id;

	insert into public.gastos_fijos_plantilla_division (plantilla_id, participante_id, valor)
	select v_plantilla_id, (d->>'participante_id')::uuid, coalesce((d->>'valor')::numeric, 0)
	from jsonb_array_elements(p_divisiones) d;

	return v_plantilla_id;
end;
$$;

grant execute on function public.registrar_gasto_fijo(uuid, text, numeric, text, uuid, int, text, jsonb) to authenticated;

-- ============================================================
-- 7. RPC: generar_mes_gasto_fijo — crea el mes y sus divisiones si no existe.
-- Idempotente: si el mes ya existe, devuelve su id sin tocar nada.
-- Calcula la división por miembro según el modo y guarda el snapshot.
-- ============================================================
create or replace function public.generar_mes_gasto_fijo(
	p_plantilla uuid,
	p_anio int,
	p_mes int
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
	v_mes_id uuid;
	v_hogar uuid;
	v_monto numeric;
	v_modo text;
	v_activa boolean;
	v_total_partes numeric;
	v_resto_cents int;
	v_primero_id uuid;
begin
	-- Si ya existe, lo retornamos.
	select id into v_mes_id
	from public.gastos_fijos_mes
	where plantilla_id = p_plantilla and anio = p_anio and mes = p_mes;
	if found then
		return v_mes_id;
	end if;

	select hogar_id, monto, modo, activa into v_hogar, v_monto, v_modo, v_activa
	from public.gastos_fijos_plantilla
	where id = p_plantilla;
	if not found then
		raise exception 'Plantilla no encontrada' using errcode = '02000';
	end if;
	if not public.es_miembro(v_hogar) then
		raise exception 'No perteneces a este hogar' using errcode = '42501';
	end if;
	if not v_activa then
		raise exception 'La plantilla está inactiva' using errcode = '22023';
	end if;

	-- Insert del mes.
	insert into public.gastos_fijos_mes (plantilla_id, hogar_id, anio, mes, monto)
	values (p_plantilla, v_hogar, p_anio, p_mes, v_monto)
	returning id into v_mes_id;

	-- Calcular divisiones según el modo.
	if v_modo = 'iguales' then
		-- Reparto parejo entre todos los miembros del reparto.
		insert into public.gastos_fijos_mes_division (mes_id, participante_id, monto)
		select v_mes_id, d.participante_id,
			round(v_monto / (select count(*) from public.gastos_fijos_plantilla_division
			                  where plantilla_id = p_plantilla), 2)
		from public.gastos_fijos_plantilla_division d
		where d.plantilla_id = p_plantilla;
	elsif v_modo = 'porcentaje' then
		insert into public.gastos_fijos_mes_division (mes_id, participante_id, monto)
		select v_mes_id, d.participante_id, round((v_monto * d.valor) / 100, 2)
		from public.gastos_fijos_plantilla_division d
		where d.plantilla_id = p_plantilla;
	elsif v_modo = 'exacto' then
		insert into public.gastos_fijos_mes_division (mes_id, participante_id, monto)
		select v_mes_id, d.participante_id, d.valor
		from public.gastos_fijos_plantilla_division d
		where d.plantilla_id = p_plantilla;
	elsif v_modo = 'partes' then
		select sum(valor) into v_total_partes
		from public.gastos_fijos_plantilla_division
		where plantilla_id = p_plantilla;
		if v_total_partes is null or v_total_partes = 0 then v_total_partes := 1; end if;
		insert into public.gastos_fijos_mes_division (mes_id, participante_id, monto)
		select v_mes_id, d.participante_id, round((v_monto * d.valor) / v_total_partes, 2)
		from public.gastos_fijos_plantilla_division d
		where d.plantilla_id = p_plantilla;
	end if;

	-- Compensar el redondeo: si la suma de las cuotas no cuadra con el monto,
	-- ajustamos la primera para que cierre exacto.
	select id into v_primero_id from public.gastos_fijos_mes_division
	where mes_id = v_mes_id order by participante_id limit 1;
	if v_primero_id is not null then
		v_resto_cents := round(v_monto * 100)::int
			- (select coalesce(sum(round(monto * 100)::int), 0)
			   from public.gastos_fijos_mes_division where mes_id = v_mes_id);
		if v_resto_cents <> 0 then
			update public.gastos_fijos_mes_division
			set monto = monto + v_resto_cents::numeric / 100
			where id = v_primero_id;
		end if;
	end if;

	return v_mes_id;
end;
$$;

grant execute on function public.generar_mes_gasto_fijo(uuid, int, int) to authenticated;

-- ============================================================
-- 8. Realtime: para que aportes y cambios se vean al instante.
-- ============================================================
do $$
begin
	begin alter publication supabase_realtime add table public.gastos_fijos_plantilla; exception when duplicate_object then null; end;
	begin alter publication supabase_realtime add table public.gastos_fijos_mes; exception when duplicate_object then null; end;
	begin alter publication supabase_realtime add table public.gastos_fijos_mes_division; exception when duplicate_object then null; end;
	begin alter publication supabase_realtime add table public.gastos_fijos_aportes; exception when duplicate_object then null; end;
end $$;
