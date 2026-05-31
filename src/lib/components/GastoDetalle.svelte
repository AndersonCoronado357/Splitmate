<!--
	Detalle de un gasto. Se usa en dos contextos:
	 1. /gastos/[id]/+page.svelte → vista directa (deep link)
	 2. /gastos/+page.svelte → modal/panel sin cambio de URL

	Todas las acciones (aportar / borrarAporte / borrar) se postean al endpoint
	estable /gastos/{gastoId}?/<action> usando `action={...}` absoluta, así
	funcionan igual estés en la página directa o en el modal.

	Optimistic UI:
	 - aporte registrado aparece al instante con id temporal
	 - aporte borrado desaparece al instante
	 - gasto borrado: callback `onGastoBorrado` para que el padre lo quite del
	   listado optimísticamente
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import { iconoCategoria } from '$lib/iconosCategoria';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Calendar from '@lucide/svelte/icons/calendar';
	import Tag from '@lucide/svelte/icons/tag';
	import User from '@lucide/svelte/icons/user';
	import Divide from '@lucide/svelte/icons/divide';
	import Users from '@lucide/svelte/icons/users';
	import StickyNote from '@lucide/svelte/icons/sticky-note';
	import Check from '@lucide/svelte/icons/check';
	import HandCoins from '@lucide/svelte/icons/hand-coins';
	import History from '@lucide/svelte/icons/history';
	import type { GastoDetalle as GastoDetalleData } from '$lib/server/gastos';

	type Props = {
		// Detalle completo del gasto (null = aún cargando en modal).
		gasto: GastoDetalleData | null;
		// Fallback para mostrar header al instante en el modal mientras llega el detalle.
		fallback?: {
			titulo: string;
			monto: number;
			fecha: string;
			pagadorId: string;
			pagadorNombre: string;
			pagadorAvatar: string | null;
			categoria: { nombre: string; icono: string | null } | null;
		} | null;
		// Callbacks usados por el modal en /gastos.
		onGastoBorrado?: (id: string) => void;
		// Se invoca tras una acción que muta el gasto (aportar/borrarAporte). El
		// padre lo usa para refrescar su caché (relevante en el modal). Si
		// devuelve una Promise, el componente la espera antes de limpiar el
		// estado optimista — evita razas con varias acciones rápidas.
		onCambio?: (id: string) => void | Promise<void>;
	};

	let { gasto, fallback = null, onGastoBorrado, onCambio }: Props = $props();

	// Vista mostrada: el detalle completo, o un objeto "esqueleto" derivado del
	// fallback para que el header se vea poblado mientras carga.
	type Vista = GastoDetalleData & { _esqueleto?: boolean };
	const vista = $derived.by<Vista | null>(() => {
		if (gasto) return gasto;
		if (!fallback) return null;
		// Esqueleto: solo header poblado; divisiones/aportes vacíos.
		return {
			id: '',
			hogarId: '',
			pagadorId: fallback.pagadorId,
			pagadorNombre: fallback.pagadorNombre,
			pagadorAvatar: fallback.pagadorAvatar,
			categoriaId: null,
			categoria: fallback.categoria,
			titulo: fallback.titulo,
			monto: fallback.monto,
			fecha: fallback.fecha,
			modo: 'iguales',
			notas: null,
			divisiones: [],
			_esqueleto: true
		};
	});

	const gastoId = $derived(gasto?.id ?? '');

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

	function fmtFecha(iso: string) {
		return new Date(iso + 'T00:00:00').toLocaleDateString('es-CO', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}
	function fmtFechaCorta(iso: string) {
		return new Date(iso + 'T00:00:00').toLocaleDateString('es-CO', {
			day: 'numeric',
			month: 'short'
		});
	}
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

	const yo = $derived((page.data.user as { id?: string } | undefined)?.id ?? '');
	const esMio = $derived(vista ? vista.pagadorId === yo : false);

	const MODO_LABEL: Record<string, string> = {
		iguales: 'Partes iguales',
		porcentaje: 'Por porcentaje',
		exacto: 'Monto exacto',
		partes: 'Por partes'
	};

	let confirmarBorrar = $state(false);

	const Icono = $derived(iconoCategoria(vista?.categoria?.icono));

	const labelClass =
		'flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted uppercase';

	function estadoPago(d: { monto: number; pagado: number }) {
		const pendiente = Math.max(0, d.monto - d.pagado);
		if (pendiente <= 0.01) return 'pagado' as const;
		if (d.pagado > 0.01) return 'parcial' as const;
		return 'pendiente' as const;
	}

	let aporteMonto = $state(0);

	// === Optimistic UI ====================================================
	type AporteVista = {
		id: string;
		divisionId: string;
		monto: number;
		fecha: string;
		registradoPorId: string;
		registradoPorNombre: string;
		createdAt: string;
		participanteNombre: string;
		participanteAvatar: string | null;
		participanteId: string;
	};
	let pendientes = $state<AporteVista[]>([]);
	let borradosIds = $state<Set<string>>(new Set());
	let errorAporte = $state<string | null>(null);

	// Si CAMBIA de gasto (otro id), tiramos todo el estado optimista — pertenece
	// al gasto anterior. NO limpiamos al simplemente refrescar el mismo gasto:
	// cada pendiente/borrado se limpia individualmente cuando SU propia acción
	// confirmó (ver enhance handlers abajo). Eso evita el race condition cuando
	// el usuario hace varias acciones rápidas.
	let ultimoGastoId = $state<string | null>(null);
	$effect(() => {
		const id = gasto?.id ?? null;
		if (id !== ultimoGastoId) {
			ultimoGastoId = id;
			pendientes = [];
			borradosIds = new Set();
		}
	});
	$effect(() => {
		aporteMonto = pendienteMio;
	});

	function onEnhanceAportar({ formData, cancel }: { formData: FormData; cancel: () => void }) {
		const monto = Number(formData.get('monto'));
		if (!miDivision || !Number.isFinite(monto) || monto <= 0) {
			cancel();
			return;
		}
		const tempId = `tmp-${crypto.randomUUID()}`;
		const hoy = new Date().toISOString().slice(0, 10);
		const yoNombre = vista?.divisiones.find((d) => d.participanteId === yo)?.nombre || 'Tú';
		const yoAvatar = vista?.divisiones.find((d) => d.participanteId === yo)?.avatar || null;
		pendientes = [
			...pendientes,
			{
				id: tempId,
				divisionId: miDivision.id,
				monto,
				fecha: hoy,
				registradoPorId: yo,
				registradoPorNombre: yoNombre,
				createdAt: new Date().toISOString(),
				participanteNombre: yoNombre,
				participanteAvatar: yoAvatar,
				participanteId: yo
			}
		];
		errorAporte = null;
		return async ({
			result,
			update
		}: {
			result: { type: string; data?: { error?: string } };
			update: (opts?: { reset?: boolean; invalidateAll?: boolean }) => Promise<void>;
		}) => {
			if (result.type === 'success') {
				await update({ invalidateAll: false });
				await invalidate('app:gasto-detalle');
				// Esperamos a que el padre refresque sus datos antes de limpiar el
				// optimista, así nunca hay "doble" ni "desaparece y reaparece".
				if (gasto && onCambio) await onCambio(gasto.id);
				pendientes = pendientes.filter((p) => p.id !== tempId);
			} else {
				pendientes = pendientes.filter((p) => p.id !== tempId);
				errorAporte = result.data?.error || 'No se pudo registrar el pago.';
			}
		};
	}

	function onEnhanceBorrarAporte(aporteId: string) {
		borradosIds = new Set([...borradosIds, aporteId]);
		errorAporte = null;
		return async ({
			result,
			update
		}: {
			result: { type: string; data?: { error?: string } };
			update: (opts?: { reset?: boolean; invalidateAll?: boolean }) => Promise<void>;
		}) => {
			if (result.type === 'success') {
				await update({ invalidateAll: false });
				await invalidate('app:gasto-detalle');
				if (gasto && onCambio) await onCambio(gasto.id);
				const next = new Set(borradosIds);
				next.delete(aporteId);
				borradosIds = next;
			} else {
				const next = new Set(borradosIds);
				next.delete(aporteId);
				borradosIds = next;
				errorAporte = result.data?.error || 'No se pudo borrar el aporte.';
			}
		};
	}

	function onEnhanceBorrarGasto() {
		// Optimistic: avisamos al padre AL INSTANTE para que el modal se cierre
		// y el gasto desaparezca del listado.
		if (gastoId && onGastoBorrado) onGastoBorrado(gastoId);
		return async ({ update }: { update: (opts?: { invalidateAll?: boolean }) => Promise<void> }) => {
			await update({ invalidateAll: false });
		};
	}

	function puedoBorrar(a: { registradoPorId: string; participanteId: string }) {
		if (!vista) return false;
		return a.registradoPorId === yo || a.participanteId === yo || vista.pagadorId === yo;
	}

	const divisionesEfectivas = $derived(
		(vista?.divisiones ?? []).map((d) => {
			const restados = d.aportes
				.filter((a) => borradosIds.has(a.id))
				.reduce((s, a) => s + a.monto, 0);
			const sumadosPropios = pendientes
				.filter((p) => p.divisionId === d.id)
				.reduce((s, p) => s + p.monto, 0);
			return { ...d, pagado: Math.max(0, d.pagado - restados) + sumadosPropios };
		})
	);

	const miDivision = $derived(
		divisionesEfectivas.find((d) => d.participanteId === yo) ?? null
	);
	const pendienteMio = $derived(
		miDivision ? Math.max(0, miDivision.monto - miDivision.pagado) : 0
	);

	const historial = $derived.by(() => {
		const desdeServer = (vista?.divisiones ?? []).flatMap((d) =>
			d.aportes.map((a) => ({
				...a,
				participanteNombre: d.nombre,
				participanteAvatar: d.avatar,
				participanteId: d.participanteId
			}))
		);
		const total = [...desdeServer, ...pendientes].filter((a) => !borradosIds.has(a.id));
		return total.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
	});

	const totalPagado = $derived(divisionesEfectivas.reduce((acc, d) => acc + d.pagado, 0));
	const totalPendiente = $derived(Math.max(0, (vista?.monto ?? 0) - totalPagado));

	const cargandoDetalle = $derived(!gasto && !!fallback);
</script>

{#if vista}
	<div class="flex h-full flex-col">
		<div class="grid flex-1 gap-5 lg:grid-cols-2 lg:gap-6 lg:min-h-0">
			<!-- ============ COLUMNA IZQUIERDA ============ -->
			<div class="flex flex-col gap-5 lg:min-h-0">
				<!-- Header card -->
				<section class="rounded-card border border-border bg-surface p-6 shadow-card">
					<div class="flex items-start gap-4">
						<span
							class="grid size-16 shrink-0 place-items-center rounded-card bg-brand-50 text-brand-700"
						>
							<Icono size={28} />
						</span>
						<div class="min-w-0 flex-1">
							<h1 class="text-xl font-bold text-text">{vista.titulo}</h1>
							<p class="tabular mt-1 text-4xl font-bold text-text">{fmt(vista.monto)}</p>
							<p class="mt-2 text-xs text-muted">
								{fmt(totalPagado)} pagado · {fmt(totalPendiente)} pendiente
							</p>
						</div>
						{#if esMio && !cargandoDetalle}
							<button
								type="button"
								onclick={() => (confirmarBorrar = true)}
								class="flex size-9 shrink-0 items-center justify-center rounded-input text-muted transition-colors hover:bg-money-contra-bg hover:text-money-contra"
								aria-label="Borrar gasto"
							>
								<Trash2 size={17} />
							</button>
						{/if}
					</div>
					{#if confirmarBorrar}
						<div class="mt-4 rounded-input bg-money-contra-bg p-3">
							<p class="text-sm font-medium text-text">¿Borrar este gasto?</p>
							<p class="mt-1 text-xs text-muted">
								Se borra la cabecera, las divisiones y todos los aportes registrados.
							</p>
							<div class="mt-3 flex gap-2">
								<form
									method="POST"
									action={`/gastos/${gastoId}?/borrar`}
									class="flex-1"
									use:enhance={onEnhanceBorrarGasto}
								>
									<button
										type="submit"
										class="w-full rounded-input bg-money-contra px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
									>
										Sí, borrar
									</button>
								</form>
								<button
									type="button"
									onclick={() => (confirmarBorrar = false)}
									class="flex-1 rounded-input bg-surface px-3 py-2 text-sm font-medium text-text transition-colors hover:bg-bg"
								>
									Cancelar
								</button>
							</div>
						</div>
					{/if}
				</section>

				<!-- Detalles -->
				<section>
					<p class={labelClass}>Detalles</p>
					<div class="mt-2 divide-y divide-border rounded-card bg-surface shadow-card">
						<div class="flex items-center gap-3 px-4 py-3">
							<span class="grid size-9 shrink-0 place-items-center rounded-input bg-brand-50 text-brand-700">
								<Calendar size={17} />
							</span>
							<div class="min-w-0 flex-1">
								<p class="text-xs text-muted">Fecha</p>
								<p class="text-sm font-medium text-text capitalize">{fmtFecha(vista.fecha)}</p>
							</div>
						</div>
						<div class="flex items-center gap-3 px-4 py-3">
							<span class="grid size-9 shrink-0 place-items-center rounded-input bg-brand-50 text-brand-700">
								<Tag size={17} />
							</span>
							<div class="min-w-0 flex-1">
								<p class="text-xs text-muted">Categoría</p>
								<p class="text-sm font-medium text-text">
									{vista.categoria?.nombre ?? 'Sin categoría'}
								</p>
							</div>
						</div>
						<div class="flex items-center gap-3 px-4 py-3">
							<span class="grid size-9 shrink-0 place-items-center rounded-input bg-brand-50 text-brand-700">
								<User size={17} />
							</span>
							<div class="min-w-0 flex-1">
								<p class="text-xs text-muted">Pagador</p>
								<p class="flex items-center gap-2 text-sm font-medium text-text">
									{#if vista.pagadorAvatar}
										<img
											src={vista.pagadorAvatar}
											alt=""
											referrerpolicy="no-referrer"
											class="size-5 shrink-0 rounded-full object-cover"
										/>
									{:else}
										<span
											class="grid size-5 shrink-0 place-items-center rounded-full bg-brand-50 text-[9px] font-bold text-brand-700"
										>
											{iniciales(vista.pagadorNombre)}
										</span>
									{/if}
									{esMio ? 'Tú' : vista.pagadorNombre}
								</p>
							</div>
						</div>
						{#if !cargandoDetalle}
							<div class="flex items-center gap-3 px-4 py-3">
								<span class="grid size-9 shrink-0 place-items-center rounded-input bg-brand-50 text-brand-700">
									<Divide size={17} />
								</span>
								<div class="min-w-0 flex-1">
									<p class="text-xs text-muted">Modo</p>
									<p class="text-sm font-medium text-text">
										{MODO_LABEL[vista.modo] ?? vista.modo}
									</p>
								</div>
							</div>
						{/if}
					</div>
				</section>

				<!-- Notas -->
				{#if vista.notas}
					<section>
						<p class={labelClass}>
							<StickyNote size={13} class="text-brand-500" />
							Notas
						</p>
						<div class="mt-2 rounded-card border border-border bg-surface p-5 shadow-card">
							<p class="text-sm whitespace-pre-line text-text">{vista.notas}</p>
						</div>
					</section>
				{/if}

				<!-- Cómo va cada uno -->
				<section class="flex flex-col lg:min-h-0 lg:flex-1">
					<div class="flex items-end justify-between">
						<p class={labelClass}>
							<Users size={13} class="text-brand-500" />
							Cómo va cada uno
						</p>
						<p class="tabular text-xs text-muted">
							{vista.divisiones.length}
							{vista.divisiones.length === 1 ? 'persona' : 'personas'}
						</p>
					</div>
					{#if cargandoDetalle}
						<div class="mt-2 animate-pulse overflow-hidden rounded-card bg-surface shadow-card">
							{#each Array(3) as _, i (i)}
								<div class="flex items-center gap-3 px-4 py-3" class:border-t={i > 0} class:border-border={i > 0}>
									<div class="size-10 shrink-0 rounded-full bg-brand-50"></div>
									<div class="min-w-0 flex-1 space-y-1.5">
										<div class="h-3 w-32 rounded bg-brand-50"></div>
										<div class="h-2.5 w-40 max-w-full rounded bg-brand-50"></div>
										<div class="h-1 rounded-full bg-brand-50"></div>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<ul class="mt-2 overflow-hidden rounded-card bg-surface shadow-card lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
							{#each divisionesEfectivas as d, i (d.id)}
								{@const esYo = d.participanteId === yo}
								{@const pendiente = Math.max(0, d.monto - d.pagado)}
								{@const est = estadoPago(d)}
								{@const pct = d.monto > 0 ? Math.min(100, (d.pagado / d.monto) * 100) : 0}
								<li
									class="flex items-center gap-3 px-4 py-3"
									class:border-t={i > 0}
									class:border-border={i > 0}
								>
									{#if d.avatar}
										<img
											src={d.avatar}
											alt=""
											referrerpolicy="no-referrer"
											class="size-10 shrink-0 rounded-full object-cover"
										/>
									{:else}
										<span
											class="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-700"
										>
											{iniciales(d.nombre)}
										</span>
									{/if}
									<div class="min-w-0 flex-1">
										<div class="flex items-center justify-between gap-2">
											<p class="truncate text-sm font-medium text-text">
												{d.nombre}{#if esYo}<span class="text-muted"> · Tú</span>{/if}
											</p>
											{#if est === 'pagado'}
												<span
													class="inline-flex shrink-0 items-center gap-1 rounded-full bg-money-favor-bg px-2 py-0.5 text-xs font-medium text-money-favor"
												>
													<Check size={11} strokeWidth={3} />
													Pagado
												</span>
											{:else if est === 'parcial'}
												<span
													class="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning"
												>
													Parcial
												</span>
											{:else}
												<span
													class="shrink-0 rounded-full bg-money-contra-bg px-2 py-0.5 text-xs font-medium text-money-contra"
												>
													Pendiente
												</span>
											{/if}
										</div>
										<p class="tabular mt-0.5 text-xs text-muted">
											{fmt(d.pagado)} / {fmt(d.monto)}
											{#if est !== 'pagado'}· falta {fmt(pendiente)}{/if}
										</p>
										<div class="mt-1.5 h-1 overflow-hidden rounded-full bg-bg">
											<div
												class={'h-full rounded-full transition-all ' +
													(est === 'pagado' ? 'bg-money-favor' : 'bg-brand-500')}
												style="width: {pct}%"
											></div>
										</div>
									</div>
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			</div>

			<!-- ============ COLUMNA DERECHA ============ -->
			<div class="flex flex-col gap-5 lg:min-h-0">
				<!-- Form de aporte -->
				<section>
					<p class={labelClass}>
						<HandCoins size={13} class="text-brand-500" />
						Registrar mi pago
					</p>
					<div class="mt-2 rounded-card border border-border bg-surface p-5 shadow-card">
						{#if cargandoDetalle}
							<div class="flex h-[4.5rem] animate-pulse items-center gap-3">
								<div class="size-10 shrink-0 rounded-full bg-brand-50"></div>
								<div class="flex-1 space-y-1.5">
									<div class="h-3 w-40 max-w-full rounded bg-brand-50"></div>
									<div class="h-10 rounded-input bg-brand-50"></div>
								</div>
							</div>
						{:else if !miDivision}
							<div class="flex h-[4.5rem] items-center gap-3">
								<span class="grid size-10 shrink-0 place-items-center rounded-full bg-bg text-muted">
									<Users size={18} />
								</span>
								<p class="text-sm text-muted">No participas en este gasto.</p>
							</div>
						{:else if pendienteMio <= 0.01}
							<div class="flex h-[4.5rem] items-center gap-3">
								<span class="grid size-10 shrink-0 place-items-center rounded-full bg-money-favor-bg text-money-favor">
									<Check size={18} strokeWidth={3} />
								</span>
								<div class="min-w-0">
									<p class="text-sm font-medium text-text">Ya pagaste tu parte</p>
									<p class="text-xs text-muted">No te queda nada pendiente.</p>
								</div>
							</div>
						{:else}
							<form
								method="POST"
								action={`/gastos/${gastoId}?/aportar`}
								use:enhance={onEnhanceAportar}
								class="flex flex-col gap-3 sm:flex-row sm:items-end"
							>
								<input type="hidden" name="division_id" value={miDivision.id} />
								<div class="flex-1 space-y-1.5">
									<label for="ap-monto-{gastoId}" class="block text-sm font-medium text-text">
										Monto a abonar
										<span class="font-normal text-muted">· te falta {fmt(pendienteMio)}</span>
									</label>
									<input
										id="ap-monto-{gastoId}"
										name="monto"
										type="number"
										required
										min="0.01"
										max={pendienteMio}
										step="any"
										inputmode="decimal"
										bind:value={aporteMonto}
										class="tabular w-full rounded-input border border-transparent bg-brand-50 px-3 py-2.5 text-text outline-none"
									/>
								</div>
								<button
									type="submit"
									disabled={!aporteMonto || aporteMonto <= 0}
									class="flex h-11 shrink-0 items-center justify-center gap-2 rounded-input bg-brand-500 px-5 font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
								>
									<HandCoins size={16} />
									Registrar pago
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

				<!-- Historial -->
				<section class="flex flex-col lg:min-h-0 lg:flex-1">
					<div class="flex items-end justify-between">
						<p class={labelClass}>
							<History size={13} class="text-brand-500" />
							Historial de aportes
						</p>
						<p class="tabular text-xs text-muted">
							{historial.length}
							{historial.length === 1 ? 'aporte' : 'aportes'}
						</p>
					</div>
					{#if cargandoDetalle}
						<div class="mt-2 animate-pulse overflow-hidden rounded-card bg-surface shadow-card">
							{#each Array(3) as _, i (i)}
								<div class="flex items-center gap-3 px-4 py-3" class:border-t={i > 0} class:border-border={i > 0}>
									<div class="size-9 shrink-0 rounded-full bg-brand-50"></div>
									<div class="min-w-0 flex-1">
										<div class="h-3 w-32 max-w-full rounded bg-brand-50"></div>
									</div>
									<div class="h-3 w-16 shrink-0 rounded bg-brand-50"></div>
								</div>
							{/each}
						</div>
					{:else if historial.length === 0}
						<div
							class="mt-2 rounded-card border border-dashed border-border bg-surface p-8 text-center lg:flex-1 lg:min-h-0"
						>
							<p class="text-sm text-muted">Aún no hay aportes registrados.</p>
							<p class="mt-1 text-xs text-muted">
								Usa el formulario de arriba para registrar el primer pago.
							</p>
						</div>
					{:else}
						<ul class="mt-2 overflow-hidden rounded-card bg-surface shadow-card lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
							{#each historial as a, i (a.id)}
								<li
									class="flex items-center gap-3 px-4 py-3"
									class:border-t={i > 0}
									class:border-border={i > 0}
								>
									{#if a.participanteAvatar}
										<img
											src={a.participanteAvatar}
											alt=""
											referrerpolicy="no-referrer"
											class="size-9 shrink-0 rounded-full object-cover"
										/>
									{:else}
										<span
											class="grid size-9 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-700"
										>
											{iniciales(a.participanteNombre)}
										</span>
									{/if}
									<div class="min-w-0 flex-1">
										<p class="text-sm font-medium text-text">
											{a.participanteId === yo ? 'Tú' : a.participanteNombre}
											<span class="text-muted"> · {fmtFechaCorta(a.fecha)}</span>
										</p>
									</div>
									<span class="tabular shrink-0 text-sm font-semibold text-money-favor">
										+{fmt(a.monto)}
									</span>
									{#if puedoBorrar(a)}
										<form
											method="POST"
											action={`/gastos/${gastoId}?/borrarAporte`}
											use:enhance={() => onEnhanceBorrarAporte(a.id)}
										>
											<input type="hidden" name="id" value={a.id} />
											<button
												type="submit"
												class="flex size-8 shrink-0 items-center justify-center rounded-input text-muted transition-colors hover:bg-money-contra-bg hover:text-money-contra"
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
			</div>
		</div>
	</div>
{/if}
