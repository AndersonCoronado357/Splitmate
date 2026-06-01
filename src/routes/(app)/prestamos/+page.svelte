<script lang="ts">
	import { page } from '$app/state';
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import HandCoins from '@lucide/svelte/icons/hand-coins';
	import Plus from '@lucide/svelte/icons/plus';
	import { supabaseBrowser } from '$lib/supabase-browser';
	import type { PageData } from './$types';
	import type { PrestamoListado } from '$lib/server/prestamos';

	let { data }: { data: PageData } = $props();
	const prestamos = $derived(data.prestamos);

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

	// Grupos para los tabs.
	const porConfirmar = $derived(
		prestamos.filter((p) => p.estado === 'pendiente' && p.soyReceptor)
	);
	const esperandoConfirmacion = $derived(
		prestamos.filter((p) => p.estado === 'pendiente' && p.soyPrestador)
	);
	const activos = $derived(prestamos.filter((p) => p.estado === 'activo'));
	const pagados = $derived(prestamos.filter((p) => p.estado === 'saldado'));
	// Rechazados solo aparecen en "Todos" — no merecen un tab propio porque
	// son un final triste y poco frecuente.
	const cerrados = $derived(
		prestamos.filter((p) => p.estado === 'saldado' || p.estado === 'rechazado')
	);
	const devolucionesPorConfirmar = $derived(
		prestamos
			.filter((p) => p.soyPrestador)
			.flatMap((p) => p.devoluciones.filter((d) => d.estado === 'pendiente')).length
	);

	type Filtro = 'activos' | 'pendientes' | 'pagados' | 'todos';
	let filtro = $state<Filtro>('activos');

	const tabs = $derived([
		{ id: 'activos' as const, label: 'Activos', count: activos.length },
		{
			id: 'pendientes' as const,
			label: 'Pendientes',
			count: porConfirmar.length + esperandoConfirmacion.length
		},
		{ id: 'pagados' as const, label: 'Pagados', count: pagados.length },
		{ id: 'todos' as const, label: 'Todos', count: prestamos.length }
	]);

	const verActivos = $derived(filtro === 'activos' || filtro === 'todos');
	const verPendientes = $derived(filtro === 'pendientes' || filtro === 'todos');
	const verPagados = $derived(filtro === 'pagados' || filtro === 'todos');
	const verRechazados = $derived(filtro === 'todos');

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
			debounceId = setTimeout(() => invalidate('app:prestamos'), 250);
		};

		const canal = supabase
			.channel(`prestamos-${hogarId}`)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'prestamos', filter: `hogar_id=eq.${hogarId}` },
				refrescar
			)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'pagos', filter: `hogar_id=eq.${hogarId}` },
				refrescar
			)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'prestamo_cuotas' },
				refrescar
			)
			.subscribe();

		return () => {
			if (debounceId) clearTimeout(debounceId);
			supabase.removeChannel(canal);
		};
	});
</script>

<!-- Fila idéntica al patrón de /gastos: icono cuadrado + título + meta + monto/estado a la derecha. -->
{#snippet filaPrestamo(p: PrestamoListado)}
	{@const otroNombre = p.soyPrestador ? p.receptorNombre : p.prestadorNombre}
	{@const otroAvatar = p.soyPrestador ? p.receptorAvatar : p.prestadorAvatar}
	{@const tieneDevPend = p.devoluciones.some((d) => d.estado === 'pendiente')}
	<li>
		<a
			href={`/prestamos/${p.id}`}
			class="flex w-full items-center gap-3 rounded-card border border-border bg-surface p-3.5 text-left shadow-card transition-colors hover:bg-bg"
		>
			{#if otroAvatar}
				<img
					src={otroAvatar}
					alt=""
					referrerpolicy="no-referrer"
					class="size-11 shrink-0 rounded-full object-cover"
				/>
			{:else}
				<span class="grid size-11 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">
					{iniciales(otroNombre)}
				</span>
			{/if}

			<div class="min-w-0 flex-1">
				<p class="truncate font-semibold text-text">{otroNombre}</p>
				<p class="mt-0.5 text-xs text-muted">
					{#if p.soyPrestador}Le prestaste{:else if p.soyReceptor}Te prestó{/if}
					· {p.fechaTexto}
				</p>
			</div>

			<div class="shrink-0 text-right">
				<p class="tabular font-semibold text-text">{p.montoTexto}</p>
				{#if p.estado === 'pendiente' && p.soyReceptor}
					<p class="mt-0.5 text-xs text-warning">confirma o rechaza</p>
				{:else if p.estado === 'pendiente' && p.soyPrestador}
					<p class="mt-0.5 text-xs text-warning">esperando</p>
				{:else if p.estado === 'activo'}
					{#if tieneDevPend && p.soyPrestador}
						<p class="mt-0.5 text-xs text-warning">por confirmar</p>
					{:else}
						<p class="tabular mt-0.5 text-xs text-muted">faltan {p.pendienteTexto}</p>
					{/if}
				{:else if p.estado === 'saldado'}
					<p class="mt-0.5 text-xs text-money-favor">pagado</p>
				{:else if p.estado === 'rechazado'}
					<p class="mt-0.5 text-xs text-money-contra">rechazado</p>
				{/if}
			</div>
		</a>
	</li>
{/snippet}

<div class="flex flex-col px-5 py-6 md:px-8 lg:h-full lg:w-full lg:flex-1 lg:min-h-0">
	<header class="flex items-end justify-between gap-3">
		<div>
			<h1 class="text-2xl font-bold text-text">Préstamos</h1>
			<p class="mt-1 text-sm text-muted">
				Plata que prestas o te prestan. Aparte de los gastos.
			</p>
		</div>
		<div class="flex shrink-0 items-center gap-2">
			<a
				href="/prestamos/nuevo"
				class="inline-flex items-center gap-1.5 rounded-input bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-brand-700"
			>
				<Plus size={16} />
				Nuevo
			</a>
		</div>
	</header>

	{#if prestamos.length === 0}
		<div
			class="mt-6 flex flex-1 flex-col items-center justify-center rounded-card border border-dashed border-border bg-surface px-6 py-14 text-center"
		>
			<span class="flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-700">
				<HandCoins size={26} />
			</span>
			<p class="mt-4 font-semibold text-text">Aún no hay préstamos</p>
			<p class="mt-1 max-w-sm text-sm text-muted">
				Aquí guardas la plata que prestas o te prestan, separada de los gastos del hogar.
			</p>
			<a
				href="/prestamos/nuevo"
				class="mt-5 inline-flex items-center gap-1.5 rounded-input bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-brand-700"
			>
				<Plus size={16} />
				Registrar préstamo
			</a>
		</div>
	{:else}
		<!-- Chips separados (cada uno con su propio fondo/borde) en una sola fila. -->
		<div class="mt-5 flex gap-2" role="tablist">
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

		{#if devolucionesPorConfirmar > 0}
			<p class="mt-4 rounded-input bg-warning/10 px-3 py-2 text-xs font-medium text-warning">
				Tienes {devolucionesPorConfirmar}
				{devolucionesPorConfirmar === 1
					? 'devolución por confirmar'
					: 'devoluciones por confirmar'} en tus préstamos activos.
			</p>
		{/if}

		<div class="mt-4 flex flex-col gap-5 lg:flex-1 lg:overflow-y-auto lg:pr-1 lg:min-h-0">
			{#if verPendientes && porConfirmar.length > 0}
				<div>
					<h2 class="text-sm font-semibold text-text">Esperan tu confirmación</h2>
					<ul class="mt-2 flex flex-col gap-2">
						{#each porConfirmar as p (p.id)}{@render filaPrestamo(p)}{/each}
					</ul>
				</div>
			{/if}

			{#if verPendientes && esperandoConfirmacion.length > 0}
				<div>
					<h2 class="text-sm font-semibold text-text">Esperando confirmación</h2>
					<ul class="mt-2 flex flex-col gap-2">
						{#each esperandoConfirmacion as p (p.id)}{@render filaPrestamo(p)}{/each}
					</ul>
				</div>
			{/if}

			{#if verActivos && activos.length > 0}
				<div>
					{#if filtro === 'todos'}<h2 class="text-sm font-semibold text-text">Activos</h2>{/if}
					<ul class={'flex flex-col gap-2 ' + (filtro === 'todos' ? 'mt-2' : '')}>
						{#each activos as p (p.id)}{@render filaPrestamo(p)}{/each}
					</ul>
				</div>
			{/if}

			{#if verPagados && pagados.length > 0}
				<div>
					{#if filtro === 'todos'}<h2 class="text-sm font-semibold text-text">Pagados</h2>{/if}
					<ul class={'flex flex-col gap-2 ' + (filtro === 'todos' ? 'mt-2' : '')}>
						{#each pagados as p (p.id)}{@render filaPrestamo(p)}{/each}
					</ul>
				</div>
			{/if}

			<!-- Rechazados solo aparecen en el filtro "Todos". -->
			{#if verRechazados}
				{@const rechazados = prestamos.filter((p) => p.estado === 'rechazado')}
				{#if rechazados.length > 0}
					<div>
						<h2 class="text-sm font-semibold text-text">Rechazados</h2>
						<ul class="mt-2 flex flex-col gap-2">
							{#each rechazados as p (p.id)}{@render filaPrestamo(p)}{/each}
						</ul>
					</div>
				{/if}
			{/if}

			{#if (filtro === 'activos' && activos.length === 0) || (filtro === 'pendientes' && porConfirmar.length + esperandoConfirmacion.length === 0) || (filtro === 'pagados' && pagados.length === 0)}
				<div
					class="flex flex-1 flex-col items-center justify-center rounded-card border border-dashed border-border bg-surface px-6 py-10 text-center"
				>
					<p class="text-sm text-muted">
						{#if filtro === 'activos'}
							No hay préstamos activos por ahora.
						{:else if filtro === 'pendientes'}
							No hay préstamos pendientes de confirmar.
						{:else}
							Aún no hay préstamos pagados.
						{/if}
					</p>
					<button
						type="button"
						onclick={() => (filtro = 'todos')}
						class="mt-3 text-xs font-semibold text-brand-700 hover:underline"
					>
						Ver todos
					</button>
				</div>
			{/if}
		</div>
	{/if}
</div>
