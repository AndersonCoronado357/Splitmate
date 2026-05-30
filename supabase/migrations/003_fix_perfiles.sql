-- ============================================================
-- 003_fix_perfiles.sql — Perfiles faltantes y upsert del propio perfil
--
-- Problema: había usuarios sin fila en public.profiles (el trigger no
-- corrió para cuentas viejas y el backfill no los alcanzó). Sin fila,
-- los UPDATE de nombre/foto no afectan ninguna fila → nunca se guardan.
-- ============================================================

-- 1) Permitir que cada quien cree su propia fila (para upsert desde la app).
drop policy if exists "profiles: crear propio" on public.profiles;
create policy "profiles: crear propio"
	on public.profiles for insert
	to authenticated
	with check (auth.uid() = id);

-- 2) Backfill: crear el perfil de cualquier usuario que no lo tenga,
--    tomando el nombre del login (full_name / name / prefijo del correo).
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
