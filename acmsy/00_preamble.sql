-- ============================================================
-- acmsy / 00_preamble.sql — Capa de compatibilidad (reemplaza Supabase)
-- Permite correr las migraciones de Splitmate (pensadas para Supabase) en
-- un PostgreSQL normal de acmsy, conservando RLS y las funciones SECURITY
-- DEFINER que usan auth.uid().
--
-- Identidad del usuario: auth.uid() devuelve el UUID de la sesión actual,
-- que la app fija por petición con  SET LOCAL app.user_id = '<uuid>'.
-- ============================================================

create extension if not exists pgcrypto;

-- Roles que Supabase da por hecho (la app corre como 'authenticated' con RLS).
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;

-- Esquema auth + tabla mínima de usuarios. Es la ÚNICA fuente de identidad
-- (UUID), y guarda además los campos de login propios de acmsy (scrypt/Google).
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  -- login acmsy:
  password_hash text,
  google_id text,
  email_verified boolean not null default false,
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  last_seen_at timestamptz,
  login_count integer not null default 0
);

create table if not exists auth.tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,                -- 'reset' | 'confirm'
  token_hash text not null,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

-- auth.uid(): usuario de la sesión actual. La fija la app con SET app.user_id.
create or replace function auth.uid() returns uuid
  language sql stable as $$ select nullif(current_setting('app.user_id', true), '')::uuid $$;

create or replace function auth.role() returns text
  language sql stable as $$ select coalesce(nullif(current_setting('app.user_role', true), ''), 'authenticated') $$;

create or replace function auth.jwt() returns jsonb
  language sql stable as $$ select '{}'::jsonb $$;

-- Publicación de realtime (vacía). La app ya no usa el realtime de Supabase,
-- pero las migraciones la referencian (alter publication ... add table).
do $$ begin
  if not exists (select from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- Compat de Storage (stub). El avatar se migra a disco; estas tablas solo
-- existen para que la migración 002 (bucket + políticas) corra sin error.
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key, name text, public boolean default false
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text, name text, owner uuid, created_at timestamptz default now()
);
create or replace function storage.foldername(name text) returns text[]
  language sql immutable as $$ select string_to_array(name, '/') $$;
