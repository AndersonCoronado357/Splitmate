-- ============================================================
-- 030 — Gastos fijos: repartir en enteros (sin centavos).
--
-- Bug que arregla: cuando el monto no se divide exacto entre N personas
-- (p. ej. 11.111 / 3 = 3703.67), el RPC guardaba 3703.67 en cada división.
-- El cliente, que trabaja en enteros (no usamos centavos en COP), permitía
-- aportar máximo 3703 y dejaba pendiente 0.67 → mostrado como "$ 1". El
-- usuario nunca podía cerrar el mes.
--
-- Fix: redondeamos cada cuota a entero (0 decimales), y compensamos el
-- redondeo dándole el resto a la primera persona del orden. Suma queda
-- exacta y todas las cuotas son enteras, así el MoneyInput puede llegar
-- al tope sin problema.
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
	v_resto numeric;
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

	-- Calcular divisiones según el modo. Redondeamos a entero (0 decimales)
	-- para evitar centavos colgando que el cliente no puede pagar.
	if v_modo = 'iguales' then
		insert into public.gastos_fijos_mes_division (mes_id, participante_id, monto)
		select v_mes_id, d.participante_id,
			round(v_monto / (select count(*) from public.gastos_fijos_plantilla_division
			                  where plantilla_id = p_plantilla))
		from public.gastos_fijos_plantilla_division d
		where d.plantilla_id = p_plantilla;
	elsif v_modo = 'porcentaje' then
		insert into public.gastos_fijos_mes_division (mes_id, participante_id, monto)
		select v_mes_id, d.participante_id, round((v_monto * d.valor) / 100)
		from public.gastos_fijos_plantilla_division d
		where d.plantilla_id = p_plantilla;
	elsif v_modo = 'exacto' then
		-- En 'exacto' el usuario ya ingresó enteros vía MoneyInput. No tocamos.
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
		select v_mes_id, d.participante_id, round((v_monto * d.valor) / v_total_partes)
		from public.gastos_fijos_plantilla_division d
		where d.plantilla_id = p_plantilla;
	end if;

	-- Compensar el redondeo entero: la suma puede diferir del monto base por
	-- algunos pesos. Se lo damos (o se lo quitamos) a la primera división.
	select id into v_primero_id from public.gastos_fijos_mes_division
	where mes_id = v_mes_id order by participante_id limit 1;
	if v_primero_id is not null then
		v_resto := round(v_monto)
			- (select coalesce(sum(monto), 0)
			   from public.gastos_fijos_mes_division where mes_id = v_mes_id);
		if v_resto <> 0 then
			update public.gastos_fijos_mes_division
			set monto = monto + v_resto
			where id = v_primero_id;
		end if;
	end if;

	return v_mes_id;
end;
$$;

-- ============================================================
-- Fix de datos existentes — gastos fijos.
-- Redondea las divisiones a entero y rebalancea el resto en la primera.
-- ============================================================
do $$
declare
	m record;
	v_resto numeric;
	v_primera uuid;
begin
	update public.gastos_fijos_mes_division
	set monto = round(monto)
	where monto <> round(monto);

	for m in select id, monto from public.gastos_fijos_mes loop
		v_resto := round(m.monto) - (
			select coalesce(sum(monto), 0)
			from public.gastos_fijos_mes_division
			where mes_id = m.id
		);
		if v_resto <> 0 then
			select id into v_primera from public.gastos_fijos_mes_division
			where mes_id = m.id order by participante_id limit 1;
			if v_primera is not null then
				update public.gastos_fijos_mes_division
				set monto = monto + v_resto
				where id = v_primera;
			end if;
		end if;
	end loop;

	-- Aportes a gastos fijos: redondea por consistencia. MoneyInput ya
	-- entrega enteros, esto solo limpia residuos históricos.
	update public.gastos_fijos_aportes
	set monto = round(monto)
	where monto <> round(monto);
end $$;

-- ============================================================
-- Fix de datos existentes — gastos compartidos.
-- Mismo problema: el cliente repartía con centavos y dejaba pendientes
-- < $1 imposibles de pagar con el MoneyInput (que es entero).
-- ============================================================
do $$
declare
	g record;
	v_resto numeric;
	v_primera uuid;
begin
	update public.gasto_divisiones
	set monto = round(monto)
	where monto <> round(monto);

	for g in select id, monto from public.gastos_compartidos loop
		v_resto := round(g.monto) - (
			select coalesce(sum(monto), 0)
			from public.gasto_divisiones
			where gasto_id = g.id
		);
		if v_resto <> 0 then
			select id into v_primera from public.gasto_divisiones
			where gasto_id = g.id order by participante_id limit 1;
			if v_primera is not null then
				update public.gasto_divisiones
				set monto = monto + v_resto
				where id = v_primera;
			end if;
		end if;
	end loop;

	-- Aportes a gastos compartidos.
	update public.aportes
	set monto = round(monto)
	where monto <> round(monto);
end $$;

-- ============================================================
-- Fix de datos existentes — préstamos (cuotas).
-- ============================================================
do $$
declare
	p record;
	v_resto numeric;
	v_primera uuid;
begin
	-- Existencia condicionada: la tabla `prestamo_cuotas` viene en la 026.
	if to_regclass('public.prestamo_cuotas') is not null then
		update public.prestamo_cuotas
		set monto = round(monto)
		where monto <> round(monto);

		for p in select id, monto from public.prestamos loop
			v_resto := round(p.monto) - (
				select coalesce(sum(monto), 0)
				from public.prestamo_cuotas
				where prestamo_id = p.id
			);
			-- Solo si hay cuotas asociadas — si no, no tocamos nada.
			if v_resto <> 0 and exists (
				select 1 from public.prestamo_cuotas where prestamo_id = p.id
			) then
				select id into v_primera from public.prestamo_cuotas
				where prestamo_id = p.id order by numero limit 1;
				if v_primera is not null then
					update public.prestamo_cuotas
					set monto = monto + v_resto
					where id = v_primera;
				end if;
			end if;
		end loop;
	end if;
end $$;
