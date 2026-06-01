<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import HandCoins from '@lucide/svelte/icons/hand-coins';
	import User from '@lucide/svelte/icons/user';
	import Calendar from '@lucide/svelte/icons/calendar';
	import StickyNote from '@lucide/svelte/icons/sticky-note';
	import Coins from '@lucide/svelte/icons/coins';
	import DatePicker from '$lib/components/DatePicker.svelte';
	import Select from '$lib/components/Select.svelte';
	import MoneyInput from '$lib/components/MoneyInput.svelte';
	import { TIPO_PAGO_LABEL, TIPO_PAGO_DESC, type TipoPagoPrestamo } from '$lib/prestamos-tipos';

	// Usamos la fecha LOCAL, no la UTC. `toISOString()` te puede dar el día
	// de mañana si son más de las 7pm en Colombia (UTC-5) porque convierte a
	// UTC primero.
	const hoyD = new Date();
	const hoyIso = `${hoyD.getFullYear()}-${String(hoyD.getMonth() + 1).padStart(2, '0')}-${String(hoyD.getDate()).padStart(2, '0')}`;
	let errorRegistro = $state<string | null>(null);

	type Miembro = { userId: string; nombre: string; avatar: string | null; soyYo?: boolean };
	const miembros = $derived(((page.data.miembros as Miembro[]) ?? []).filter((m) => !m.soyYo));

	let receptorId = $state<string>('');
	let monto = $state<number | null>(null);
	let fecha = $state(hoyIso);
	let fechaEsperada = $state<string>('');
	let motivo = $state('');
	let tipoPago = $state<TipoPagoPrestamo>('iguales');
	let numCuotas = $state(1);
	let valoresCuota = $state<string[]>(['']);
	let fechasCuota = $state<string[]>(['']);
	let cargando = $state(false);

	$effect(() => {
		const n = Math.max(1, Math.min(24, numCuotas | 0));
		if (valoresCuota.length !== n) {
			const arr = valoresCuota.slice(0, n);
			while (arr.length < n) arr.push('');
			valoresCuota = arr;
		}
		if (fechasCuota.length !== n) {
			const arr = fechasCuota.slice(0, n);
			while (arr.length < n) arr.push('');
			fechasCuota = arr;
		}
	});

	let modoAnterior = $state<TipoPagoPrestamo>('iguales');
	$effect(() => {
		if (tipoPago !== modoAnterior) {
			valoresCuota = Array(Math.max(1, numCuotas | 0)).fill('');
			modoAnterior = tipoPago;
		}
	});

	const moneda = $derived(
		(page.data.hogarActivo as { moneda?: string } | undefined)?.moneda || 'COP'
	);
	const fmt = $derived(
		(n: number) =>
			new Intl.NumberFormat('es-CO', {
				style: 'currency',
				currency: moneda,
				maximumFractionDigits: 0
			}).format(n)
	);

	const receptorElegido = $derived(miembros.find((m) => m.userId === receptorId) ?? null);

	type Cuota = { numero: number; monto: number; fechaEsperada: string | null };
	const cuotas = $derived.by<Cuota[] | null>(() => {
		const m = monto ?? 0;
		const n = Math.max(1, Math.min(24, numCuotas | 0));
		if (m <= 0) return null;
		const fechas = fechasCuota.map((f) => (f && f.length > 0 ? f : null));

		if (tipoPago === 'iguales') {
			const cents = Math.floor((m * 100) / n);
			const arr: Cuota[] = [];
			let acumulado = 0;
			for (let i = 0; i < n; i++) {
				const valor = cents / 100;
				arr.push({ numero: i + 1, monto: valor, fechaEsperada: fechas[i] });
				acumulado += valor;
			}
			const diff = Math.round((m - acumulado) * 100) / 100;
			if (Math.abs(diff) > 0.001) arr[0].monto = Math.round((arr[0].monto + diff) * 100) / 100;
			return arr;
		}
		if (tipoPago === 'porcentaje') {
			const arr: Cuota[] = [];
			let total = 0;
			for (let i = 0; i < n; i++) {
				const pct = Number(valoresCuota[i] || '0');
				if (!Number.isFinite(pct) || pct < 0) return null;
				const monto = Math.round(((m * pct) / 100) * 100) / 100;
				arr.push({ numero: i + 1, monto, fechaEsperada: fechas[i] });
				total += pct;
			}
			if (Math.abs(total - 100) > 0.01) return null;
			const suma = arr.reduce((a, c) => a + c.monto, 0);
			const diff = Math.round((m - suma) * 100) / 100;
			if (Math.abs(diff) > 0.001) arr[0].monto = Math.round((arr[0].monto + diff) * 100) / 100;
			return arr;
		}
		if (tipoPago === 'exacto') {
			const arr: Cuota[] = [];
			let total = 0;
			for (let i = 0; i < n; i++) {
				const monto = Number(valoresCuota[i] || '0');
				if (!Number.isFinite(monto) || monto <= 0) return null;
				arr.push({ numero: i + 1, monto, fechaEsperada: fechas[i] });
				total += monto;
			}
			if (Math.abs(total - m) > 0.01) return null;
			return arr;
		}
		return null;
	});

	const cuotasJson = $derived(
		cuotas
			? JSON.stringify(
					cuotas.map((c) => ({
						numero: c.numero,
						monto: c.monto,
						fecha_esperada: c.fechaEsperada
					}))
				)
			: ''
	);

	const sumaInfo = $derived.by(() => {
		const m = monto ?? 0;
		if (tipoPago === 'porcentaje') {
			const total = valoresCuota
				.slice(0, numCuotas)
				.reduce((a, v) => a + (Number(v || '0') || 0), 0);
			return { suma: total, objetivo: 100, esPorcentaje: true };
		}
		if (tipoPago === 'exacto') {
			const total = valoresCuota
				.slice(0, numCuotas)
				.reduce((a, v) => a + (Number(v || '0') || 0), 0);
			return { suma: total, objetivo: m, esPorcentaje: false };
		}
		return null;
	});

	const valido = $derived(
		receptorId.length > 0 &&
			monto !== null &&
			Number.isFinite(monto) &&
			monto > 0 &&
			cuotas !== null
	);

	function onSubmit({ cancel }: { cancel: () => void }) {
		if (!valido || cargando) {
			cancel();
			return;
		}
		cargando = true;
		errorRegistro = null;
		return async ({
			result,
			update
		}: {
			result: { type: string; data?: { error?: string } };
			update: (opts?: { reset?: boolean; invalidateAll?: boolean }) => Promise<void>;
		}) => {
			try {
				if (result.type === 'success') {
					await update({ invalidateAll: false });
					await invalidate('app:prestamos');
					await goto('/prestamos');
				} else {
					errorRegistro = result.data?.error || 'No se pudo registrar el préstamo.';
				}
			} finally {
				cargando = false;
			}
		};
	}

	const labelClass =
		'flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted uppercase';
	const inputClass =
		'tabular w-full rounded-input border border-transparent bg-brand-50 px-3 py-2.5 text-text outline-none placeholder:text-muted/70 disabled:opacity-60';

	const opcionesMiembros = $derived(
		miembros.map((m) => ({ value: m.userId, label: m.nombre }))
	);

	const MODOS: Array<{ id: TipoPagoPrestamo; label: string; desc: string }> = [
		{ id: 'iguales', label: TIPO_PAGO_LABEL.iguales, desc: TIPO_PAGO_DESC.iguales },
		{ id: 'porcentaje', label: TIPO_PAGO_LABEL.porcentaje, desc: TIPO_PAGO_DESC.porcentaje },
		{ id: 'exacto', label: TIPO_PAGO_LABEL.exacto, desc: TIPO_PAGO_DESC.exacto }
	];

	// Clamping: si el usuario escribe más del límite, lo bajamos al máximo
	// disponible (porcentaje no puede pasar de 100 sumado, exacto no puede
	// pasar del monto total sumado).
	$effect(() => {
		if (tipoPago === 'porcentaje') {
			let usado = 0;
			for (let i = 0; i < numCuotas; i++) {
				const v = Number(valoresCuota[i] || '0');
				const safe = Number.isFinite(v) && v >= 0 ? v : 0;
				const disponible = Math.max(0, 100 - usado);
				const clamp = Math.min(safe, disponible);
				if (clamp !== safe) {
					valoresCuota[i] = String(clamp);
				}
				usado += clamp;
			}
		}
		if (tipoPago === 'exacto' && monto !== null && monto > 0) {
			let usado = 0;
			for (let i = 0; i < numCuotas; i++) {
				const v = Number(valoresCuota[i] || '0');
				const safe = Number.isFinite(v) && v >= 0 ? v : 0;
				const disponible = Math.max(0, monto - usado);
				const clamp = Math.min(safe, disponible);
				if (clamp !== safe) {
					valoresCuota[i] = String(clamp);
				}
				usado += clamp;
			}
		}
	});
</script>

<div class="flex flex-col px-5 py-6 md:px-8 lg:h-full lg:w-full lg:flex-1 lg:min-h-0">
	<a
		href="/prestamos"
		class="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-text"
	>
		<ArrowLeft size={16} />
		Volver
	</a>

	<!-- Header con título + botones de acción a la derecha (patrón /gastos/nuevo) -->
	<div class="mt-4 flex items-start justify-between gap-3">
		<div>
			<h1 class="text-2xl font-bold tracking-tight text-text">Nuevo préstamo</h1>
			<p class="mt-1 text-sm text-muted">Registra plata que le prestas a alguien del hogar.</p>
		</div>
		<div class="flex shrink-0 items-center gap-2">
			<a
				href="/prestamos"
				class="hidden h-10 items-center justify-center rounded-input border border-border bg-surface px-4 text-sm font-semibold text-text transition-colors hover:bg-bg sm:inline-flex"
			>
				Cancelar
			</a>
			<button
				type="submit"
				form="form-nuevo-prestamo"
				disabled={cargando || !valido || miembros.length === 0}
				class="inline-flex h-10 items-center justify-center rounded-input bg-brand-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
			>
				{cargando ? 'Guardando…' : 'Guardar préstamo'}
			</button>
		</div>
	</div>

	<!-- Vista previa LIVE — mismo patrón que /gastos/nuevo -->
	<section class="mt-5 rounded-card border border-border bg-surface p-4 shadow-card">
		<p class="text-xs font-semibold tracking-wide text-muted uppercase">Vista previa</p>
		<div class="mt-3 flex items-center gap-3">
			<span class="grid size-14 shrink-0 place-items-center rounded-card bg-brand-50 text-brand-700">
				<HandCoins size={26} />
			</span>
			<div class="min-w-0 flex-1">
				<p class="truncate text-base font-semibold text-text">
					{#if receptorElegido}
						Le prestas a {receptorElegido.nombre}
					{:else}
						Sin receptor todavía
					{/if}
				</p>
				<p class="mt-0.5 text-xs text-muted">
					{TIPO_PAGO_LABEL[tipoPago]} · {numCuotas}
					{numCuotas === 1 ? 'cuota' : 'cuotas'}
				</p>
			</div>
			<p class="tabular shrink-0 text-2xl font-bold text-text">
				{fmt(monto && monto > 0 ? monto : 0)}
			</p>
		</div>
	</section>

	<form
		id="form-nuevo-prestamo"
		method="POST"
		action="/prestamos?/registrar"
		use:enhance={onSubmit}
		class="mt-5 flex flex-1 flex-col gap-5 lg:min-h-0"
	>
		<input type="hidden" name="cuotas" value={cuotasJson} />
		<input type="hidden" name="tipo_pago" value={tipoPago} />
		<input type="hidden" name="fecha" value={fecha} />
		<input type="hidden" name="fecha_esperada" value={fechaEsperada} />

		<div class="grid gap-5 lg:grid-cols-5 lg:flex-1 lg:min-h-0">
			<!-- COLUMNA IZQUIERDA (3/5): datos + fechas + motivo -->
			<div class="flex flex-col gap-5 lg:col-span-3 lg:min-h-0">
				<section>
					<p class={labelClass}>
						<HandCoins size={13} class="text-brand-500" />
						Datos del préstamo
					</p>
					<div class="mt-2 space-y-4 rounded-card border border-border bg-surface p-5 shadow-card">
						<div class="space-y-1.5">
							<label for="receptor-select" class="block text-sm font-medium text-text">
								A quién le prestas
							</label>
							{#if miembros.length === 0}
								<p class="text-sm text-muted">Invita a alguien al hogar primero.</p>
							{:else}
								<Select
									id="receptor-select"
									name="receptor_id"
									placeholder="Elige a la persona"
									options={opcionesMiembros}
									bind:value={receptorId}
								/>
							{/if}
						</div>
						<div class="space-y-1.5">
							<label for="monto" class="block text-sm font-medium text-text">Monto</label>
							<MoneyInput
								id="monto"
								name="monto"
								required
								min={1}
								bind:value={monto}
								disabled={cargando}
								class={'w-full rounded-input border border-transparent bg-brand-50 px-3 py-2.5 text-text outline-none placeholder:text-muted/70 disabled:opacity-60'}
							/>
						</div>
						<!-- Los dos calendarios comparten fila, compactos. -->
						<div class="grid gap-3 sm:grid-cols-2">
							<div class="space-y-1.5">
								<label for="fecha-trigger" class="block text-sm font-medium text-text">
									Fecha
								</label>
								<DatePicker id="fecha-trigger" bind:value={fecha} max={hoyIso} />
							</div>
							<div class="space-y-1.5">
								<label
									for="fecha-esperada-trigger"
									class="block text-sm font-medium text-text"
								>
									Devolución <span class="font-normal text-muted">(opcional)</span>
								</label>
								<DatePicker
									id="fecha-esperada-trigger"
									bind:value={fechaEsperada}
									min={fecha}
								/>
							</div>
						</div>
					</div>
				</section>

				<section class="flex flex-col lg:min-h-0 lg:flex-1">
					<p class={labelClass}>
						<StickyNote size={13} class="text-brand-500" />
						Motivo <span class="font-normal normal-case">(opcional)</span>
					</p>
					<div class="mt-2 flex flex-col rounded-card border border-border bg-surface p-5 shadow-card lg:min-h-0 lg:flex-1">
						<textarea
							id="motivo"
							name="motivo"
							bind:value={motivo}
							rows="3"
							placeholder="Para el arriendo, mercado, etc."
							class={inputClass + ' resize-none lg:min-h-0 lg:flex-1'}
							maxlength="120"
						></textarea>
					</div>
				</section>

				{#if errorRegistro}
					<p class="rounded-input bg-money-contra-bg px-3 py-2.5 text-sm text-money-contra">
						{errorRegistro}
					</p>
				{/if}
			</div>

			<!-- COLUMNA DERECHA (2/5): modo + cuotas -->
			<div class="flex flex-col gap-5 lg:col-span-2 lg:min-h-0">
				<!-- Modo de devolución: mismo patrón que "Cómo se divide" de gastos -->
				<section>
					<p class={labelClass}>
						<Coins size={13} class="text-brand-500" />
						Modo de devolución
					</p>
					<div class="mt-2 flex flex-col overflow-hidden rounded-card bg-surface shadow-card">
						{#each MODOS as m, i (m.id)}
							{@const sel = tipoPago === m.id}
							<button
								type="button"
								onclick={() => (tipoPago = m.id)}
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

				<!-- Cuotas: lista que llena el alto restante de la columna -->
				<section class="flex flex-col lg:min-h-0 lg:flex-1">
					<div class="flex items-end justify-between">
						<p class={labelClass}>
							<Coins size={13} class="text-brand-500" />
							Plan de cuotas
						</p>
						<div class="flex items-center gap-1">
							<button
								type="button"
								onclick={() => (numCuotas = Math.max(1, numCuotas - 1))}
								disabled={cargando || numCuotas <= 1}
								class="grid size-7 place-items-center rounded-input border border-border bg-surface text-text transition-colors hover:bg-bg disabled:opacity-40"
								aria-label="Menos"
							>
								−
							</button>
							<input
								type="number"
								min="1"
								max="24"
								bind:value={numCuotas}
								disabled={cargando}
								class="tabular w-12 rounded-input border border-transparent bg-brand-50 px-2 py-1 text-center text-xs font-semibold text-text outline-none"
								aria-label="Número de cuotas"
							/>
							<button
								type="button"
								onclick={() => (numCuotas = Math.min(24, numCuotas + 1))}
								disabled={cargando || numCuotas >= 24}
								class="grid size-7 place-items-center rounded-input border border-border bg-surface text-text transition-colors hover:bg-bg disabled:opacity-40"
								aria-label="Más"
							>
								+
							</button>
						</div>
					</div>

					<ul class="mt-2 overflow-hidden rounded-card bg-surface shadow-card lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
						{#each Array(numCuotas) as _, i (i)}
							<li
								class="flex items-center gap-3 px-4 py-3"
								class:border-t={i > 0}
								class:border-border={i > 0}
							>
								<span class="grid size-9 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">
									{i + 1}
								</span>
								<div class="min-w-0 flex-1">
									{#if tipoPago === 'iguales'}
										<p class="tabular text-sm font-semibold text-text">
											{cuotas && cuotas[i] ? fmt(cuotas[i].monto) : fmt(0)}
										</p>
									{:else if tipoPago === 'porcentaje'}
										<div class="flex items-center gap-1.5">
											<input
												type="number"
												min="0"
												max="100"
												step="any"
												inputmode="decimal"
												placeholder="0"
												bind:value={valoresCuota[i]}
												disabled={cargando}
												class="tabular w-16 rounded-input bg-brand-50 px-2 py-1.5 text-center text-sm text-text outline-none disabled:opacity-60"
											/>
											<span class="text-sm text-muted">%</span>
											{#if cuotas && cuotas[i]}
												<span class="tabular ml-auto text-xs text-muted">
													= {fmt(cuotas[i].monto)}
												</span>
											{/if}
										</div>
									{:else if tipoPago === 'exacto'}
										<input
											type="number"
											min="0"
											step="any"
											inputmode="decimal"
											placeholder="0"
											bind:value={valoresCuota[i]}
											disabled={cargando}
											class="tabular w-full rounded-input bg-brand-50 px-2 py-1.5 text-sm text-text outline-none disabled:opacity-60"
										/>
									{/if}
								</div>
							</li>
						{/each}
					</ul>

					{#if sumaInfo}
						{@const s = sumaInfo}
						{@const cierra = Math.abs(s.suma - s.objetivo) <= 0.01}
						<p
							class={'tabular mt-2 text-xs ' +
								(cierra ? 'text-money-favor' : 'text-warning')}
						>
							Suma:
							{s.esPorcentaje ? `${s.suma}%` : fmt(s.suma)}
							/
							{s.esPorcentaje ? `${s.objetivo}%` : fmt(s.objetivo)}
						</p>
					{/if}
				</section>
			</div>
		</div>
	</form>
</div>
