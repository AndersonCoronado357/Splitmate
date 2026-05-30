-- ============================================================
-- 001_hogares.sql — Hogares, miembros, perfiles e invitaciones
-- Splitmate · Fase 3
--
-- Orden: 1) tablas  2) RLS on  3) funciones  4) trigger
--        5) políticas  6) RPCs  7) grants
-- (Las funciones se crean después de las tablas porque Postgres
--  valida su cuerpo al crearlas.)
-- ============================================================

-- ============================================================
-- 1) TABLAS
-- ============================================================

-- Perfil: un nombre visible por persona (global).
create table if not exists public.profiles (
	id uuid primary key references auth.users (id) on delete cascade,
	display_name text not null default '',
	created_at timestamptz not null default now()
);

-- Hogar: nombre + moneda + quién lo creó.
create table if not exists public.hogares (
	id uuid primary key default gen_random_uuid (),
	nombre text not null,
	moneda text not null default 'COP',
	creado_por uuid not null references auth.users (id),
	created_at timestamptz not null default now()
);

-- Membresía: quién pertenece a qué hogar y con qué rol.
create table if not exists public.miembros_hogar (
	hogar_id uuid not null references public.hogares (id) on delete cascade,
	user_id uuid not null references auth.users (id) on delete cascade,
	rol text not null default 'miembro' check (rol in ('admin', 'miembro')),
	created_at timestamptz not null default now(),
	primary key (hogar_id, user_id)
);

-- Invitación: link (token) + código corto, reutilizable y con expiración.
create table if not exists public.invitaciones (
	id uuid primary key default gen_random_uuid (),
	hogar_id uuid not null references public.hogares (id) on delete cascade,
	token uuid not null default gen_random_uuid (),
	codigo text not null unique default upper(substr(replace(gen_random_uuid ()::text, '-', ''), 1, 6)),
	created_by uuid not null references auth.users (id),
	expires_at timestamptz not null default (now() + interval '7 days'),
	created_at timestamptz not null default now()
);

-- ============================================================
-- 2) RLS ON
-- ============================================================
alter table public.profiles enable row level security;
alter table public.hogares enable row level security;
alter table public.miembros_hogar enable row level security;
alter table public.invitaciones enable row level security;

-- ============================================================
-- 3) FUNCIONES HELPER (SECURITY DEFINER → evitan recursión de RLS)
-- ============================================================
create or replace function public.es_miembro(_hogar uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
	select exists (
		select 1 from public.miembros_hogar
		where hogar_id = _hogar and user_id = auth.uid()
	);
$$;

create or replace function public.es_admin(_hogar uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
	select exists (
		select 1 from public.miembros_hogar
		where hogar_id = _hogar and user_id = auth.uid() and rol = 'admin'
	);
$$;

-- ¿Comparto algún hogar con _other? (para ver nombres de co-miembros)
create or replace function public.comparte_hogar(_other uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
	select exists (
		select 1
		from public.miembros_hogar m1
		join public.miembros_hogar m2 on m1.hogar_id = m2.hogar_id
		where m1.user_id = auth.uid()
		  and m2.user_id = _other
	);
$$;

-- ============================================================
-- 4) TRIGGER: crear perfil al registrarse, tomando el nombre del
--    login (Google: full_name/name; email: lo de antes del @).
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	insert into public.profiles (id, display_name)
	values (
		new.id,
		coalesce(
			nullif(new.raw_user_meta_data ->> 'full_name', ''),
			nullif(new.raw_user_meta_data ->> 'name', ''),
			split_part(new.email, '@', 1)
		)
	)
	on conflict (id) do nothing;
	return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
	after insert on auth.users
	for each row execute function public.handle_new_user();

-- ============================================================
-- 5) POLÍTICAS RLS
-- ============================================================

-- profiles: ver mi perfil o el de co-miembros; actualizar solo el mío.
create policy "profiles: ver propio o co-miembro"
	on public.profiles for select
	using (auth.uid() = id or public.comparte_hogar(id));

create policy "profiles: actualizar propio"
	on public.profiles for update
	using (auth.uid() = id);

-- hogares: ver los míos; solo el admin edita/borra.
create policy "hogares: ver los míos"
	on public.hogares for select
	using (public.es_miembro(id));

create policy "hogares: admin actualiza"
	on public.hogares for update
	using (public.es_admin(id));

create policy "hogares: admin borra"
	on public.hogares for delete
	using (public.es_admin(id));

-- miembros: ver los de mis hogares; salir = borrar mi propia fila.
-- (No hay INSERT directo: unirse va por RPC SECURITY DEFINER.)
create policy "miembros: ver los de mis hogares"
	on public.miembros_hogar for select
	using (public.es_miembro(hogar_id));

create policy "miembros: salir (borrar mi fila)"
	on public.miembros_hogar for delete
	using (user_id = auth.uid());

-- invitaciones: los miembros ven/crean/borran las de su hogar.
-- Quien se une NO lee esta tabla: usa la RPC unirse_a_hogar.
create policy "invitaciones: ver las de mis hogares"
	on public.invitaciones for select
	using (public.es_miembro(hogar_id));

create policy "invitaciones: admin crea"
	on public.invitaciones for insert
	with check (public.es_admin(hogar_id));

create policy "invitaciones: admin borra"
	on public.invitaciones for delete
	using (public.es_admin(hogar_id));

-- ============================================================
-- 6) RPCs (operaciones seguras)
-- ============================================================

-- Crear un hogar: inserta el hogar, te agrega como admin y genera la
-- invitación inicial. Devuelve el id del hogar.
create or replace function public.crear_hogar(p_nombre text, p_moneda text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
	v_id uuid;
begin
	if auth.uid() is null then
		raise exception 'No autenticado';
	end if;
	if coalesce(trim(p_nombre), '') = '' then
		raise exception 'El nombre del hogar es obligatorio';
	end if;

	insert into public.hogares (nombre, moneda, creado_por)
	values (trim(p_nombre), coalesce(nullif(trim(p_moneda), ''), 'COP'), auth.uid())
	returning id into v_id;

	insert into public.miembros_hogar (hogar_id, user_id, rol)
	values (v_id, auth.uid(), 'admin');

	insert into public.invitaciones (hogar_id, created_by)
	values (v_id, auth.uid());

	return v_id;
end;
$$;

-- Unirse con un código corto.
create or replace function public.unirse_a_hogar(p_codigo text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
	v_hogar uuid;
begin
	if auth.uid() is null then
		raise exception 'No autenticado';
	end if;

	select hogar_id into v_hogar
	from public.invitaciones
	where upper(codigo) = upper(trim(p_codigo)) and expires_at > now()
	limit 1;

	if v_hogar is null then
		raise exception 'Invitación inválida o expirada';
	end if;

	insert into public.miembros_hogar (hogar_id, user_id, rol)
	values (v_hogar, auth.uid(), 'miembro')
	on conflict (hogar_id, user_id) do nothing;

	return v_hogar;
end;
$$;

-- Unirse con el token del link (uuid).
create or replace function public.unirse_por_token(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
	v_hogar uuid;
begin
	if auth.uid() is null then
		raise exception 'No autenticado';
	end if;

	select hogar_id into v_hogar
	from public.invitaciones
	where token = p_token and expires_at > now()
	limit 1;

	if v_hogar is null then
		raise exception 'Invitación inválida o expirada';
	end if;

	insert into public.miembros_hogar (hogar_id, user_id, rol)
	values (v_hogar, auth.uid(), 'miembro')
	on conflict (hogar_id, user_id) do nothing;

	return v_hogar;
end;
$$;

-- Regenerar la invitación de un hogar (solo admin): borra las
-- anteriores y crea una nueva. Devuelve el id de la nueva.
create or replace function public.regenerar_invitacion(p_hogar uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
	v_id uuid;
begin
	if not public.es_admin(p_hogar) then
		raise exception 'Solo el administrador puede regenerar la invitación';
	end if;

	delete from public.invitaciones where hogar_id = p_hogar;

	insert into public.invitaciones (hogar_id, created_by)
	values (p_hogar, auth.uid())
	returning id into v_id;

	return v_id;
end;
$$;

-- ============================================================
-- 7) GRANTS de ejecución a usuarios autenticados
-- ============================================================
grant execute on function public.crear_hogar(text, text) to authenticated;
grant execute on function public.unirse_a_hogar(text) to authenticated;
grant execute on function public.unirse_por_token(uuid) to authenticated;
grant execute on function public.regenerar_invitacion(uuid) to authenticated;

-- ============================================================
-- 8) BACKFILL: perfiles para las cuentas que ya existían
--    (el trigger solo corre para cuentas nuevas).
-- ============================================================
insert into public.profiles (id, display_name)
select
	u.id,
	coalesce(
		nullif(u.raw_user_meta_data ->> 'full_name', ''),
		nullif(u.raw_user_meta_data ->> 'name', ''),
		split_part(u.email, '@', 1)
	)
from auth.users u
on conflict (id) do nothing;
