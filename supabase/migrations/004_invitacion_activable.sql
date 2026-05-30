-- ============================================================
-- 004_invitacion_activable.sql
-- - La invitación se puede DESACTIVAR (dejar de aceptar miembros).
-- - Solo el ADMIN ve/gestiona la invitación (antes la veía cualquier miembro).
-- ============================================================

-- 1) Estado activable de la invitación.
alter table public.invitaciones
	add column if not exists activa boolean not null default true;

-- 2) Solo el admin puede VER la invitación.
drop policy if exists "invitaciones: ver las de mis hogares" on public.invitaciones;
drop policy if exists "invitaciones: admin ve" on public.invitaciones;
create policy "invitaciones: admin ve"
	on public.invitaciones for select
	using (public.es_admin(hogar_id));

-- 3) Unirse requiere invitación ACTIVA (y vigente).
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
	where upper(codigo) = upper(trim(p_codigo)) and activa = true and expires_at > now()
	limit 1;

	if v_hogar is null then
		raise exception 'Invitación inválida, desactivada o expirada';
	end if;

	insert into public.miembros_hogar (hogar_id, user_id, rol)
	values (v_hogar, auth.uid(), 'miembro')
	on conflict (hogar_id, user_id) do nothing;

	return v_hogar;
end;
$$;

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
	where token = p_token and activa = true and expires_at > now()
	limit 1;

	if v_hogar is null then
		raise exception 'Invitación inválida, desactivada o expirada';
	end if;

	insert into public.miembros_hogar (hogar_id, user_id, rol)
	values (v_hogar, auth.uid(), 'miembro')
	on conflict (hogar_id, user_id) do nothing;

	return v_hogar;
end;
$$;

-- 4) Activar/desactivar la invitación (solo admin).
create or replace function public.set_invitacion_activa(p_hogar uuid, p_activa boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
	if not public.es_admin(p_hogar) then
		raise exception 'Solo el administrador puede cambiar la invitación';
	end if;
	update public.invitaciones set activa = p_activa where hogar_id = p_hogar;
end;
$$;

grant execute on function public.set_invitacion_activa(uuid, boolean) to authenticated;
