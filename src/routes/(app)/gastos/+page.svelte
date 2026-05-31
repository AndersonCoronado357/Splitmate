<script lang="ts">
	import { page } from '$app/state';
	import { invalidate } from '$app/navigation';
	import Plus from '@lucide/svelte/icons/plus';
	import Receipt from '@lucide/svelte/icons/receipt';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Tag from '@lucide/svelte/icons/tag';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import { iconoCategoria } from '$lib/iconosCategoria';
	import GastoDetalle from '$lib/components/GastoDetalle.svelte';
	import SkeletonContenido from '$lib/components/SkeletonContenido.svelte';
	import type { GastoDetalle as GastoDetalleData } from '$lib/server/gastos';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const moneda = $derived(
		(page.data.hogarActivo as { moneda?: string } | undefined)?.moneda || 'COP'
	);

	const fmt = $derived((n: number) =>
		new Intl.NumberFormat('es-CO', {
			style: 'currency',
			currency: moneda,
			maximumFractionDigits: 0
		}).format(n)
	);

	function fmtFecha(iso: string) {
		const hoy = new Date();
		const f = new Date(iso + 'T00:00:00');
		const diasAtras = Math.floor((+hoy - +f) / 86400000);
		if (diasAtras === 0) return 'Hoy';
		if (diasAtras === 1) return 'Ayer';
		if (diasAtras < 7) return f.toLocaleDateString('es-CO', { weekday: 'long' });
		return f.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
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

	// === Modal de detalle (sin cambio de URL) ===
	// id seleccionado; null = modal cerrado.
	let abiertoId = $state<string | null>(null);
	// Detalle completo del gasto seleccionado (llega del fetch al API).
	let detalle = $state<GastoDetalleData | null>(null);
	// Detalles ya cargados (caché por sesión) para que reabrir un mismo gasto
	// sea instantáneo después de la primera vez.
	const cache = new Map<string, GastoDetalleData>();
	// Borrados optimísticamente — se ocultan del listado al instante.
	let gastosBorrados = $state<Set<string>>(new Set());

	// El listado visible: lo que viene del server menos lo borrado optimísticamente.
	const gastosVisibles = $derived(
		data.gastos.filter((g) => !gastosBorrados.has(g.id))
	);

	// Cuando data.gastos cambia (refresh del listado), limpiamos los borrados
	// (el server ya los reflejó).
	$effect(() => {
		void data.gastos.length;
		gastosBorrados = new Set();
	});

	// Contador global de pedidos para descartar respuestas que llegan tarde
	// (race condition cuando el usuario hace varias acciones rápidas y caen
	// los fetches fuera de orden).
	let fetchSeq = 0;

	async function abrirGasto(id: string) {
		abiertoId = id;
		// Si está en caché, lo mostramos al instante. Si no, dejamos en null
		// → la vista pinta el skeleton completo hasta que llegue el fetch.
		const cacheado = cache.get(id);
		detalle = cacheado ?? null;
		const mio = ++fetchSeq;
		try {
			const res = await fetch(`/api/gastos/${id}`);
			if (!res.ok) return;
			const json = (await res.json()) as GastoDetalleData;
			// Si entre tanto entró otro fetch, este es obsoleto: lo descartamos.
			if (mio !== fetchSeq) return;
			cache.set(id, json);
			if (abiertoId === id) detalle = json;
		} catch {
			/* sin conexión: queda en skeleton hasta reintentar */
		}
	}

	function cerrarModal() {
		abiertoId = null;
		detalle = null;
	}

	function onTeclaCerrar(e: KeyboardEvent) {
		if (e.key === 'Escape' && abiertoId) cerrarModal();
	}

	// Cuando el detalle reporta que el gasto se borró: lo quitamos del listado
	// al instante y cerramos el modal. Después invalidamos para sincronizar.
	function onGastoBorrado(id: string) {
		gastosBorrados = new Set([...gastosBorrados, id]);
		cache.delete(id);
		cerrarModal();
		// Sincroniza el listado del server en background.
		invalidate('app:gastos-lista');
	}

	// Tras una mutación dentro del detalle (aportar / borrarAporte), refrescamos
	// la copia cacheada para que GastoDetalle pueda limpiar su estado optimista
	// con datos frescos del server. Usamos `fetchSeq` para que las respuestas
	// que llegan tarde NO sobreescriban a una más reciente (clásica race cuando
	// el usuario aprieta varias veces seguidas).
	async function onCambio(id: string) {
		const mio = ++fetchSeq;
		try {
			const res = await fetch(`/api/gastos/${id}`);
			if (!res.ok) return;
			const json = (await res.json()) as GastoDetalleData;
			if (mio !== fetchSeq) return; // llegó tarde → descartar
			cache.set(id, json);
			if (abiertoId === id) detalle = json;
		} catch {
			/* sin red: el optimistic local sigue válido hasta el próximo open */
		}
		// Refrescamos también el listado (la "mi parte" puede haber cambiado).
		invalidate('app:gastos-lista');
	}
</script>

<svelte:window onkeydown={onTeclaCerrar} />

<div class="flex flex-col px-5 py-6 md:px-8 lg:h-full lg:w-full lg:flex-1 lg:min-h-0">
	{#if abiertoId}
		<!-- Mismo layout que /gastos/[id]: "Volver" + componente compartido del detalle.
		     La URL NO cambia, todo pasa en /gastos. Si la info aún no llegó,
		     mostramos el skeleton completo del detalle hasta que esté lista. -->
		<button
			type="button"
			onclick={cerrarModal}
			class="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-text"
		>
			<ArrowLeft size={16} />
			Volver
		</button>
		<div class="mt-4 flex-1 lg:min-h-0">
			{#if detalle}
				<GastoDetalle gasto={detalle} {onGastoBorrado} {onCambio} />
			{:else}
				<SkeletonContenido ruta={`/gastos/${abiertoId}`} interior />
			{/if}
		</div>
	{:else}
		<header class="flex items-end justify-between gap-3">
			<div>
				<h1 class="text-2xl font-bold text-text">Gastos compartidos</h1>
				<p class="mt-1 text-sm text-muted">Lo que pagaron por el grupo y cómo se divide.</p>
			</div>
			<div class="flex shrink-0 items-center gap-2">
				<a
					href="/categorias"
					class="inline-flex items-center gap-1.5 rounded-input border border-border bg-surface px-3 py-2 text-sm font-semibold text-text shadow-card transition-colors hover:bg-brand-50 hover:text-brand-700"
				>
					<Tag size={16} />
					<span class="hidden sm:inline">Categorías</span>
				</a>
				<a
					href="/gastos/nuevo"
					class="inline-flex items-center gap-1.5 rounded-input bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-brand-700"
				>
					<Plus size={16} />
					Nuevo
				</a>
			</div>
		</header>

		{#if gastosVisibles.length === 0}
			<!-- Vacío -->
			<div
				class="mt-6 flex flex-1 flex-col items-center justify-center rounded-card border border-dashed border-border bg-surface px-6 py-14 text-center"
			>
				<span
					class="flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-700"
				>
					<Receipt size={26} />
				</span>
				<p class="mt-4 font-semibold text-text">Aún no hay gastos</p>
				<p class="mt-1 max-w-sm text-sm text-muted">
					Registra el primer gasto compartido y Splitmate se encarga de calcular cuánto le toca a
					cada quien.
				</p>
				<a
					href="/gastos/nuevo"
					class="mt-5 inline-flex items-center gap-1.5 rounded-input bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-brand-700"
				>
					<Plus size={16} />
					Registrar gasto
				</a>
			</div>
		{:else}
			<ul class="mt-5 flex flex-col gap-2">
				{#each gastosVisibles as g (g.id)}
					{@const Icono = iconoCategoria(g.categoria?.icono)}
					<li>
						<button
							type="button"
							onclick={() => abrirGasto(g.id)}
							class="flex w-full items-center gap-3 rounded-card border border-border bg-surface p-3.5 text-left shadow-card transition-colors hover:bg-bg"
						>
							<!-- Icono de categoría -->
							<span
								class="grid size-11 shrink-0 place-items-center rounded-input bg-brand-50 text-brand-700"
							>
								<Icono size={20} />
							</span>

							<!-- Título + meta -->
							<div class="min-w-0 flex-1">
								<p class="truncate font-semibold text-text">{g.titulo}</p>
								<p class="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
									{#if g.pagadorAvatar}
										<img
											src={g.pagadorAvatar}
											alt=""
											referrerpolicy="no-referrer"
											class="size-4 shrink-0 rounded-full object-cover"
										/>
									{:else}
										<span
											class="grid size-4 shrink-0 place-items-center rounded-full bg-brand-50 text-[8px] font-bold text-brand-700"
										>
											{iniciales(g.pagadorNombre)}
										</span>
									{/if}
									<span class="truncate">
										{g.esMio ? 'Tú' : g.pagadorNombre} pagó · {fmtFecha(g.fecha)}
										{#if g.categoria}· {g.categoria.nombre}{/if}
									</span>
								</p>
							</div>

							<!-- Monto + mi parte -->
							<div class="shrink-0 text-right">
								<p class="tabular font-semibold text-text">{fmt(g.monto)}</p>
								{#if g.miParte > 0}
									<p class="tabular mt-0.5 text-xs text-muted">tu parte {fmt(g.miParte)}</p>
								{:else}
									<p class="mt-0.5 text-xs text-muted">no participas</p>
								{/if}
							</div>

							<ChevronRight size={18} class="shrink-0 text-muted" />
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</div>
