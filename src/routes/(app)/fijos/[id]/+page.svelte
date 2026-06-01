<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Check from '@lucide/svelte/icons/check';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Calendar from '@lucide/svelte/icons/calendar';
	import StickyNote from '@lucide/svelte/icons/sticky-note';
	import Repeat from '@lucide/svelte/icons/repeat';
	import Divide from '@lucide/svelte/icons/divide';
	import Users from '@lucide/svelte/icons/users';
	import HandCoins from '@lucide/svelte/icons/hand-coins';
	import History from '@lucide/svelte/icons/history';
	import Tag from '@lucide/svelte/icons/tag';
	import { iconoCategoria } from '$lib/iconosCategoria';
	import MoneyInput from '$lib/components/MoneyInput.svelte';
	import { supabaseBrowser } from '$lib/supabase-browser';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const plantilla = $derived(data.plantilla);
	const meses = $derived(data.meses);
	const divPlantilla = $derived(data.divisionesPlantilla);

	const monedaActiva = $derived(
		(page.data.hogarActivo as { moneda?: string } | undefined)?.moneda || 'COP'
	);
	const esAdmin = $derived(
		(page.data.hogarActivo as { rol?: string } | undefined)?.rol === 'admin'
	);
	const fmt = $derived(
		(n: number) =>
			new Intl.NumberFormat('es-CO', {
				style: 'currency',
				currency: monedaActiva,
				maximumFractionDigits: 0
			}).format(n)
	);

	const yo = $derived((page.data.user as { id?: string } | undefined)?.id ?? '');

	const Icono = $derived(iconoCategoria(plantilla.categoria?.icono));

	const MODO_LABEL: Record<string, string> = {
		iguales: 'Partes iguales',
		porcentaje: 'Por porcentaje',
		exacto: 'Monto exacto',
		partes: 'Por partes'
	};

	function iniciales(nombre: string) {
		return (
			nombre
				.trim()
				.split(/\s+/)
				.map((w) => w[0])
				.slice(0, 2)
				.join('') || '?'
		).toUpperCase();
	}

	// Mes que se muestra activo (el más reciente por defecto).
	let mesElegidoIdx = $state(0);
	const mesActivo = $derived(meses[mesElegidoIdx] ?? null);

	// Form de aporte propio en el mes activo.
	let aporteMonto = $state<number | null>(null);
	let errorAporte = $state<string | null>(null);
	let procesando = $state(false);
	const miDivision = $derived(
		mesActivo?.divisiones.find((d) => d.participanteId === yo) ?? null
	);
	const pendienteMio = $derived(miDivision ? miDivision.pendiente : 0);

	$effect(() => {
		if (aporteMonto !== null && pendienteMio > 0 && aporteMonto > pendienteMio) {
			aporteMonto = pendienteMio;
		}
	});

	function onEnhanceAportar({ cancel }: { cancel: () => void }) {
		if (procesando) {
			cancel();
			return;
		}
		procesando = true;
		errorAporte = null;
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
					await invalidate('app:fijos');
					aporteMonto = null;
				} else {
					errorAporte = result.data?.error || 'No se pudo registrar el aporte.';
				}
			} finally {
				procesando = false;
			}
		};
	}

	function onEnhanceAccion({ cancel }: { cancel: () => void }) {
		if (procesando) {
			cancel();
			return;
		}
		procesando = true;
		return async ({
			result,
			update
		}: {
			result: { type: string };
			update: (opts?: { invalidateAll?: boolean }) => Promise<void>;
		}) => {
			try {
				if (result.type === 'success') {
					await update({ invalidateAll: false });
					await invalidate('app:fijos');
				}
			} finally {
				procesando = false;
			}
		};
	}

	let confirmarBorrar = $state(false);

	// Realtime
	const hogarId = $derived(
		(page.data.hogarActivo as { id?: string } | undefined)?.id ?? ''
	);
	onMount(() => {
		if (!hogarId) return;
		const supabase = supabaseBrowser();
		const session = page.data.session as { access_token?: string } | undefined;
		if (session?.access_token) supabase.realtime.setAuth(session.access_token);
		let debounceId: ReturnType<typeof setTimeout> | null = null;
		const refrescar = () => {
			if (debounceId) clearTimeout(debounceId);
			debounceId = setTimeout(() => invalidate('app:fijos'), 250);
		};
		const canal = supabase
			.channel(`fijos-detalle-${plantilla.id}`)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'gastos_fijos_aportes' },
				refrescar
			)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'gastos_fijos_mes_division' },
				refrescar
			)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'gastos_fijos_plantilla' },
				refrescar
			)
			.subscribe();
		return () => {
			if (debounceId) clearTimeout(debounceId);
			supabase.removeChannel(canal);
		};
	});

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

	<div class="mt-3 flex flex-1 flex-col gap-5 lg:min-h-0">
		<!-- Header card -->
		<section class="rounded-card border border-border bg-surface p-6 shadow-card">
			<div class="flex items-start gap-4">
				<span class="grid size-16 shrink-0 place-items-center rounded-card bg-brand-50 text-brand-700">
					<Icono size={28} />
				</span>
				<div class="min-w-0 flex-1">
					<h1 class="text-xl font-bold text-text">{plantilla.nombre}</h1>
					<p class="tabular mt-1 text-4xl font-bold text-text">{plantilla.montoTexto}</p>
					<p class="mt-2 text-xs text-muted">
						{MODO_LABEL[plantilla.modo]} · vence el día {plantilla.diaVencimiento}
					</p>
				</div>
				<div class="flex shrink-0 flex-col items-end gap-2">
					<span
						class={'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ' +
							(plantilla.activa
								? 'bg-brand-50 text-brand-700'
								: 'bg-bg text-muted')}
					>
						{plantilla.activa ? 'Activo' : 'Archivado'}
					</span>
					<!-- Archivar / Eliminar — solo el administrador del hogar. -->
					{#if esAdmin}
						<form method="POST" action="?/toggleActiva" use:enhance={onEnhanceAccion}>
							<input type="hidden" name="activa" value={(!plantilla.activa).toString()} />
							<button
								type="submit"
								disabled={procesando}
								class="text-xs font-medium text-muted transition-colors hover:text-text disabled:opacity-50"
							>
								{plantilla.activa ? 'Archivar' : 'Reactivar'}
							</button>
						</form>
						{#if !confirmarBorrar}
							<button
								type="button"
								onclick={() => (confirmarBorrar = true)}
								disabled={procesando}
								class="flex size-8 items-center justify-center rounded-input text-muted transition-colors hover:bg-money-contra-bg hover:text-money-contra disabled:opacity-40"
								aria-label="Borrar"
							>
								<Trash2 size={16} />
							</button>
						{/if}
					{/if}
				</div>
			</div>

			{#if confirmarBorrar}
				<div class="mt-4 rounded-input bg-money-contra-bg p-3">
					<p class="text-sm font-medium text-text">¿Borrar este gasto fijo?</p>
					<p class="mt-1 text-xs text-muted">
						Se borra la plantilla y todo el historial de meses y aportes asociados.
					</p>
					<div class="mt-2.5 flex gap-2">
						<form method="POST" action="?/borrar" class="flex-1" use:enhance={onEnhanceAccion}>
							<button
								type="submit"
								disabled={procesando}
								class="w-full rounded-input bg-money-contra px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
							>
								{procesando ? 'Borrando…' : 'Sí, borrar'}
							</button>
						</form>
						<button
							type="button"
							onclick={() => (confirmarBorrar = false)}
							disabled={procesando}
							class="flex-1 rounded-input bg-surface px-3 py-2 text-sm font-medium text-text transition-colors hover:bg-bg disabled:opacity-60"
						>
							Volver
						</button>
					</div>
				</div>
			{/if}
		</section>

		<!-- Cuerpo 2 columnas -->
		<div class="grid flex-1 gap-5 lg:grid-cols-2 lg:gap-6 lg:min-h-0">
			<!-- Izquierda: detalles + selector de mes + cuotas -->
			<div class="flex flex-col gap-5 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
				<section>
					<p class={labelClass}>Detalles</p>
					<div class="mt-2 divide-y divide-border rounded-card bg-surface shadow-card">
						<div class="flex items-center gap-3 px-4 py-3">
							<span class="grid size-9 shrink-0 place-items-center rounded-input bg-brand-50 text-brand-700">
								<Tag size={17} />
							</span>
							<div class="min-w-0 flex-1">
								<p class="text-xs text-muted">Categoría</p>
								<p class="text-sm font-medium text-text">
									{plantilla.categoria?.nombre ?? 'Sin categoría'}
								</p>
							</div>
						</div>
						<div class="flex items-center gap-3 px-4 py-3">
							<span class="grid size-9 shrink-0 place-items-center rounded-input bg-brand-50 text-brand-700">
								<Divide size={17} />
							</span>
							<div class="min-w-0 flex-1">
								<p class="text-xs text-muted">Reparto</p>
								<p class="text-sm font-medium text-text">{MODO_LABEL[plantilla.modo]}</p>
							</div>
						</div>
						<div class="flex items-center gap-3 px-4 py-3">
							<span class="grid size-9 shrink-0 place-items-center rounded-input bg-brand-50 text-brand-700">
								<Calendar size={17} />
							</span>
							<div class="min-w-0 flex-1">
								<p class="text-xs text-muted">Día de vencimiento</p>
								<p class="text-sm font-medium text-text">Día {plantilla.diaVencimiento} de cada mes</p>
							</div>
						</div>
						{#if plantilla.notas}
							<div class="flex items-center gap-3 px-4 py-3">
								<span class="grid size-9 shrink-0 place-items-center rounded-input bg-brand-50 text-brand-700">
									<StickyNote size={17} />
								</span>
								<div class="min-w-0 flex-1">
									<p class="text-xs text-muted">Notas</p>
									<p class="text-sm font-medium text-text whitespace-pre-line">
										{plantilla.notas}
									</p>
								</div>
							</div>
						{/if}
					</div>
				</section>

				<!-- Selector del mes a ver -->
				{#if meses.length > 0}
					<section>
						<p class={labelClass}>
							<Repeat size={13} class="text-brand-500" />
							Mes
						</p>
						<div class="mt-2 flex flex-wrap gap-2">
							{#each meses as m, i (m.id)}
								{@const sel = mesElegidoIdx === i}
								<button
									type="button"
									onclick={() => (mesElegidoIdx = i)}
									class={'rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold capitalize shadow-card transition-colors ' +
										(sel
											? 'bg-brand-50 text-brand-700'
											: 'bg-surface text-muted hover:bg-bg hover:text-text')}
								>
									{m.mesTexto}
								</button>
							{/each}
						</div>
					</section>
				{/if}

				<!-- Cuotas del mes activo -->
				{#if mesActivo}
					<section class="flex flex-col lg:min-h-0 lg:flex-1">
						<div class="flex items-end justify-between">
							<p class={labelClass}>
								<Users size={13} class="text-brand-500" />
								Cómo va este mes
							</p>
							<p class="tabular text-xs text-muted">
								{mesActivo.avance.aportaron} de {mesActivo.avance.total} aportaron
							</p>
						</div>
						<ul class="mt-2 overflow-hidden rounded-card bg-surface shadow-card lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
							{#each mesActivo.divisiones as d, i (d.id)}
								{@const esYo = d.participanteId === yo}
								{@const pct = d.monto > 0 ? Math.min(100, (d.pagado / d.monto) * 100) : 0}
								<li
									class="flex items-center gap-3 px-4 py-3"
									class:border-t={i > 0}
									class:border-border={i > 0}
								>
									{#if d.participanteAvatar}
										<img
											src={d.participanteAvatar}
											alt=""
											referrerpolicy="no-referrer"
											class="size-10 shrink-0 rounded-full object-cover"
										/>
									{:else}
										<span class="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">
											{iniciales(d.participanteNombre)}
										</span>
									{/if}
									<div class="min-w-0 flex-1">
										<div class="flex items-center justify-between gap-2">
											<p class="truncate text-sm font-medium text-text">
												{d.participanteNombre}{#if esYo}<span class="text-muted"> · Tú</span>{/if}
											</p>
											{#if d.pendiente <= 0.01}
												<span class="inline-flex shrink-0 items-center gap-1 rounded-full bg-money-favor-bg px-2 py-0.5 text-xs font-medium text-money-favor">
													<Check size={11} strokeWidth={3} />
													Pagado
												</span>
											{:else if d.pagado > 0.01}
												<span class="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
													Parcial
												</span>
											{:else}
												<span class="shrink-0 rounded-full bg-money-contra-bg px-2 py-0.5 text-xs font-medium text-money-contra">
													Pendiente
												</span>
											{/if}
										</div>
										<p class="tabular mt-0.5 text-xs text-muted">
											{d.pagadoTexto} / {d.montoTexto}
											{#if d.pendiente > 0.01}· falta {d.pendienteTexto}{/if}
										</p>
										<div class="mt-1.5 h-1 overflow-hidden rounded-full bg-bg">
											<div
												class={'h-full rounded-full transition-all ' +
													(d.pendiente <= 0.01 ? 'bg-money-favor' : 'bg-brand-500')}
												style="width: {pct}%"
											></div>
										</div>
									</div>
								</li>
							{/each}
						</ul>
					</section>
				{/if}
			</div>

			<!-- Derecha: form aporte + historial de mis aportes -->
			<div class="flex flex-col gap-5 lg:min-h-0">
				<!-- Form aporte -->
				{#if miDivision && mesActivo}
					<section>
						<p class={labelClass}>
							<HandCoins size={13} class="text-brand-500" />
							Registrar mi aporte
						</p>
						<div class="mt-2 rounded-card border border-border bg-surface p-5 shadow-card">
							{#if pendienteMio <= 0.01}
								<div class="flex items-center gap-3">
									<span class="grid size-10 shrink-0 place-items-center rounded-full bg-money-favor-bg text-money-favor">
										<Check size={18} strokeWidth={3} />
									</span>
									<div class="min-w-0">
										<p class="text-sm font-medium text-text">Ya pagaste tu parte de {mesActivo.mesTexto}</p>
										<p class="text-xs text-muted">No te queda nada pendiente este mes.</p>
									</div>
								</div>
							{:else}
								<form
									method="POST"
									action="?/aportar"
									use:enhance={onEnhanceAportar}
									class="flex flex-col gap-3 sm:flex-row sm:items-end"
								>
									<input type="hidden" name="division_id" value={miDivision.id} />
									<div class="flex-1 space-y-1.5">
										<label for="ap-monto" class="block text-sm font-medium text-text">
											Monto
											<span class="font-normal text-muted">· te falta {miDivision.pendienteTexto}</span>
										</label>
										<MoneyInput
											id="ap-monto"
											name="monto"
											required
											max={pendienteMio}
											disabled={procesando}
											bind:value={aporteMonto}
											class="w-full rounded-input border border-transparent bg-brand-50 px-3 py-2.5 text-text outline-none placeholder:text-muted/70 disabled:opacity-60"
										/>
									</div>
									<button
										type="submit"
										disabled={procesando || !aporteMonto || aporteMonto <= 0}
										class="flex h-11 shrink-0 items-center justify-center gap-2 rounded-input bg-brand-500 px-5 font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
									>
										<HandCoins size={16} />
										{procesando ? 'Guardando…' : 'Registrar'}
									</button>
								</form>
								{#if errorAporte}
									<p class="mt-3 rounded-input bg-money-contra-bg px-3 py-2 text-sm text-money-contra">
										{errorAporte}
									</p>
								{/if}
							{/if}
						</div>
					</section>
				{/if}

				<!-- Historial de mis aportes del mes activo -->
				{#if mesActivo}
					{@const todosAportes = mesActivo.divisiones.flatMap((d) =>
						d.aportes.map((a) => ({
							...a,
							nombre: d.participanteNombre,
							esYo: d.participanteId === yo
						}))
					)}
					<section class="flex flex-col lg:min-h-0 lg:flex-1">
						<div class="flex items-end justify-between">
							<p class={labelClass}>
								<History size={13} class="text-brand-500" />
								Historial de {mesActivo.mesTexto}
							</p>
							<p class="tabular text-xs text-muted">
								{todosAportes.length}
								{todosAportes.length === 1 ? 'aporte' : 'aportes'}
							</p>
						</div>
						{#if todosAportes.length === 0}
							<div
								class="mt-2 flex flex-col items-center justify-center rounded-card border border-dashed border-border bg-surface p-8 text-center lg:min-h-0 lg:flex-1"
							>
								<p class="text-sm text-muted">Nadie ha aportado todavía este mes.</p>
							</div>
						{:else}
							<ul class="mt-2 overflow-hidden rounded-card bg-surface shadow-card lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
								{#each todosAportes.sort((a, b) => b.fecha.localeCompare(a.fecha)) as a, i (a.id)}
									<li
										class="flex items-center gap-3 px-4 py-3"
										class:border-t={i > 0}
										class:border-border={i > 0}
									>
										<span class="grid size-9 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">
											{iniciales(a.nombre)}
										</span>
										<div class="min-w-0 flex-1">
											<p class="text-sm font-medium text-text">
												{a.esYo ? 'Tú' : a.nombre}
												<span class="text-muted"> · {a.fechaTexto}</span>
											</p>
											{#if a.nota}
												<p class="text-xs text-muted">{a.nota}</p>
											{/if}
										</div>
										<span class="tabular shrink-0 text-sm font-semibold text-money-favor">
											+{a.montoTexto}
										</span>
										{#if a.registradoPorId === yo}
											<form method="POST" action="?/borrarAporte" use:enhance={onEnhanceAccion}>
												<input type="hidden" name="id" value={a.id} />
												<button
													type="submit"
													disabled={procesando}
													class="flex size-8 shrink-0 items-center justify-center rounded-input text-muted transition-colors hover:bg-money-contra-bg hover:text-money-contra disabled:opacity-40"
													aria-label="Borrar aporte"
												>
													<Trash2 size={14} />
												</button>
											</form>
										{/if}
									</li>
								{/each}
							</ul>
						{/if}
					</section>
				{/if}
			</div>
		</div>
	</div>
</div>
