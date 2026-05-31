<script lang="ts">
	import { page } from '$app/state';
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import Users from '@lucide/svelte/icons/users';
	import Receipt from '@lucide/svelte/icons/receipt';
	import { supabaseBrowser } from '$lib/supabase-browser';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const resumen = $derived(data.resumen);

	const fmt = $derived(
		(n: number) =>
			new Intl.NumberFormat('es-CO', {
				style: 'currency',
				currency: (page.data.hogarActivo as { moneda?: string } | undefined)?.moneda || 'COP',
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

	// === Tiempo real (Fase 5.3) ============================================
	// Cuando alguien del hogar crea/edita/borra un gasto, su división o un
	// aporte, recibimos un evento de Postgres Realtime y disparamos un
	// invalidate del Inicio. El balance se refresca sin que el usuario tenga
	// que hacer nada.
	//
	// Debounce: si llegan varios eventos en ráfaga (ej. al crear un gasto se
	// inserta el gasto + N divisiones casi al mismo tiempo), juntamos todo en
	// UNA sola refresh para no pegarle al server N veces seguidas.
	const hogarId = $derived(
		(page.data.hogarActivo as { id?: string } | undefined)?.id ?? ''
	);

	onMount(() => {
		if (!hogarId) return;
		const supabase = supabaseBrowser();
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
			// gasto_divisiones y aportes no tienen hogar_id; nos suscribimos a
			// todos los eventos y la RLS filtra del lado del server lo que
			// realmente vemos. Para cada uno disparamos refresh.
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'gasto_divisiones' },
				refrescar
			)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'aportes' },
				refrescar
			)
			.subscribe();

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

	<!-- Por persona -->
	<section class="mt-8 flex flex-col lg:min-h-0 lg:flex-1">
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
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>
