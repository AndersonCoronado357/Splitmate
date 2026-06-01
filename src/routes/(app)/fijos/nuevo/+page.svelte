<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import Select from '$lib/components/Select.svelte';
	import MoneyInput from '$lib/components/MoneyInput.svelte';
	import { iconoCategoria } from '$lib/iconosCategoria';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Repeat from '@lucide/svelte/icons/repeat';
	import Tag from '@lucide/svelte/icons/tag';
	import Users from '@lucide/svelte/icons/users';
	import Divide from '@lucide/svelte/icons/divide';
	import Calendar from '@lucide/svelte/icons/calendar';
	import Pencil from '@lucide/svelte/icons/pencil';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	type Miembro = {
		userId: string;
		rol: string;
		nombre: string;
		avatar: string | null;
		soyYo: boolean;
	};
	const miembros = $derived((page.data.miembros ?? []) as Miembro[]);

	const monedaActiva = $derived(
		(page.data.hogarActivo as { moneda?: string } | undefined)?.moneda || 'COP'
	);
	const fmt = $derived(
		(n: number) =>
			new Intl.NumberFormat('es-CO', {
				style: 'currency',
				currency: monedaActiva,
				maximumFractionDigits: 0
			}).format(n)
	);

	let nombre = $state('');
	let monto = $state<number | null>(null);
	const montoNum = $derived(monto ?? 0);
	let categoriaId = $state<string>('');
	let modo = $state<'iguales' | 'porcentaje' | 'exacto' | 'partes'>('iguales');
	let diaVencimiento = $state<number>(1);
	let notas = $state('');
	let cargando = $state(false);

	// Estado por miembro (mismo patrón que /gastos/nuevo). `valor` significa
	// distinto según el modo:
	//   * iguales   → ignorado
	//   * porcentaje→ % del total
	//   * exacto    → monto absoluto
	//   * partes    → peso (1, 2, 3…)
	let estado = $state<Record<string, { activo: boolean; valor: string }>>({});
	let inicializado = $state(false);
	$effect(() => {
		if (!inicializado && miembros.length > 0) {
			const init: Record<string, { activo: boolean; valor: string }> = {};
			for (const m of miembros) init[m.userId] = { activo: true, valor: '' };
			estado = init;
			inicializado = true;
		}
	});

	function cambiarModo(m: typeof modo) {
		modo = m;
		for (const id of Object.keys(estado)) estado[id].valor = '';
		estado = { ...estado };
	}
	function toggleParticipante(id: string) {
		if (!estado[id]) return;
		estado[id].activo = !estado[id].activo;
		if (!estado[id].activo) estado[id].valor = '';
		estado = { ...estado };
	}

	const activos = $derived(
		Object.entries(estado)
			.filter(([, v]) => v.activo)
			.map(([id]) => id)
	);

	// Clamping en vivo: si el usuario escribe más del límite, lo recortamos al
	// máximo disponible. En 'porcentaje' la suma no puede pasar de 100; en
	// 'exacto' la suma no puede pasar del monto total.
	$effect(() => {
		if (modo === 'porcentaje') {
			let usado = 0;
			for (const id of activos) {
				const v = Number(estado[id]?.valor || '0');
				const safe = Number.isFinite(v) && v >= 0 ? v : 0;
				const disponible = Math.max(0, 100 - usado);
				const clamp = Math.min(safe, disponible);
				if (clamp !== safe) {
					estado[id].valor = String(clamp);
				}
				usado += clamp;
			}
		}
		if (modo === 'exacto' && monto !== null && monto > 0) {
			let usado = 0;
			for (const id of activos) {
				const v = Number(estado[id]?.valor || '0');
				const safe = Number.isFinite(v) && v >= 0 ? v : 0;
				const disponible = Math.max(0, monto - usado);
				const clamp = Math.min(safe, disponible);
				if (clamp !== safe) {
					estado[id].valor = String(clamp);
				}
				usado += clamp;
			}
		}
	});

	// Para enviar al server: `valor` por miembro según el modo.
	// Para 'iguales' mandamos 0 (el server lo ignora).
	const divisiones = $derived(
		activos.map((id) => ({
			participante_id: id,
			valor: modo === 'iguales' ? 0 : Number(estado[id]?.valor || '0') || 0
		}))
	);

	// Vista previa del reparto (solo informativa, mismo cálculo que el server).
	// Trabajamos en ENTEROS — no usamos centavos en COP — y el resto del
	// redondeo se le da a la primera persona para que la suma cierre exacta
	// (mismo criterio que el RPC `generar_mes_gasto_fijo`).
	const previewMontos = $derived.by(() => {
		if (activos.length === 0 || montoNum <= 0) return new Map<string, number>();
		const out = new Map<string, number>();
		if (modo === 'iguales') {
			const n = activos.length;
			const base = Math.floor(montoNum / n);
			const sobra = montoNum - base * n; // 0..n-1
			// Distribuimos el sobrante: las primeras `sobra` personas pagan un peso más.
			activos.forEach((id, i) => {
				out.set(id, base + (i < sobra ? 1 : 0));
			});
		} else if (modo === 'porcentaje') {
			let suma = 0;
			activos.forEach((id) => {
				const v = Number(estado[id]?.valor || '0') || 0;
				const m = Math.round((montoNum * v) / 100);
				out.set(id, m);
				suma += m;
			});
			const resto = montoNum - suma;
			if (resto !== 0 && activos.length > 0) {
				const first = activos[0];
				out.set(first, (out.get(first) ?? 0) + resto);
			}
		} else if (modo === 'exacto') {
			activos.forEach((id) => {
				out.set(id, Number(estado[id]?.valor || '0') || 0);
			});
		} else if (modo === 'partes') {
			const total = activos.reduce(
				(a, id) => a + (Number(estado[id]?.valor || '1') || 0),
				0
			);
			if (total > 0) {
				let suma = 0;
				activos.forEach((id) => {
					const v = Number(estado[id]?.valor || '1') || 0;
					const m = Math.round((montoNum * v) / total);
					out.set(id, m);
					suma += m;
				});
				const resto = montoNum - suma;
				if (resto !== 0 && activos.length > 0) {
					const first = activos[0];
					out.set(first, (out.get(first) ?? 0) + resto);
				}
			}
		}
		return out;
	});

	const sumaDivisiones = $derived(
		Array.from(previewMontos.values()).reduce((a, b) => a + b, 0)
	);
	const diferencia = $derived(
		Math.abs(sumaDivisiones - montoNum) <= 0.01 ? 0 : montoNum - sumaDivisiones
	);
	// Para 'iguales' / 'partes' el server siempre cuadra el reparto, así que no
	// bloqueamos por "diferencia"; para 'porcentaje' / 'exacto' sí, porque
	// puede no llegar a 100 % o al total.
	const valido = $derived(
		nombre.trim().length > 0 &&
			monto !== null &&
			Number.isFinite(monto) &&
			monto > 0 &&
			activos.length > 0 &&
			(modo === 'iguales' || modo === 'partes' ? true : diferencia === 0)
	);

	const categoriaOpciones = $derived([
		{ value: '', label: 'Sin categoría' },
		...data.categorias.map((c) => ({ value: c.id, label: c.nombre }))
	]);

	const categoriaActual = $derived(data.categorias.find((c) => c.id === categoriaId));
	const IconoCat = $derived(iconoCategoria(categoriaActual?.icono));

	const MODOS = [
		{ id: 'iguales', label: 'Iguales', desc: 'Todos pagan lo mismo, automático.' },
		{ id: 'porcentaje', label: 'Porcentaje', desc: 'Cada uno paga un % del total.' },
		{ id: 'exacto', label: 'Exacto', desc: 'Escribes el monto exacto por persona.' },
		{ id: 'partes', label: 'Partes', desc: 'Reparto en partes proporcionales.' }
	] as const;

	const MODO_LABEL: Record<string, string> = {
		iguales: 'Partes iguales',
		porcentaje: 'Por porcentaje',
		exacto: 'Monto exacto',
		partes: 'Por partes'
	};

	function onEnhance() {
		cargando = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			cargando = false;
		};
	}

	function iniciales(nombreM: string) {
		return (
			nombreM
				.trim()
				.split(/\s+/)
				.map((w) => w[0])
				.slice(0, 2)
				.join('') || '?'
		).toUpperCase();
	}

	const inputClass =
		'w-full rounded-input border border-transparent bg-brand-50 px-3 py-2.5 text-text outline-none placeholder:text-muted/70';
	const labelClass =
		'flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted uppercase';
</script>

<div class="flex flex-col px-5 py-6 md:px-8 lg:h-full lg:w-full lg:flex-1 lg:min-h-0">
	<a
		href="/fijos"
		class="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-text"
	>
		<ArrowLeft size={16} />
		Volver
	</a>

	<div class="mt-4 flex items-start justify-between gap-3">
		<div>
			<h1 class="text-2xl font-bold tracking-tight text-text">Nuevo gasto fijo</h1>
			<p class="mt-1 text-sm text-muted">
				Algo que se paga mes a mes (arriendo, servicios, etc).
			</p>
		</div>
		<div class="flex shrink-0 items-center gap-2">
			<a
				href="/fijos"
				class="hidden h-10 items-center justify-center rounded-input border border-border bg-surface px-4 text-sm font-semibold text-text transition-colors hover:bg-bg sm:inline-flex"
			>
				Cancelar
			</a>
			<button
				type="submit"
				form="form-nuevo-fijo"
				disabled={cargando || !valido}
				class="inline-flex h-10 items-center justify-center rounded-input bg-brand-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
			>
				{cargando ? 'Guardando…' : 'Guardar'}
			</button>
		</div>
	</div>

	<!-- Vista previa LIVE -->
	<section class="mt-5 rounded-card border border-border bg-surface p-4 shadow-card">
		<p class="text-xs font-semibold tracking-wide text-muted uppercase">Vista previa</p>
		<div class="mt-3 flex items-center gap-3">
			<span class="grid size-14 shrink-0 place-items-center rounded-card bg-brand-50 text-brand-700">
				<IconoCat size={26} />
			</span>
			<div class="min-w-0 flex-1">
				<p class="truncate text-base font-semibold text-text">
					{nombre.trim() || 'Sin nombre todavía'}
				</p>
				<p class="mt-0.5 text-xs text-muted">
					{categoriaActual?.nombre ?? 'Sin categoría'} · {MODO_LABEL[modo]} ·
					{activos.length}
					{activos.length === 1 ? 'persona' : 'personas'}
				</p>
			</div>
			<p class="tabular shrink-0 text-2xl font-bold text-text">{fmt(monto || 0)}</p>
		</div>
	</section>

	<form
		id="form-nuevo-fijo"
		method="POST"
		use:enhance={onEnhance}
		class="mt-5 flex flex-1 flex-col gap-5"
	>
		<input type="hidden" name="divisiones" value={JSON.stringify(divisiones)} />
		<input type="hidden" name="modo" value={modo} />
		<input type="hidden" name="categoria" value={categoriaId} />
		<input type="hidden" name="dia_vencimiento" value={diaVencimiento} />

		<div class="grid gap-5 lg:grid-cols-5 lg:flex-1 lg:min-h-0">
			<!-- Izquierda (3): datos + categoría + notas -->
			<div class="flex flex-col gap-5 lg:col-span-3 lg:min-h-0">
				<section>
					<p class={labelClass}>
						<Repeat size={13} class="text-brand-500" />
						Datos del gasto fijo
					</p>
					<div class="mt-2 space-y-4 rounded-card border border-border bg-surface p-5 shadow-card">
						<div class="space-y-1.5">
							<label for="nombre" class="block text-sm font-medium text-text">Nombre</label>
							<input
								id="nombre"
								name="nombre"
								type="text"
								required
								autocomplete="off"
								bind:value={nombre}
								placeholder="Ej. Arriendo, Luz, Internet"
								class={inputClass}
							/>
						</div>
						<div class="grid gap-4 sm:grid-cols-2">
							<div class="space-y-1.5">
								<label for="monto" class="block text-sm font-medium text-text">
									Monto mensual
								</label>
								<MoneyInput
									id="monto"
									name="monto"
									required
									min={1}
									bind:value={monto}
									class={inputClass}
								/>
							</div>
							<div class="space-y-1.5">
								<label for="dia" class="block text-sm font-medium text-text">
									Día de vencimiento
								</label>
								<input
									id="dia"
									type="number"
									min="1"
									max="28"
									step="1"
									bind:value={diaVencimiento}
									class={inputClass + ' tabular'}
								/>
								<p class="text-xs text-muted">
									El día del mes en que suele pagarse (1 al 28).
								</p>
							</div>
						</div>
					</div>
				</section>

				<section>
					<p class={labelClass}>
						<Tag size={13} class="text-brand-500" />
						Categoría
					</p>
					<div class="mt-2 rounded-card border border-border bg-surface p-5 shadow-card">
						<Select
							id="categoria-select"
							bind:value={categoriaId}
							options={categoriaOpciones}
							placeholder="Sin categoría"
						/>
					</div>
				</section>

				<section class="flex flex-col lg:min-h-0 lg:flex-1">
					<p class={labelClass}>
						<Pencil size={13} class="text-brand-500" />
						Notas (opcional)
					</p>
					<div
						class="mt-2 flex flex-col rounded-card border border-border bg-surface p-5 shadow-card lg:min-h-0 lg:flex-1"
					>
						<textarea
							id="notas"
							name="notas"
							bind:value={notas}
							rows="3"
							autocomplete="off"
							spellcheck="false"
							placeholder="Detalles del gasto fijo…"
							class={inputClass + ' resize-none lg:min-h-0 lg:flex-1'}
						></textarea>
					</div>
				</section>
			</div>

			<!-- Derecha (2): modo + participantes -->
			<div class="flex flex-col gap-5 lg:col-span-2 lg:min-h-0">
				<section>
					<p class={labelClass}>
						<Divide size={13} class="text-brand-500" />
						Cómo se reparte
					</p>
					<div class="mt-2 flex flex-col overflow-hidden rounded-card bg-surface shadow-card">
						{#each MODOS as m, i (m.id)}
							{@const sel = modo === m.id}
							<button
								type="button"
								onclick={() => cambiarModo(m.id)}
								aria-pressed={sel}
								class={'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ' +
									(i > 0 ? 'border-t border-border ' : '') +
									(sel ? 'bg-brand-50' : 'hover:bg-bg')}
							>
								<span
									class={'flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ' +
										(sel ? 'border-brand-500' : 'border-muted/40')}
								>
									<span
										class={'size-2.5 rounded-full bg-brand-500 transition-transform ' +
											(sel ? 'scale-100' : 'scale-0')}
									></span>
								</span>
								<div class="min-w-0 flex-1">
									<p class={'text-sm font-semibold ' + (sel ? 'text-brand-700' : 'text-text')}>
										{m.label}
									</p>
									<p class="mt-0.5 text-xs text-muted">{m.desc}</p>
								</div>
							</button>
						{/each}
					</div>
				</section>

				<section class="flex flex-col lg:min-h-0 lg:flex-1">
					<div class="flex items-end justify-between">
						<p class={labelClass}>
							<Users size={13} class="text-brand-500" />
							Participantes
						</p>
						<p class="tabular text-xs text-muted">
							{#if modo === 'iguales'}
								{activos.length} {activos.length === 1 ? 'persona' : 'personas'}
							{:else if montoNum > 0}
								{fmt(sumaDivisiones)} / {fmt(montoNum)}
							{/if}
						</p>
					</div>
					<ul
						class="mt-2 overflow-hidden rounded-card bg-surface shadow-card lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
					>
						{#each miembros as m, i (m.userId)}
							{@const e = estado[m.userId] ?? { activo: true, valor: '' }}
							{@const previewM = previewMontos.get(m.userId) ?? 0}
							<li
								class={'flex items-center gap-3 px-4 py-3 ' +
									(i > 0 ? 'border-t border-border ' : '') +
									(e.activo ? '' : 'opacity-50')}
							>
								<button
									type="button"
									onclick={() => toggleParticipante(m.userId)}
									aria-pressed={e.activo}
									class="-mx-1 flex min-w-0 flex-1 items-center gap-3 rounded-input px-1 py-1 text-left transition-colors hover:bg-bg"
								>
									{#if m.avatar}
										<img
											src={m.avatar}
											alt=""
											referrerpolicy="no-referrer"
											class="size-9 shrink-0 rounded-full object-cover"
										/>
									{:else}
										<span
											class="grid size-9 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-700"
										>
											{iniciales(m.nombre)}
										</span>
									{/if}
									<div class="min-w-0 flex-1">
										<p class="truncate text-sm font-medium text-text">
											{m.nombre}{#if m.soyYo}<span class="text-muted"> · Tú</span>{/if}
										</p>
										{#if !e.activo}
											<p class="mt-0.5 text-xs text-muted">No incluido</p>
										{:else if modo !== 'iguales' && montoNum > 0}
											<p class="tabular mt-0.5 text-xs text-muted">
												Parte: {fmt(previewM)}
											</p>
										{/if}
									</div>
								</button>

								{#if e.activo}
									{#if modo === 'iguales'}
										<span class="tabular shrink-0 text-sm font-semibold text-text">
											{fmt(previewM)}
										</span>
									{:else if modo === 'porcentaje'}
										<div class="flex shrink-0 items-center gap-1">
											<input
												type="number"
												min="0"
												max="100"
												step="any"
												inputmode="decimal"
												bind:value={estado[m.userId].valor}
												placeholder="0"
												class="tabular w-16 rounded-input bg-brand-50 px-2 py-1.5 text-center text-sm text-text outline-none"
											/>
											<span class="text-sm text-muted">%</span>
										</div>
									{:else if modo === 'exacto'}
										<input
											type="number"
											min="0"
											step="any"
											inputmode="decimal"
											bind:value={estado[m.userId].valor}
											placeholder="0"
											class="tabular w-24 shrink-0 rounded-input bg-brand-50 px-2 py-1.5 text-center text-sm text-text outline-none"
										/>
									{:else if modo === 'partes'}
										<div class="flex shrink-0 items-center gap-1">
											<input
												type="number"
												min="0"
												step="1"
												inputmode="numeric"
												bind:value={estado[m.userId].valor}
												placeholder="1"
												class="tabular w-14 rounded-input bg-brand-50 px-2 py-1.5 text-center text-sm text-text outline-none"
											/>
											<span class="text-sm text-muted">partes</span>
										</div>
									{/if}
								{/if}
							</li>
						{/each}
					</ul>
					{#if diferencia !== 0 && activos.length > 0 && montoNum > 0 && (modo === 'porcentaje' || modo === 'exacto')}
						<p class="mt-2 text-xs text-money-contra">
							{#if diferencia > 0}Falta {fmt(diferencia)} para llegar al total.
							{:else}Te excediste {fmt(-diferencia)} sobre el total.{/if}
						</p>
					{/if}
				</section>
			</div>
		</div>

		{#if form?.error}
			<p class="rounded-input bg-money-contra-bg px-3 py-2.5 text-sm text-money-contra">
				{form.error}
			</p>
		{/if}
	</form>
</div>
