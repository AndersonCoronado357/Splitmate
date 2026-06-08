-- ============================================================
-- acmsy / 99_postamble.sql — Privilegios finales
-- En Supabase los roles anon/authenticated reciben privilegios por defecto.
-- En PostgreSQL normal hay que otorgarlos explícitamente. La seguridad real
-- la sigue dando RLS (la app corre como 'authenticated' con app.user_id).
-- ============================================================

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth, storage to authenticated, service_role;

grant all on all tables in schema public to authenticated, service_role;
grant all on all sequences in schema public to authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;
grant all on all tables in schema auth, storage to authenticated, service_role;

-- Por si se crean objetos nuevos más adelante.
alter default privileges in schema public grant all on tables to authenticated, service_role;
alter default privileges in schema public grant all on sequences to authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

-- ============================================================
-- Compatibilidad con el panel de acmsy (modulo Usuarios): el panel lee la
-- tabla estandar public.auth_users. Splitmate guarda sus usuarios en
-- auth.users (UUID, esquema auth) + public.profiles. Esta VISTA los expone con
-- la forma que el panel espera (no afecta a la app).
-- ============================================================
create or replace view public.auth_users as
select u.id, u.email, u.password_hash, u.google_id, u.email_verified,
       coalesce(p.display_name, u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'full_name') as name,
       u.created_at, u.last_login_at, u.last_seen_at, u.login_count
from auth.users u
left join public.profiles p on p.id = u.id;
