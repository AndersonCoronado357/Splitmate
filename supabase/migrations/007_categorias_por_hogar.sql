-- ============================================================
-- 007_categorias_por_hogar.sql
-- Hace que cada hogar tenga SU PROPIA copia de las 7 categorías "predefinidas"
-- (Mercado, Domicilios, Salidas, Transporte, Hogar, Salud, Otros). Antes vivían
-- como filas con hogar_id NULL compartidas por todos: nadie podía renombrar ni
-- borrar las suyas. Ahora cada hogar las posee y puede editarlas libremente.
--
-- Pasos:
--   1) Copiar las 7 plantillas a cada hogar existente (idempotente).
--   2) Borrar las plantillas globales (hogar_id NULL). Los gastos que las usaban
--      pierden el FK (ON DELETE SET NULL → categoria_id queda NULL); igual antes
--      de la fase de gastos no había gastos creados, no hay riesgo de datos.
--   3) Reescribir crear_hogar para que al crear un hogar nuevo siembre sus 7
--      categorías propias.
-- ============================================================

-- 1) Sembrar copias por hogar (sin duplicar si ya existían).
insert into public.categorias (hogar_id, nombre, icono, orden)
select h.id, c.nombre, c.icono, c.orden
from public.hogares h
cross join public.categorias c
where c.hogar_id is null
	and not exists (
		select 1 from public.categorias c2
		where c2.hogar_id = h.id and c2.nombre = c.nombre
	);

-- 2) Borrar las plantillas globales.
delete from public.categorias where hogar_id is null;

-- 3) Crear hogar también siembra sus 7 categorías de arranque.
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

	-- Categorías de arranque (propias del nuevo hogar; editables por sus miembros).
	insert into public.categorias (hogar_id, nombre, icono, orden) values
		(v_id, 'Mercado',    'shopping-cart', 1),
		(v_id, 'Domicilios', 'bike',          2),
		(v_id, 'Salidas',    'utensils',      3),
		(v_id, 'Transporte', 'car',           4),
		(v_id, 'Hogar',      'house',         5),
		(v_id, 'Salud',      'heart-pulse',   6),
		(v_id, 'Otros',      'tag',           7);

	return v_id;
end;
$$;
