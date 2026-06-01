<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { goto, invalidate } from '$app/navigation';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Check from '@lucide/svelte/icons/check';
	import X from '@lucide/svelte/icons/x';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Calendar from '@lucide/svelte/icons/calendar';
	import StickyNote from '@lucide/svelte/icons/sticky-note';
	import User from '@lucide/svelte/icons/user';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import History from '@lucide/svelte/icons/history';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Coins from '@lucide/svelte/icons/coins';
	import Clock from '@lucide/svelte/icons/clock';
	import HandCoins from '@lucide/svelte/icons/hand-coins';
	import { TIPO_PAGO_LABEL } from '$lib/prestamos-tipos';
	import MoneyInput from '$lib/components/MoneyInput.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const p = $derived(data.prestamo);

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

	const MESES = [
		'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
		'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
	];
	function fmtFechaLarga(iso: string) {
		if (!iso) return '';
		const [y, m, d] = iso.split('-').map(Number);
		return `${d} de ${MESES[(m || 1) - 1]} de ${y}`;
	}

	function diasEntre(isoA: string, isoB: string): number {
		const [ay, am, ad] = isoA.split('-').map(Number);
		const [by, bm, bd] = isoB.split('-').map(Number);
		const a = Date.UTC(ay, am - 1, ad);
		const b = Date.UTC(by, bm - 1, bd);
		return Math.round((b - a) / (1000 * 60 * 60 * 24));
	}

	let hoyIso = $state('');
	let diasHasta = $state<number | null>(null);
	$effect(() => {
		const t = new Date();
		hoyIso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
		diasHasta = p.fechaEsperada ? diasEntre(hoyIso, p.fechaEsperada) : null;
	});

	const confirmadoFecha = $derived(
		p.confirmadoAt ? p.confirmadoAt.slice(0, 10) : null
	);

	let devolucionMonto = $state<number | null>(null);
	let errorDevolucion = $state<string | null>(null);
	let procesando = $state(false);

	$effect(() => {
		if (
			devolucionMonto !== null &&
			p.pendiente > 0 &&
			devolucionMonto > p.pendiente
		) {
			devolucionMonto = p.pendiente;
		}
	});

	const puedeDevolver = $derived(
		p.soyReceptor && p.estado === 'activo' && p.pendiente > 0.01
	);

	function onEnhanceDevolver({ cancel }: { cancel: () => void }) {
		if (procesando) {
			cancel();
			return;
		}
		procesando = true;
		errorDevolucion = null;
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
					devolucionMonto = null;
				} else {
					errorDevolucion = result.data?.error || 'No se pudo registrar la devolución.';
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
			result: { type: string; data?: { error?: string } };
			update: (opts?: { invalidateAll?: boolean }) => Promise<void>;
		}) => {
			try {
				if (result.type === 'success') {
					await update({ invalidateAll: false });
					await invalidate('app:prestamos');
				}
			} finally {
				procesando = false;
			}
		};
	}

	function onEnhanceBorrar({ cancel }: { cancel: () => void }) {
		if (procesando) {
			cancel();
			return;
		}
		procesando = true;
		return async ({
			result
		}: {
			result: { type: string; data?: { error?: string } };
		}) => {
			try {
				if (result.type === 'success') {
					await invalidate('app:prestamos');
					await goto('/prestamos');
				}
			} finally {
				procesando = false;
			}
		};
	}

	let confirmarBorrar = $state(false);

	const ESTADO_LABEL: Record<string, string> = {
		pendiente: 'Pendiente',
		activo: 'Activo',
		saldado: 'Pagado',
		rechazado: 'Rechazado'
	};
	const ESTADO_COLOR: Record<string, string> = {
		pendiente: 'bg-warning/15 text-warning',
		activo: 'bg-brand-50 text-brand-700',
		saldado: 'bg-money-favor-bg text-money-favor',
		rechazado: 'bg-money-contra-bg text-money-contra'
	};

	const labelClass =
		'flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted uppercase';

	const pct = $derived(
		p.estado === 'saldado'
			? 100
			: p.estado === 'pendiente' || p.estado === 'rechazado'
				? 0
				: p.monto > 0
					? Math.min(100, Math.round((p.pagado / p.monto) * 100))
					: 0
	);

	const confirmadas = $derived(p.devoluciones.filter((d) => d.estado === 'confirmado'));
	const esperando = $derived(p.devoluciones.filter((d) => d.estado === 'pendiente'));
	const totalConfirmado = $derived(confirmadas.reduce((acc, d) => acc + d.monto, 0));
	const totalEsperando = $derived(esperando.reduce((acc, d) => acc + d.monto, 0));

	type Evento = {
		key: string;
		tipo:
			| 'creado'
			| 'confirmado'
			| 'rechazado'
			| 'devolucion-confirmada'
			| 'devolucion-pendiente'
			| 'devolucion-rechazada'
			| 'saldado';
		titulo: string;
		fechaTexto: string;
		montoTexto?: string;
		devolucionId?: string;
	};

	const eventos = $derived.by<Evento[]>(() => {
		const out: Evento[] = [];
		out.push({
			key: 'creado',
			tipo: 'creado',
			titulo: p.soyPrestador
				? `Le prestaste a ${p.receptorNombre}`
				: `${p.prestadorNombre} te prestó`,
			fechaTexto: fmtFechaLarga(p.fecha),
			montoTexto: p.montoTexto
		});
		if (p.estado === 'rechazado') {
			out.push({
				key: 'rechazado',
				tipo: 'rechazado',
				titulo: `Préstamo rechazado por ${p.soyReceptor ? 'ti' : p.receptorNombre}`,
				fechaTexto: confirmadoFecha ? fmtFechaLarga(confirmadoFecha) : ''
			});
		} else if (confirmadoFecha) {
			out.push({
				key: 'confirmado',
				tipo: 'confirmado',
				titulo: `Préstamo confirmado por ${p.soyReceptor ? 'ti' : p.receptorNombre}`,
				fechaTexto: fmtFechaLarga(confirmadoFecha)
			});
		}
		const devs = p.devoluciones.slice().reverse();
		for (const d of devs) {
			// El prestador es el único que puede confirmar/rechazar. El receptor
			// es quien registra la devolución. Lo escribimos explícitamente para
			// que el usuario sepa quién hizo qué.
			const tituloConfirmada = `Devolución confirmada por ${p.soyPrestador ? 'ti' : p.prestadorNombre}`;
			const tituloRechazada = `Devolución rechazada por ${p.soyPrestador ? 'ti' : p.prestadorNombre}`;
			const tituloPendiente = `${p.soyReceptor ? 'Registraste' : `${p.receptorNombre} registró`} una devolución`;
			out.push({
				key: `dev-${d.id}`,
				tipo:
					d.estado === 'confirmado'
						? 'devolucion-confirmada'
						: d.estado === 'rechazado'
							? 'devolucion-rechazada'
							: 'devolucion-pendiente',
				titulo:
					d.estado === 'confirmado'
						? tituloConfirmada
						: d.estado === 'rechazado'
							? tituloRechazada
							: tituloPendiente,
				fechaTexto: d.fechaTexto,
				montoTexto: d.montoTexto,
				devolucionId: d.id
			});
		}
		if (p.estado === 'saldado') {
			out.push({
				key: 'saldado',
				tipo: 'saldado',
				titulo: 'Préstamo pagado',
				fechaTexto: ''
			});
		}
		return out;
	});

	function eventoColor(tipo: Evento['tipo']) {
		switch (tipo) {
			case 'creado':
				return 'bg-brand-50 text-brand-700';
			case 'confirmado':
			case 'devolucion-confirmada':
			case 'saldado':
				return 'bg-money-favor-bg text-money-favor';
			case 'rechazado':
			case 'devolucion-rechazada':
				return 'bg-money-contra-bg text-money-contra';
			case 'devolucion-pendiente':
				return 'bg-warning/15 text-warning';
		}
	}
</script>

<div class="flex flex-col px-5 py-6 md:px-8 lg:h-full lg:w-full lg:flex-1 lg:min-h-0">
	<a
		href="/prestamos"
		class="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-text"
	>
		<ArrowLeft size={16} />
		Volver
	</a>

	<div class="mt-4 flex flex-1 flex-col gap-5 lg:min-h-0">
		<!-- ===== HEADER CARD: badge arriba, texto izquierda, avatares derecha. ===== -->
		<section class="rounded-card border border-border bg-surface p-6 shadow-card">
			<!-- Tira superior: chip de estado + acciones contextuales todas en la
			     MISMA fila (confirmar/rechazar/cancelar, según corresponda). -->
			<div class="flex flex-wrap items-center justify-between gap-2">
				<span
					class={'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ' +
						ESTADO_COLOR[p.estado]}
				>
					{ESTADO_LABEL[p.estado]}
				</span>
				<div class="flex items-center gap-2">
					{#if p.soyReceptor && p.estado === 'pendiente'}
						<form method="POST" action="?/rechazar" use:enhance={onEnhanceAccion}>
							<input type="hidden" name="id" value={p.id} />
							<button
								type="submit"
								disabled={procesando}
								class="flex h-8 items-center justify-center gap-1 rounded-input border border-border bg-surface px-2.5 text-xs font-semibold text-text transition-colors hover:bg-bg disabled:opacity-50"
							>
								<X size={14} />
								Rechazar
							</button>
						</form>
						<form method="POST" action="?/confirmar" use:enhance={onEnhanceAccion}>
							<input type="hidden" name="id" value={p.id} />
							<button
								type="submit"
								disabled={procesando}
								class="flex h-8 items-center justify-center gap-1 rounded-input bg-money-favor px-2.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
							>
								<Check size={14} strokeWidth={3} />
								Confirmar
							</button>
						</form>
					{/if}
					{#if p.soyPrestador && p.estado === 'pendiente' && !confirmarBorrar}
						<button
							type="button"
							onclick={() => (confirmarBorrar = true)}
							disabled={procesando}
							class="flex size-8 items-center justify-center rounded-input text-muted transition-colors hover:bg-money-contra-bg hover:text-money-contra disabled:opacity-40"
							aria-label="Cancelar préstamo"
						>
							<Trash2 size={16} />
						</button>
					{/if}
				</div>
			</div>

			<div class="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start">
				<div class="min-w-0 flex-1">
					<h1 class="text-xl font-bold text-text">
						{#if p.soyPrestador}
							Le prestaste a {p.receptorNombre}
						{:else if p.soyReceptor}
							{p.prestadorNombre} te prestó
						{:else}
							{p.prestadorNombre} → {p.receptorNombre}
						{/if}
					</h1>
					<p class="tabular mt-1 text-4xl font-bold text-text">{p.montoTexto}</p>
					<p class="mt-2 text-xs text-muted">
						{p.pagadoTexto} devuelto · {pct}% · faltan {p.pendienteTexto}
					</p>
				</div>
				<!-- En móvil los avatares VAN DEBAJO del texto (flex-col); en desktop
				     pasan al lado derecho (sm:flex-row del padre). -->
				<div class="flex shrink-0 items-start gap-3 sm:gap-5">
					<div class="flex w-20 flex-col items-center gap-1.5 text-center sm:w-32 sm:gap-2">
						{#if p.prestadorAvatar}
							<img
								src={p.prestadorAvatar}
								alt=""
								referrerpolicy="no-referrer"
								class="size-16 rounded-full object-cover sm:size-24"
							/>
						{:else}
							<span
								class="grid size-16 place-items-center rounded-full bg-brand-50 text-lg font-bold text-brand-700 sm:size-24 sm:text-2xl"
							>
								{iniciales(p.prestadorNombre)}
							</span>
						{/if}
						<span class="text-[10px] font-semibold tracking-wide text-muted uppercase">
							Prestador
						</span>
						<span class="text-xs font-medium leading-tight text-text break-words sm:text-sm">
							{p.soyPrestador ? 'Tú' : p.prestadorNombre}
						</span>
					</div>
					<ArrowRight size={20} class="mt-6 shrink-0 text-muted sm:mt-9" />
					<div class="flex w-20 flex-col items-center gap-1.5 text-center sm:w-32 sm:gap-2">
						{#if p.receptorAvatar}
							<img
								src={p.receptorAvatar}
								alt=""
								referrerpolicy="no-referrer"
								class="size-16 rounded-full object-cover sm:size-24"
							/>
						{:else}
							<span
								class="grid size-16 place-items-center rounded-full bg-brand-50 text-lg font-bold text-brand-700 sm:size-24 sm:text-2xl"
							>
								{iniciales(p.receptorNombre)}
							</span>
						{/if}
						<span class="text-[10px] font-semibold tracking-wide text-muted uppercase">
							Receptor
						</span>
						<span class="text-xs font-medium leading-tight text-text break-words sm:text-sm">
							{p.soyReceptor ? 'Tú' : p.receptorNombre}
						</span>
					</div>
				</div>
			</div>

			{#if confirmarBorrar}
				<div class="mt-4 rounded-input bg-money-contra-bg p-3">
					<p class="text-sm font-medium text-text">¿Cancelar este préstamo?</p>
					<p class="mt-1 text-xs text-muted">
						Se borra del historial y la otra persona deja de verlo.
					</p>
					<div class="mt-2.5 flex gap-2">
						<form
							method="POST"
							action="?/borrar"
							class="flex-1"
							use:enhance={onEnhanceBorrar}
						>
							<input type="hidden" name="id" value={p.id} />
							<button
								type="submit"
								disabled={procesando}
								class="w-full rounded-input bg-money-contra px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
							>
								{procesando ? 'Borrando…' : 'Sí, cancelar'}
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

		<!-- ===== Cuerpo en 2 columnas (mismo grid que GastoDetalle) ===== -->
		<div class="grid flex-1 gap-5 lg:grid-cols-2 lg:gap-6 lg:min-h-0">
			<!-- COLUMNA IZQUIERDA -->
			<div class="flex flex-col gap-5 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
				<!-- Detalles -->
				<section>
					<p class={labelClass}>Detalles</p>
					<div class="mt-2 divide-y divide-border rounded-card bg-surface shadow-card">
						<!-- Datos del préstamo (sin las 3 stats — esas viven en el header sub-info). -->
						<div class="flex items-center gap-3 px-4 py-3">
							<span class="grid size-9 shrink-0 place-items-center rounded-input bg-brand-50 text-brand-700">
								<Calendar size={17} />
							</span>
							<div class="min-w-0 flex-1">
								<p class="text-xs text-muted">Fecha del préstamo</p>
								<p class="text-sm font-medium text-text capitalize">{fmtFechaLarga(p.fecha)}</p>
							</div>
						</div>
						{#if confirmadoFecha}
							<div class="flex items-center gap-3 px-4 py-3">
								<span class="grid size-9 shrink-0 place-items-center rounded-input bg-money-favor-bg text-money-favor">
									<Check size={17} strokeWidth={3} />
								</span>
								<div class="min-w-0 flex-1">
									<p class="text-xs text-muted">Confirmado el</p>
									<p class="text-sm font-medium text-text capitalize">
										{fmtFechaLarga(confirmadoFecha)}
									</p>
								</div>
							</div>
						{/if}
						{#if p.fechaEsperada}
							<div class="flex items-center gap-3 px-4 py-3">
								<span class="grid size-9 shrink-0 place-items-center rounded-input bg-brand-50 text-brand-700">
									<Clock size={17} />
								</span>
								<div class="min-w-0 flex-1">
									<p class="text-xs text-muted">Devolución esperada</p>
									<p class="text-sm font-medium text-text capitalize">
										{fmtFechaLarga(p.fechaEsperada)}
									</p>
									{#if diasHasta !== null}
										<p
											class={'mt-0.5 text-xs ' +
												(diasHasta < 0 ? 'text-money-contra' : 'text-muted')}
										>
											{diasHasta < 0
												? `vencido hace ${Math.abs(diasHasta)} d`
												: diasHasta === 0
													? 'vence hoy'
													: `quedan ${diasHasta} d`}
										</p>
									{/if}
								</div>
							</div>
						{/if}
						<div class="flex items-center gap-3 px-4 py-3">
							<span class="grid size-9 shrink-0 place-items-center rounded-input bg-brand-50 text-brand-700">
								<Coins size={17} />
							</span>
							<div class="min-w-0 flex-1">
								<p class="text-xs text-muted">Modo de devolución</p>
								<p class="text-sm font-medium text-text">{TIPO_PAGO_LABEL[p.tipoPago]}</p>
							</div>
						</div>
						{#if p.motivo}
							<div class="flex items-center gap-3 px-4 py-3">
								<span class="grid size-9 shrink-0 place-items-center rounded-input bg-brand-50 text-brand-700">
									<StickyNote size={17} />
								</span>
								<div class="min-w-0 flex-1">
									<p class="text-xs text-muted">Motivo</p>
									<p class="text-sm font-medium text-text whitespace-pre-line">{p.motivo}</p>
								</div>
							</div>
						{/if}
					</div>
				</section>

				<!-- Plan de cuotas — mismo estilo que la sección "Cómo va cada uno" de gastos.
				     Si no hay cuotas, mostramos un empty state que ocupa el alto
				     disponible para que la columna no quede con un hueco enorme. -->
				<section class="flex flex-col lg:min-h-0 lg:flex-1">
					<div class="flex items-end justify-between">
						<p class={labelClass}>
							<Coins size={13} class="text-brand-500" />
							Plan de cuotas
						</p>
						{#if p.cuotas.length > 0}
							<p class="tabular text-xs text-muted">
								{fmt(totalConfirmado)} cobrado{#if totalEsperando > 0.01} · {fmt(totalEsperando)} por confirmar{/if}
							</p>
						{/if}
					</div>
					{#if p.cuotas.length > 0}
						<!-- Lista de cuotas: llena el alto disponible y hace scroll interno
						     si hay muchas. Así el contenedor de la columna izquierda
						     no se estira para acomodar 24 cuotas. -->
						<ul
							class="mt-2 flex flex-col overflow-hidden rounded-card bg-surface shadow-card lg:flex-1 lg:overflow-y-auto"
						>
							{#each p.cuotas as c, i (c.id)}
								<li
									class="flex shrink-0 items-center gap-3 px-4 py-3"
									class:border-t={i > 0}
									class:border-border={i > 0}
								>
									<span class="grid size-9 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">
										{c.numero}
									</span>
									<div class="min-w-0 flex-1">
										<p class="text-sm font-medium text-text">Cuota {c.numero}</p>
										{#if c.fechaEsperadaTexto}
											<p class="text-xs text-muted">{c.fechaEsperadaTexto}</p>
										{/if}
									</div>
									<span class="tabular shrink-0 text-sm font-semibold text-text">
										{c.montoTexto}
									</span>
								</li>
							{/each}
						</ul>
					{:else}
						<div
							class="mt-2 flex flex-col items-center justify-center rounded-card border border-dashed border-border bg-surface p-8 text-center lg:min-h-0 lg:flex-1"
						>
							<p class="text-sm text-muted">Este préstamo se devuelve sin cuotas fijas.</p>
						</div>
					{/if}
				</section>
			</div>

			<!-- COLUMNA DERECHA -->
			<div class="flex flex-col gap-5 lg:min-h-0">
				<!-- Form de devolución (mismo estilo que "Registrar mi pago" de gastos) -->
				{#if puedeDevolver}
					<section>
						<p class={labelClass}>
							<HandCoins size={13} class="text-brand-500" />
							Registrar devolución
						</p>
						<div class="mt-2 rounded-card border border-border bg-surface p-5 shadow-card">
							<form
								method="POST"
								action="?/devolver"
								use:enhance={onEnhanceDevolver}
								class="flex flex-col gap-3 sm:flex-row sm:items-end"
							>
								<input type="hidden" name="prestamo_id" value={p.id} />
							<input type="hidden" name="fecha" value={hoyIso} />
								<div class="flex-1 space-y-1.5">
									<label for="dev-monto" class="block text-sm font-medium text-text">
										Cuánto devuelves
										<span class="font-normal text-muted">· te falta {p.pendienteTexto}</span>
									</label>
									<MoneyInput
										id="dev-monto"
										name="monto"
										required
										max={p.pendiente}
										disabled={procesando}
										bind:value={devolucionMonto}
										class="w-full rounded-input border border-transparent bg-brand-50 px-3 py-2.5 text-text outline-none placeholder:text-muted/70 disabled:opacity-60"
									/>
								</div>
								<button
									type="submit"
									disabled={procesando || !devolucionMonto || devolucionMonto <= 0}
									class="flex h-11 shrink-0 items-center justify-center gap-2 rounded-input bg-brand-500 px-5 font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
								>
									<ArrowRight size={16} />
									{procesando ? 'Guardando…' : 'Registrar'}
								</button>
							</form>
							{#if errorDevolucion}
								<p class="mt-3 rounded-input bg-money-contra-bg px-3 py-2 text-sm text-money-contra">
									{errorDevolucion}
								</p>
							{/if}
						</div>
					</section>
				{/if}

				<!-- Historial timeline -->
				<section class="flex flex-col lg:min-h-0 lg:flex-1">
					<div class="flex items-end justify-between">
						<p class={labelClass}>
							<History size={13} class="text-brand-500" />
							Historial
						</p>
						<p class="tabular text-xs text-muted">
							{eventos.length}
							{eventos.length === 1 ? 'evento' : 'eventos'}
						</p>
					</div>
					<div class="mt-2 flex flex-1 flex-col overflow-hidden rounded-card bg-surface shadow-card lg:min-h-0">
						<ol class="relative flex-1 overflow-y-auto px-5 py-5">
							{#each eventos as ev, i (ev.key)}
								{@const ultimo = i === eventos.length - 1}
								<li class="relative flex gap-4 pb-5 last:pb-0">
									{#if !ultimo}
										<span
											aria-hidden="true"
											class="absolute top-9 bottom-0 left-3.5 w-px bg-border"
										></span>
									{/if}
									<span
										class={'relative z-10 grid size-7 shrink-0 place-items-center rounded-full ' +
											eventoColor(ev.tipo)}
									>
										{#if ev.tipo === 'creado'}
											<HandCoins size={14} />
										{:else if ev.tipo === 'confirmado'}
											<Check size={14} strokeWidth={3} />
										{:else if ev.tipo === 'rechazado' || ev.tipo === 'devolucion-rechazada'}
											<X size={14} />
										{:else if ev.tipo === 'devolucion-confirmada'}
											<Check size={14} strokeWidth={3} />
										{:else if ev.tipo === 'devolucion-pendiente'}
											<Clock size={14} />
										{:else if ev.tipo === 'saldado'}
											<CircleCheck size={14} />
										{/if}
									</span>
									<div class="min-w-0 flex-1">
										<div class="flex items-start justify-between gap-3">
											<div class="min-w-0 flex-1">
												<p class="text-sm font-medium text-text">{ev.titulo}</p>
												{#if ev.fechaTexto}
													<p class="mt-0.5 text-xs text-muted capitalize">
														{ev.fechaTexto}
													</p>
												{/if}
											</div>
											<!-- Botones de confirmar/rechazar (si aplica) y monto, todo en
											     la misma línea a la derecha del título. -->
											<div class="flex shrink-0 items-center gap-1.5">
												{#if ev.tipo === 'devolucion-pendiente' && p.soyPrestador && ev.devolucionId}
													<form
														method="POST"
														action="?/confirmarDevolucion"
														use:enhance={onEnhanceAccion}
													>
														<input type="hidden" name="id" value={ev.devolucionId} />
														<button
															type="submit"
															disabled={procesando}
															class="flex size-6 items-center justify-center rounded-input bg-money-favor-bg text-money-favor transition-colors hover:bg-money-favor hover:text-white disabled:opacity-50"
															aria-label="Confirmar devolución"
														>
															<Check size={12} strokeWidth={3} />
														</button>
													</form>
													<form
														method="POST"
														action="?/rechazarDevolucion"
														use:enhance={onEnhanceAccion}
													>
														<input type="hidden" name="id" value={ev.devolucionId} />
														<button
															type="submit"
															disabled={procesando}
															class="flex size-6 items-center justify-center rounded-input bg-money-contra-bg text-money-contra transition-colors hover:bg-money-contra hover:text-white disabled:opacity-50"
															aria-label="Rechazar devolución"
														>
															<X size={12} />
														</button>
													</form>
												{/if}
												{#if ev.montoTexto}
													<span
														class={'tabular text-sm font-semibold ' +
															(ev.tipo === 'devolucion-pendiente'
																? 'text-warning'
																: ev.tipo === 'devolucion-rechazada'
																	? 'text-muted line-through'
																	: ev.tipo === 'devolucion-confirmada'
																		? 'text-money-favor'
																		: 'text-text')}
													>
														{ev.montoTexto}
													</span>
												{/if}
											</div>
										</div>
									</div>
								</li>
							{/each}
						</ol>
					</div>
				</section>
			</div>
		</div>
	</div>
</div>
