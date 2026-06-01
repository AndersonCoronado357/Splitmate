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

	// Filtro de la lista: arranco viendo lo que DEBO (lo más urgente).
	type Filtro = 'debes' | 'te_deben' | 'todas';
	let filtro = $state<Filtro>('debes');
	const verDebes = $derived(filtro === 'debes' || filtro === 'todas');
	const verTeDeben = $derived(filtro === 'te_deben' || filtro === 'todas');
	const tabs = $derived([
		{ id: 'debes' as const, label: 'Debes', count: filasLeDebo.length },
		{ id: 'te_deben' as const, label: 'Te deben', count: filasMeDeben.length },
		{ id: 'todas' as const, label: 'Todas', count: filasLeDebo.length + filasMeDeben.length }
	]);

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

	<!-- Tabs de filtro: empieza en "Debes" porque suele ser lo más urgente. -->
	{#if filasLeDebo.length > 0 || filasMeDeben.length > 0}
		<section class="mt-6 flex flex-col lg:min-h-0 lg:flex-1">
			<div class="flex gap-2" role="tablist" aria-label="Filtro de deudas">
				{#each tabs as t (t.id)}
					{@const activo = filtro === t.id}
					<button
						type="button"
						role="tab"
						aria-selected={activo}
						onclick={() => (filtro = t.id)}
						class={'flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold shadow-card transition-colors ' +
							(activo
								? 'bg-brand-50 text-brand-700'
								: 'bg-surface text-muted hover:bg-bg hover:text-text')}
					>
						<span>{t.label}</span>
						<span
							class={'tabular text-[10px] ' + (activo ? 'text-brand-700' : 'text-muted')}
						>
							{t.count}
						</span>
					</button>
				{/each}
			</div>
			<div class="mt-4 flex flex-col gap-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
				<!-- Sección "Debes" -->
				{#if verDebes && filasLeDebo.length > 0}
					<div>
						{#if filtro === 'todas'}
							<h3 class="text-sm font-semibold text-money-contra">Debes</h3>
						{/if}
						<ul class={'flex flex-col gap-2 ' + (filtro === 'todas' ? 'mt-3' : '')}>
							{#each filasLeDebo as f (f.divisionId)}
								{@const totalmenteCubierto =
									f.pendiente <= 0.01 && f.pendienteConfirmacion > 0.01}
								<li>
									<a
										href={`/gastos/${f.gastoId}`}
										class="flex items-center gap-3 rounded-card border border-border bg-surface p-4 shadow-card transition-colors hover:bg-bg"
									>
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
										{/if}
									</a>
								</li>
							{/each}
						</ul>
					</div>
				{/if}

				<!-- Sección "Te deben" -->
				{#if verTeDeben && filasMeDeben.length > 0}
					<div>
						{#if filtro === 'todas'}
							<h3 class="text-sm font-semibold text-money-favor">Te deben</h3>
						{/if}
						<ul class={'flex flex-col gap-2 ' + (filtro === 'todas' ? 'mt-3' : '')}>
							{#each filasMeDeben as f (f.divisionId)}
								<li>
									<a
										href={`/gastos/${f.gastoId}`}
										class="flex items-center gap-3 rounded-card border border-border bg-surface p-4 shadow-card transition-colors hover:bg-bg"
									>
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
									</a>
								</li>
							{/each}
						</ul>
					</div>
				{/if}

				<!-- Si el filtro activo deja la lista vacía pero hay datos en otro tab -->
				{#if (filtro === 'debes' && filasLeDebo.length === 0 && filasMeDeben.length > 0) || (filtro === 'te_deben' && filasMeDeben.length === 0 && filasLeDebo.length > 0)}
					<div
						class="flex flex-col items-center justify-center rounded-card border border-dashed border-border bg-surface px-6 py-10 text-center"
					>
						<p class="text-sm text-muted">
							{filtro === 'debes'
								? 'No debes nada por ahora.'
								: 'Nadie te debe nada por ahora.'}
						</p>
						<button
							type="button"
							onclick={() => (filtro = 'todas')}
							class="mt-3 text-xs font-semibold text-brand-700 hover:underline"
						>
							Ver todas
						</button>
					</div>
				{/if}
			</div>
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
