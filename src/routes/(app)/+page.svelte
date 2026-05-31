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
	const signo = (n: number) => (n > 0.01 ? '+ ' : n < -0.01 ? '− ' : '');

	// === Modal "Registrar pago" =============================================
	// Se abre con un click en "Saldar X" en una fila de persona en la lista.
	// Pre-llena el monto al saldo absoluto que le debo (atajo "saldar todo").
	let modalAbierto = $state(false);
	let receptor = $state<{ id: string; nombre: string; avatar: string | null } | null>(null);
	let pagoMonto = $state<number | null>(null);
	let pagoNota = $state('');
	let procesando = $state(false);
	let errorPago = $state<string | null>(null);

	function abrirSaldar(p: { id: string; nombre: string; avatar: string | null; saldo: number }) {
		receptor = { id: p.id, nombre: p.nombre, avatar: p.avatar };
		pagoMonto = Math.abs(p.saldo); // atajo: saldar todo
		pagoNota = '';
		errorPago = null;
		modalAbierto = true;
	}
	function cerrarModal() {
		if (procesando) return;
		modalAbierto = false;
		receptor = null;
	}

	function onEnhanceRegistrar({ cancel }: { cancel: () => void }) {
		if (procesando) {
			cancel();
			return;
		}
		procesando = true;
		errorPago = null;
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
					modalAbierto = false;
					receptor = null;
				} else {
					errorPago = result.data?.error || 'No se pudo registrar el pago.';
				}
			} finally {
				procesando = false;
			}
		};
	}

	// Handler genérico para las acciones de un pago pendiente (confirmar /
	// rechazar / borrar). Mientras la acción está en vuelo, bloqueamos todo.
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
				{signo(resumen.saldoNeto)}{fmt(Math.abs(resumen.saldoNeto))}
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

	<!-- Pagos pendientes (donde tengo que confirmar / cancelar) -->
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

	<!-- Por persona -->
	<section class="mt-6 flex flex-col lg:min-h-0 lg:flex-1">
		<h2 class="text-sm font-semibold text-text">Por persona</h2>
		{#if resumen.personas.length === 0}
			<div
				class="mt-3 flex flex-col items-center justify-center rounded-card border border-dashed border-border bg-surface px-6 py-14 text-center lg:flex-1 lg:min-h-0"
			>
				<span
					class="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-700"
				>
					<Users size={26} />
				</span>
				<p class="mt-4 font-medium text-text">Todo en cero</p>
				<p class="mt-1 max-w-sm text-sm text-muted">
					Cuando haya gastos pendientes donde alguien deba algo, aquí verás cuánto te deben y a
					quién le debes, ya neteado por persona.
				</p>
				<a
					href="/gastos"
					class="mt-5 inline-flex items-center gap-1.5 rounded-input bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-brand-700"
				>
					<Receipt size={16} />
					Ir a Gastos
				</a>
			</div>
		{:else}
			<ul class="mt-3 grid gap-2 sm:grid-cols-2">
				{#each resumen.personas as p (p.id)}
					<li
						class="flex items-center gap-3 rounded-card border border-border bg-surface p-4 shadow-card"
					>
						{#if p.avatar}
							<img
								src={p.avatar}
								alt=""
								referrerpolicy="no-referrer"
								class="size-10 shrink-0 rounded-full object-cover"
							/>
						{:else}
							<span
								class="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-700"
							>
								{iniciales(p.nombre)}
							</span>
						{/if}
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium text-text">{p.nombre}</p>
							<p class={'text-xs ' + (p.saldo > 0 ? 'text-money-favor' : 'text-money-contra')}>
								{p.saldo > 0 ? 'Te debe' : 'Le debes'}
							</p>
						</div>
						<span class={'tabular shrink-0 font-semibold ' + colorSaldo(p.saldo)}>
							{signo(p.saldo)}{fmt(Math.abs(p.saldo))}
						</span>
						{#if p.saldo < -0.01}
							<button
								type="button"
								onclick={() => abrirSaldar(p)}
								class="flex h-9 shrink-0 items-center justify-center gap-1 rounded-input bg-brand-500 px-3 text-xs font-semibold text-white transition-colors hover:bg-brand-700"
								aria-label="Saldar deuda con {p.nombre}"
							>
								<HandCoins size={14} />
								Saldar
							</button>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

<!-- Modal: registrar un pago saliente -->
{#if modalAbierto && receptor}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-text/60 p-4"
		role="dialog"
		aria-modal="true"
		aria-label="Registrar pago"
	>
		<button
			type="button"
			class="absolute inset-0 cursor-default"
			onclick={cerrarModal}
			aria-label="Cerrar"
		></button>
		<div class="animate-fade-in relative w-full max-w-md rounded-modal bg-surface shadow-2xl">
			<header class="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
				<div class="min-w-0">
					<h2 class="text-base font-bold text-text">Registrar pago</h2>
					<p class="mt-0.5 text-xs text-muted">
						A {receptor.nombre}. Quedará pendiente hasta que confirme.
					</p>
				</div>
				<button
					type="button"
					onclick={cerrarModal}
					disabled={procesando}
					class="flex size-8 shrink-0 items-center justify-center rounded-input text-muted transition-colors hover:bg-bg hover:text-text disabled:opacity-50"
					aria-label="Cerrar"
				>
					<X size={18} />
				</button>
			</header>

			<form method="POST" action="?/registrarPago" use:enhance={onEnhanceRegistrar} class="space-y-4 px-6 py-5">
				<input type="hidden" name="receptor_id" value={receptor.id} />

				<div class="space-y-1.5">
					<label for="pago-monto" class="block text-sm font-medium text-text">Monto</label>
					<input
						id="pago-monto"
						name="monto"
						type="number"
						required
						min="0.01"
						step="any"
						inputmode="decimal"
						placeholder="0"
						disabled={procesando}
						bind:value={pagoMonto}
						class="tabular w-full rounded-input border border-transparent bg-brand-50 px-3 py-2.5 text-text outline-none placeholder:text-muted/70 disabled:opacity-60"
					/>
				</div>

				<div class="space-y-1.5">
					<label for="pago-nota" class="block text-sm font-medium text-text">
						Nota <span class="font-normal text-muted">(opcional)</span>
					</label>
					<input
						id="pago-nota"
						name="nota"
						type="text"
						maxlength="120"
						placeholder="Transferencia, efectivo…"
						disabled={procesando}
						bind:value={pagoNota}
						class="w-full rounded-input border border-transparent bg-brand-50 px-3 py-2.5 text-text outline-none placeholder:text-muted/70 disabled:opacity-60"
					/>
				</div>

				{#if errorPago}
					<p class="rounded-input bg-money-contra-bg px-3 py-2 text-sm text-money-contra">
						{errorPago}
					</p>
				{/if}

				<div class="flex gap-2 pt-1">
					<button
						type="button"
						onclick={cerrarModal}
						disabled={procesando}
						class="flex h-11 flex-1 items-center justify-center rounded-input border border-border bg-surface text-sm font-semibold text-text transition-colors hover:bg-bg disabled:opacity-50"
					>
						Cancelar
					</button>
					<button
						type="submit"
						disabled={procesando || !pagoMonto || pagoMonto <= 0}
						class="flex h-11 flex-[1.4] items-center justify-center gap-2 rounded-input bg-brand-500 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
					>
						<HandCoins size={16} />
						{procesando ? 'Registrando…' : 'Registrar pago'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
