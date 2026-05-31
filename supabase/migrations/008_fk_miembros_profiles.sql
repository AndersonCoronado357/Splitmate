-- ============================================================
-- Migración 008 — FK adicional de miembros_hogar.user_id → profiles.id
--
-- Motivo: rendimiento. PostgREST (Supabase) sabe hacer embedding de tablas
-- relacionadas en UNA sola query si existe un FK directo entre ellas. Hoy
-- miembros_hogar.user_id referencia a auth.users (id), y profiles.id también
-- referencia a auth.users (id), pero PostgREST no detecta esa relación "a
-- través de" auth.users. Para que el cliente pueda hacer:
--
--     supabase.from('miembros_hogar').select('user_id, rol, profiles(...)')
--
-- en una sola vuelta de red en vez de dos (una a miembros, otra a profiles),
-- agregamos un FK redundante directo a profiles.id.
--
-- profiles.id == auth.users.id (FK también), así que los valores siempre
-- coinciden y este constraint extra no rompe nada existente.
-- ============================================================

alter table public.miembros_hogar
	add constraint miembros_hogar_user_id_profiles_fkey
	foreign key (user_id) references public.profiles (id) on delete cascade;
