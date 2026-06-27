-- ============================================================
-- Realtime (NOTIFY/LISTEN) + suscripciones de Web Push.
-- Ejecutar DESPUÉS de las migraciones de la app (necesita sus tablas).
--
-- Cómo funciona el realtime: un disparador en cada tabla del hogar hace
-- pg_notify('evento', {hogar_id, tabla, op}) en cada cambio. El servidor
-- (src/lib/server/eventos.ts) escucha con LISTEN y reparte el evento por SSE
-- (GET /api/eventos) a las pestañas de ese hogar, que refrescan al instante.
-- El PUSH lo envían las acciones de la app (no este disparador).
-- ============================================================

-- Suscripciones de Web Push por usuario.
create table if not exists push_subscriptions (
	user_id uuid not null,
	endpoint text primary key,
	sub jsonb not null,
	created_at timestamptz not null default now()
);
create index if not exists idx_push_sub_user on push_subscriptions(user_id);

-- Aviso de cambio. SECURITY DEFINER para que el lookup del hogar no lo filtre RLS.
create or replace function notify_evento() returns trigger
language plpgsql security definer as $fn$
declare
	j jsonb := to_jsonb(case when TG_OP = 'DELETE' then OLD else NEW end);
	v_hogar uuid;
begin
	if j ? 'hogar_id' then
		v_hogar := (j->>'hogar_id')::uuid;
	elsif j ? 'gasto_id' then
		select hogar_id into v_hogar from gastos_compartidos where id = (j->>'gasto_id')::uuid;
	elsif j ? 'division_id' then
		select gc.hogar_id into v_hogar
			from gasto_divisiones gd join gastos_compartidos gc on gc.id = gd.gasto_id
			where gd.id = (j->>'division_id')::uuid;
		if v_hogar is null then
			select gfm.hogar_id into v_hogar
				from gastos_fijos_mes_division d join gastos_fijos_mes gfm on gfm.id = d.mes_id
				where d.id = (j->>'division_id')::uuid;
		end if;
	elsif j ? 'mes_id' then
		select hogar_id into v_hogar from gastos_fijos_mes where id = (j->>'mes_id')::uuid;
	elsif j ? 'plantilla_id' then
		select hogar_id into v_hogar from gastos_fijos_plantilla where id = (j->>'plantilla_id')::uuid;
	elsif j ? 'prestamo_id' then
		select hogar_id into v_hogar from prestamos where id = (j->>'prestamo_id')::uuid;
	end if;

	if v_hogar is not null then
		perform pg_notify('evento', json_build_object(
			'hogar_id', v_hogar, 'tabla', TG_TABLE_NAME, 'op', TG_OP
		)::text);
	end if;
	return null;
end;
$fn$;

-- Disparadores en todas las tablas de datos del hogar.
do $do$
declare
	t text;
	tablas text[] := array[
		'categorias','gastos_compartidos','gasto_divisiones','aportes',
		'gastos_fijos_mes','gastos_fijos_mes_division','gastos_fijos_plantilla',
		'gastos_fijos_plantilla_division','gastos_fijos_aportes','invitaciones',
		'miembros_hogar','pagos','prestamos','prestamo_cuotas'
	];
begin
	foreach t in array tablas loop
		execute format('drop trigger if exists trg_evento on %I', t);
		execute format('create trigger trg_evento after insert or update or delete on %I for each row execute function notify_evento()', t);
	end loop;
end;
$do$;
