-- ============================================================
-- 002_perfil_avatares.sql — Foto de perfil (avatar) por usuario
-- Splitmate · Fase 3.2
--
-- 1) Columna avatar_url en profiles
-- 2) Bucket público de Storage 'avatares'
-- 3) Políticas RLS en storage.objects: lectura pública, y cada quien
--    sube/actualiza/borra SOLO dentro de su carpeta (uid del usuario).
-- ============================================================

-- 1) URL de la foto (la subida por el usuario; si es null se usa la de Google)
alter table public.profiles
	add column if not exists avatar_url text;

-- 2) Bucket público para avatares
insert into storage.buckets (id, name, public)
values ('avatares', 'avatares', true)
on conflict (id) do nothing;

-- 3) Políticas sobre storage.objects (acotadas al bucket 'avatares')

-- Lectura pública (el bucket es público; permite servir las imágenes).
drop policy if exists "avatares: lectura publica" on storage.objects;
create policy "avatares: lectura publica"
	on storage.objects for select
	using (bucket_id = 'avatares');

-- Subir: solo dentro de la carpeta cuyo primer segmento es mi uid.
drop policy if exists "avatares: subir propio" on storage.objects;
create policy "avatares: subir propio"
	on storage.objects for insert
	to authenticated
	with check (
		bucket_id = 'avatares'
		and (storage.foldername(name))[1] = auth.uid()::text
	);

-- Actualizar (upsert) mi propia foto.
drop policy if exists "avatares: actualizar propio" on storage.objects;
create policy "avatares: actualizar propio"
	on storage.objects for update
	to authenticated
	using (
		bucket_id = 'avatares'
		and (storage.foldername(name))[1] = auth.uid()::text
	);

-- Borrar mi propia foto.
drop policy if exists "avatares: borrar propio" on storage.objects;
create policy "avatares: borrar propio"
	on storage.objects for delete
	to authenticated
	using (
		bucket_id = 'avatares'
		and (storage.foldername(name))[1] = auth.uid()::text
	);
