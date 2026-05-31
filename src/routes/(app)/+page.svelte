<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import Users from '@lucide/svelte/icons/users';
	import Receipt from '@lucide/svelte/icons/receipt';
	import HandCoins from '@lucide/svelte/icons/hand-coins';
	import Check from '@lucide/svelte/icons/check';
	import X from '@lucide/svelte/icons/x';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { supabaseBrowser } from '$lib/supabase-browser';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const resumen = $derived(data.resumen);
	const pagosRecibir = $derived(data.pagosRecibir);
	const pagosEnviados = $derived(data.pagosEnviados);

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

	const colorSaldo = (n: number) =>
		n > 0.01 ? 'text-money-favor' : n < -0.01 ? 'text-money-contra' : 'text-text';

	// Flatten: una fila por gasto-deuda, no agrupada por persona. Cada fila
	// lleva el id real de la división (lo que el action de abonar necesita).
	type FilaDeuda = {
		divisionId: string;
		gastoId: string;
		gastoTitulo: string;
		fechaTexto: string;
		otroId: string;
		otroNombre: string;
		otroAvatar: string | null;
		pendiente: number;
		pendienteTexto: string;
		pendienteConfirmacion: number;
		pendienteConfirmacionTexto: string;
	};

	const filasLeDebo = $derived<FilaDeuda[]>(
		resumen.personas.flatMap((p) =>
			p.leDebo.map((d) => ({
				divisionId: d.divisionId,
				gastoId: d.gastoId,
				gastoTitulo: d.titulo,
				fechaTexto: d.fechaTexto,
				otroId: p.id,
				otroNombre: p.nombre,
				otroAvatar: p.avatar,
				pendiente: d.pendiente,
				pendienteTexto: d.pendienteTexto,
				pendienteConfirmacion: d.pendienteConfirmacion,
				pendienteConfirmacionTexto: d.pendienteConfirmacionTexto
			}))
		)
	);
	const filasMeDeben = $derived<FilaDeuda[]>(
		resumen.personas.flatMap((p) =>
			p.meDebe.map((d) => ({
				divisionId: d.divisionId,
				gastoId: d.gastoId,
				gastoTitulo: d.titulo,
				fechaTexto: d.fechaTexto,
				otroId: p.id,
				otroNombre: p.nombre,
				otroAvatar: p.avatar,
				pendiente: d.pendiente,
				pendienteTexto: d.pendienteTexto,
				pendienteConfirmacion: d.pendienteConfirmacion,
				pendienteConfirmacionTexto: d.pendienteConfirmacionTexto
			}))
		)
	);

	// === Abonar inline a una deuda específica ===============================
	// Una fila a la vez. El abono crea un aporte pendiente contra la división.
	let abonandoDivisionId = $state<string | null>(null);
	let aporteMonto = $state<number | null>(null);
	let procesando = $state(false);
	let errorAbono = $state<string | null>(null);

	function abrirAbonar(f: FilaDeuda) {
		if (procesando) return;
		abonandoDivisionId = f.divisionId;
		aporteMonto = f.pendiente;
		errorAbono = null;
	}
	function cerrarAbonar() {
		if (procesando) return;
		abonandoDivisionId = null;
		errorAbono = null;
	}

	function onEnhanceAbonar({ cancel }: { cancel: () => void }) {
		if (procesando) {
			cancel();
			return;
		}
		procesando = true;
		errorAbono = null;
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
					await invalidate('app:inicio');
					abonandoDivisionId = null;
				} else {
					errorAbono = result.data?.error || 'No se pudo registrar el abono.';
				}
			} finally {
				procesando = false;
			}
		};
	}

	// Acciones de pagos pendientes (confirmar / rechazar / borrar).
	let procesandoPago = $state<string | null>(null);
	function onEnhancePagoAccion(pagoId: string) {
		return ({ cancel }: { cancel: () => void }) => {
			if (procesandoPago) {
				cancel();
				return;
			}
			procesandoPago = pagoId;
			return async ({
				result,
				update
			}: {
				result: { type: string; data?: { error?: string } };
				update: (opts?: { invalidateAll?: boolean }) => Promise<void>;
			}) => {
				try {
					if (result.type === 'success') {
						await update({ invalidateAll: false });
						await invalidate('app:inicio');
					}
				} finally {
					procesandoPago = null;
				}
			};
		};
	}

	// === Tiempo real ========================================================
	const hogarId = $derived(
		(page.data.hogarActivo as { id?: string } | undefined)?.id ?? ''
	);

	onMount(() => {
		if (!hogarId) return;
		const supabase = supabaseBrowser();

		const session = page.data.session as { access_token?: string } | undefined;
		if (session?.access_token) {
			supabase.realtime.setAuth(session.access_token);
		}

		let debounceId: ReturnType<typeof setTimeout> | null = null;
		const refrescar = () => {
			if (debounceId) clearTimeout(debounceId);
			debounceId = setTimeout(() => invalidate('app:inicio'), 250);
		};

		const canal = supabase
			.channel(`inicio-${hogarId}`)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'gastos_compartidos',
					filter: `hogar_id=eq.${hogarId}`
				},
				refrescar
			)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'gasto_divisiones' },
				refrescar
			)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'aportes' }, refrescar)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'pagos', filter: `hogar_id=eq.${hogarId}` },
				refrescar
			)
			.subscribe((status: string) => {
				if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
					console.warn('[realtime inicio] estado:', status);
				}
			});

		return () => {
			if (debounceId) clearTimeout(debounceId);
			supabase.removeChannel(canal);
		};
	});
</script>

<div class="flex flex-col px-5 py-6 md:px-8 lg:h-full lg:w-full lg:flex-1 lg:min-h-0">
	<header>
		<p class="text-xs text-muted">Hola, {data.perfil?.display_name || 'bienvenido'}</p>
		<p class="text-lg font-semibold text-text">{data.hogarActivo?.nombre}</p>
	</header>

	<!-- Tarjetas de resumen -->
	<section class="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3">
		<div
			class="col-span-2 rounded-card border border-border bg-surface p-5 shadow-card md:col-span-1"
		>
			<p class="text-sm text-muted">Tu saldo</p>
			<p class={'tabular mt-1 text-4xl font-bold ' + colorSaldo(resumen.saldoNeto)}>
				{resumen.saldoNeto < -0.01 ? '− ' : ''}{fmt(Math.abs(resumen.saldoNeto))}
			</p>
			<p class="mt-1 text-sm text-muted">
				{#if Math.abs(resumen.saldoNeto) <= 0.01}
					Estás en cero. Sin deudas pendientes.
				{:else if resumen.saldoNeto > 0}
					En total te deben.
				{:else}
					En total debes.
				{/if}
			</p>
		</div>

		<div class="rounded-card bg-money-favor-bg p-5">
			<p class="text-sm text-money-favor">Te deben</p>
			<p class="tabular mt-1 text-2xl font-semibold text-money-favor">{fmt(resumen.aFavor)}</p>
		</div>

		<div class="rounded-card bg-money-contra-bg p-5">
			<p class="text-sm text-money-contra">Debes</p>
			<p class="tabular mt-1 text-2xl font-semibold text-money-contra">{fmt(resumen.enContra)}</p>
		</div>
	</section>

	<!-- Pagos pendientes (confirmar / cancelar pagos genéricos) -->
	{#if pagosRecibir.length > 0 || pagosEnviados.length > 0}
		<section class="mt-6">
			<h2 class="text-sm font-semibold text-text">Pagos pendientes</h2>
			<ul class="mt-3 flex flex-col gap-2">
				{#each pagosRecibir as p (p.id)}
					<li
						class="flex items-center gap-3 rounded-card border border-border bg-surface p-3.5 shadow-card"
					>
						{#if p.pagadorAvatar}
							<img
								src={p.pagadorAvatar}
								alt=""
								referrerpolicy="no-referrer"
								class="size-10 shrink-0 rounded-full object-cover"
							/>
						{:else}
							<span
								class="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-700"
							>
								{iniciales(p.pagadorNombre)}
							</span>
						{/if}
						<div class="min-w-0 flex-1">
							<p class="text-sm font-medium text-text">
								{p.pagadorNombre} dice que te pagó
							</p>
							<p class="text-xs text-muted">
								{p.fechaTexto}{#if p.nota} · {p.nota}{/if}
							</p>
						</div>
						<span class="tabular shrink-0 text-sm font-semibold text-money-favor">
							+{p.montoTexto}
						</span>
						<form
							method="POST"
							action="?/confirmarPago"
							use:enhance={onEnhancePagoAccion(p.id)}
						>
							<input type="hidden" name="id" value={p.id} />
							<button
								type="submit"
								disabled={procesandoPago !== null}
								class="flex h-9 shrink-0 items-center justify-center gap-1 rounded-input bg-money-favor px-3 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
								aria-label="Confirmar pago"
							>
								<Check size={14} strokeWidth={3} />
								Confirmar
							</button>
						</form>
						<form
							method="POST"
							action="?/rechazarPago"
							use:enhance={onEnhancePagoAccion(p.id)}
						>
							<input type="hidden" name="id" value={p.id} />
							<button
								type="submit"
								disabled={procesandoPago !== null}
								class="flex size-9 shrink-0 items-center justify-center rounded-input text-muted transition-colors hover:bg-money-contra-bg hover:text-money-contra disabled:opacity-50"
								aria-label="Rechazar pago"
							>
								<X size={16} />
							</button>
						</form>
					</li>
				{/each}
				{#each pagosEnviados as p (p.id)}
					<li
						class="flex items-center gap-3 rounded-card border border-border bg-surface p-3.5 shadow-card"
					>
						{#if p.receptorAvatar}
							<img
								src={p.receptorAvatar}
								alt=""
								referrerpolicy="no-referrer"
								class="size-10 shrink-0 rounded-full object-cover"
							/>
						{:else}
							<span
								class="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-700"
							>
								{iniciales(p.receptorNombre)}
							</span>
						{/if}
						<div class="min-w-0 flex-1">
							<p class="text-sm font-medium text-text">
								Pago a {p.receptorNombre} esperando confirmación
							</p>
							<p class="text-xs text-muted">
								{p.fechaTexto}{#if p.nota} · {p.nota}{/if}
							</p>
						</div>
						<span class="tabular shrink-0 text-sm font-semibold text-text">{p.montoTexto}</span>
						<form
							method="POST"
							action="?/borrarPago"
							use:enhance={onEnhancePagoAccion(p.id)}
						>
							<input type="hidden" name="id" value={p.id} />
							<button
								type="submit"
								disabled={procesandoPago !== null}
								class="flex size-9 shrink-0 items-center justify-center rounded-input text-muted transition-colors hover:bg-money-contra-bg hover:text-money-contra disabled:opacity-50"
								aria-label="Cancelar pago"
							>
								<Trash2 size={15} />
							</button>
						</form>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!-- Lo que debés — una fila por gasto -->
	{#if filasLeDebo.length > 0}
		<section class="mt-6">
			<h2 class="text-sm font-semibold text-text">Debes</h2>
			<ul class="mt-3 flex flex-col gap-2">
				{#each filasLeDebo as f (f.divisionId)}
					{@const enAbonar = abonandoDivisionId === f.divisionId}
					{@const totalmenteCubierto =
						f.pendiente <= 0.01 && f.pendienteConfirmacion > 0.01}
					<li class="rounded-card border border-border bg-surface shadow-card">
						<div class="flex items-center gap-3 p-4">
							{#if f.otroAvatar}
								<img
									src={f.otroAvatar}
									alt=""
									referrerpolicy="no-referrer"
									class="size-10 shrink-0 rounded-full object-cover"
								/>
							{:else}
								<span
									class="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-700"
								>
									{iniciales(f.otroNombre)}
								</span>
							{/if}
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium text-text">{f.gastoTitulo}</p>
								<p class="truncate text-xs text-muted">
									a {f.otroNombre} · {f.fechaTexto}
								</p>
								{#if f.pendienteConfirmacion > 0.01}
									<p class="mt-0.5 text-xs text-warning">
										{f.pendienteConfirmacionTexto} esperando confirmación
									</p>
								{/if}
							</div>
							{#if totalmenteCubierto}
								<span class="tabular shrink-0 text-sm font-semibold text-warning">
									pendiente
								</span>
							{:else}
								<span class="tabular shrink-0 text-sm font-semibold text-money-contra">
									{f.pendienteTexto}
								</span>
								{#if !enAbonar}
									<button
										type="button"
										onclick={() => abrirAbonar(f)}
										disabled={procesando}
										class="flex h-9 shrink-0 items-center justify-center gap-1 rounded-input bg-brand-500 px-3 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
										aria-label="Abonar a {f.gastoTitulo}"
									>
										<HandCoins size={14} />
										Abonar
									</button>
								{/if}
							{/if}
						</div>

						{#if enAbonar}
							<form
								method="POST"
								action="?/registrarAporte"
								use:enhance={onEnhanceAbonar}
								class="space-y-3 border-t border-border bg-brand-50/40 px-4 py-3"
							>
								<input type="hidden" name="division_id" value={f.divisionId} />
								<div class="space-y-1.5">
									<label
										for="abono-monto-{f.divisionId}"
										class="block text-xs font-medium text-text"
									>
										Cuánto abonas
										<span class="font-normal text-muted">· te falta {f.pendienteTexto}</span>
									</label>
									<input
										id="abono-monto-{f.divisionId}"
										name="monto"
										type="number"
										required
										min="0.01"
										max={f.pendiente}
										step="any"
										inputmode="decimal"
										placeholder="0"
										disabled={procesando}
										bind:value={aporteMonto}
										class="tabular w-full rounded-input border border-transparent bg-surface px-3 py-2 text-sm text-text outline-none disabled:opacity-60"
									/>
								</div>

								{#if errorAbono}
									<p class="rounded-input bg-money-contra-bg px-3 py-2 text-xs text-money-contra">
										{errorAbono}
									</p>
								{/if}

								<div class="flex gap-2">
									<button
										type="button"
										onclick={cerrarAbonar}
										disabled={procesando}
										class="flex h-9 flex-1 items-center justify-center rounded-input border border-border bg-surface text-xs font-semibold text-text transition-colors hover:bg-bg disabled:opacity-50"
									>
										Cancelar
									</button>
									<button
										type="submit"
										disabled={procesando || !aporteMonto || aporteMonto <= 0}
										class="flex h-9 flex-[1.4] items-center justify-center gap-1.5 rounded-input bg-brand-500 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
									>
										<HandCoins size={14} />
										{procesando ? 'Registrando…' : 'Registrar abono'}
									</button>
								</div>
							</form>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!-- Lo que te deben — una fila por gasto -->
	{#if filasMeDeben.length > 0}
		<section class="mt-6">
			<h2 class="text-sm font-semibold text-text">Te deben</h2>
			<ul class="mt-3 flex flex-col gap-2">
				{#each filasMeDeben as f (f.divisionId)}
					<li class="rounded-card border border-border bg-surface shadow-card">
						<div class="flex items-center gap-3 p-4">
							{#if f.otroAvatar}
								<img
									src={f.otroAvatar}
									alt=""
									referrerpolicy="no-referrer"
									class="size-10 shrink-0 rounded-full object-cover"
								/>
							{:else}
								<span
									class="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-700"
								>
									{iniciales(f.otroNombre)}
								</span>
							{/if}
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium text-text">{f.gastoTitulo}</p>
								<p class="truncate text-xs text-muted">
									{f.otroNombre} · {f.fechaTexto}
								</p>
							</div>
							<span class="tabular shrink-0 text-sm font-semibold text-money-favor">
								{f.pendienteTexto}
							</span>
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!-- Estado cero: sin deudas en ninguna dirección -->
	{#if filasLeDebo.length === 0 && filasMeDeben.length === 0}
		<section class="mt-6 flex flex-col lg:min-h-0 lg:flex-1">
			<div
				class="flex flex-col items-center justify-center rounded-card border border-dashed border-border bg-surface px-6 py-14 text-center lg:flex-1 lg:min-h-0"
			>
				<span
					class="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-700"
				>
					<Users size={26} />
				</span>
				<p class="mt-4 font-medium text-text">Todo en cero</p>
				<p class="mt-1 max-w-sm text-sm text-muted">
					Cuando haya gastos pendientes donde alguien deba algo, aquí verás cada uno en su propia
					fila.
				</p>
				<a
					href="/gastos"
					class="mt-5 inline-flex items-center gap-1.5 rounded-input bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-brand-700"
				>
					<Receipt size={16} />
					Ir a Gastos
				</a>
			</div>
		</section>
	{/if}
</div>
