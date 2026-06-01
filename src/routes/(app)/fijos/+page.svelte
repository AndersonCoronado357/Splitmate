<script lang="ts">
	import { page } from '$app/state';
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import Plus from '@lucide/svelte/icons/plus';
	import Repeat from '@lucide/svelte/icons/repeat';
	import { iconoCategoria } from '$lib/iconosCategoria';
	import { supabaseBrowser } from '$lib/supabase-browser';
	import type { PageData } from './$types';
	import type { FijoListado } from '$lib/server/fijos';

	let { data }: { data: PageData } = $props();
	const fijos = $derived(data.fijos);

	const activas = $derived(fijos.filter((f) => f.activa));
	const archivadas = $derived(fijos.filter((f) => !f.activa));

	const yo = $derived((page.data.user as { id?: string } | undefined)?.id ?? '');

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

	// Tiempo real
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
			.channel(`fijos-${hogarId}`)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'gastos_fijos_plantilla' },
				refrescar
			)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'gastos_fijos_mes' },
				refrescar
			)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'gastos_fijos_aportes' },
				refrescar
			)
			.subscribe();
		return () => {
			if (debounceId) clearTimeout(debounceId);
			supabase.removeChannel(canal);
		};
	});
</script>

{#snippet filaFijo(f: FijoListado)}
	{@const Icono = iconoCategoria(f.categoria?.icono)}
	{@const miDiv = f.mesActual?.divisiones.find((d) => d.participanteId === yo)}
	<li>
		<a
			href={`/fijos/${f.id}`}
			class={'flex w-full items-center gap-3 rounded-card border border-border bg-surface p-3.5 text-left shadow-card transition-colors hover:bg-bg ' +
				(f.activa ? '' : 'opacity-60 hover:opacity-100')}
		>
			<span class="grid size-11 shrink-0 place-items-center rounded-input bg-brand-50 text-brand-700">
				<Icono size={20} />
			</span>
			<div class="min-w-0 flex-1">
				<p class="truncate font-semibold text-text">{f.nombre}</p>
				<p class="mt-0.5 text-xs text-muted">
					{f.montoTexto}
					{#if f.mesActual}
						· {f.mesActual.avance.aportaron} de {f.mesActual.avance.total} aportaron
					{/if}
				</p>
			</div>
			<div class="shrink-0 text-right">
				{#if !f.activa}
					<p class="text-xs text-muted">archivado</p>
				{:else if miDiv}
					<p class="tabular font-semibold text-text">{miDiv.montoTexto}</p>
					{#if miDiv.pendiente <= 0.01}
						<p class="mt-0.5 text-xs text-money-favor">tu parte pagada</p>
					{:else if miDiv.pagado > 0.01}
						<p class="tabular mt-0.5 text-xs text-warning">
							te falta {miDiv.pendienteTexto}
						</p>
					{:else}
						<p class="mt-0.5 text-xs text-money-contra">pendiente</p>
					{/if}
				{:else if f.mesActual}
					<p class="tabular font-semibold text-text">{f.mesActual.montoTexto}</p>
					<p class="mt-0.5 text-xs text-muted">no participas</p>
				{/if}
			</div>
		</a>
	</li>
{/snippet}

<div class="flex flex-col px-5 py-6 md:px-8 lg:h-full lg:w-full lg:flex-1 lg:min-h-0">
	<header class="flex items-end justify-between gap-3">
		<div>
			<h1 class="text-2xl font-bold text-text">Gastos fijos</h1>
			<p class="mt-1 text-sm text-muted">
				Costos recurrentes del hogar y cuánto aportó cada uno este mes.
			</p>
		</div>
		<a
			href="/fijos/nuevo"
			class="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-input bg-brand-500 px-3.5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-brand-700"
		>
			<Plus size={16} />
			Nuevo
		</a>
	</header>

	{#if fijos.length === 0}
		<div
			class="mt-6 flex flex-1 flex-col items-center justify-center rounded-card border border-dashed border-border bg-surface px-6 py-14 text-center"
		>
			<span class="flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-700">
				<Repeat size={26} />
			</span>
			<p class="mt-4 font-semibold text-text">Aún no hay gastos fijos</p>
			<p class="mt-1 max-w-sm text-sm text-muted">
				Plantea aquí lo que se paga mes a mes — arriendo, servicios, internet — y deja que el
				sistema saque la cuota de cada quien.
			</p>
			<a
				href="/fijos/nuevo"
				class="mt-5 inline-flex items-center gap-1.5 rounded-input bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-brand-700"
			>
				<Plus size={16} />
				Crear gasto fijo
			</a>
		</div>
	{:else}
		<div class="mt-5 flex flex-col gap-5 lg:flex-1 lg:overflow-y-auto lg:pr-1 lg:min-h-0">
			{#if activas.length > 0}
				<div>
					{#if archivadas.length > 0}
						<h2 class="text-sm font-semibold text-text">Activos</h2>
					{/if}
					<ul class={'flex flex-col gap-2 ' + (archivadas.length > 0 ? 'mt-2' : '')}>
						{#each activas as f (f.id)}{@render filaFijo(f)}{/each}
					</ul>
				</div>
			{/if}
			{#if archivadas.length > 0}
				<div>
					<h2 class="text-sm font-semibold text-text">Archivados</h2>
					<ul class="mt-2 flex flex-col gap-2">
						{#each archivadas as f (f.id)}{@render filaFijo(f)}{/each}
					</ul>
				</div>
			{/if}
		</div>
	{/if}
</div>
