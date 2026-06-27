<script lang="ts">
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import { cambioHogar } from '$lib/stores/cambioHogar.svelte';
	import House from '@lucide/svelte/icons/house';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Check from '@lucide/svelte/icons/check';
	import Plus from '@lucide/svelte/icons/plus';

	// 'topbar' = chip en la barra superior + bottom sheet (móvil).
	// 'flotante' = botón flotante en una esquina + panel (escritorio).
	let { variant = 'flotante' }: { variant?: 'topbar' | 'flotante' } = $props();

	type Hogar = { id: string; nombre: string; moneda: string; rol: string };
	const hogares = $derived((page.data.hogares ?? []) as Hogar[]);
	const activo = $derived(
		page.data.hogarActivo as
			| { id: string; nombre: string; rol: string; miembros?: number }
			| undefined
	);

	let abierto = $state(false);
	let cambiando = $state<string | null>(null);

	function rolLabel(rol: string) {
		return rol === 'admin' ? 'Administrador' : 'Miembro';
	}

	async function cambiar(id: string) {
		if (id === activo?.id) {
			abierto = false;
			return;
		}
		cambiando = id;
		abierto = false; // cerrar el menú al instante
		cambioHogar.activo = true; // skeleton mientras recargan los datos
		try {
			const res = await fetch('/hogar-activo', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ id })
			});
			if (res.ok) await invalidateAll();
		} finally {
			cambiando = null;
			cambioHogar.activo = false;
		}
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') abierto = false;
	}
</script>

<svelte:window onkeydown={onKey} />

<!-- Contenido del menú: igual en ambas variantes (dropdown / bottom sheet). -->
{#snippet lista()}
	<p class="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted">Tus hogares</p>
	<ul class="flex flex-col">
		{#each hogares as h (h.id)}
			<li>
				<button
					type="button"
					onclick={() => cambiar(h.id)}
					disabled={cambiando !== null}
					class="flex w-full items-center gap-3 rounded-input px-3 py-2.5 text-left transition-colors hover:bg-bg disabled:opacity-60"
				>
					<span
						class={'grid size-9 shrink-0 place-items-center rounded-input ' +
							(h.id === activo?.id ? 'bg-brand-500 text-white' : 'bg-brand-50 text-brand-700')}
					>
						<House size={18} />
					</span>
					<span class="min-w-0 flex-1">
						<span class="block truncate text-sm font-medium text-text">{h.nombre}</span>
						<span class="block truncate text-xs text-muted">{rolLabel(h.rol)}</span>
					</span>
					{#if h.id === activo?.id}
						<Check size={18} class="shrink-0 text-brand-500" />
					{/if}
				</button>
			</li>
		{/each}
	</ul>
	<div class="my-1 border-t border-border"></div>
	<a
		href="/hogar/nuevo"
		onclick={() => (abierto = false)}
		class="flex w-full items-center gap-3 rounded-input px-3 py-2.5 text-left text-sm font-medium text-brand-700 transition-colors hover:bg-bg"
	>
		<span
			class="grid size-9 shrink-0 place-items-center rounded-input border border-dashed border-brand-200 text-brand-500"
		>
			<Plus size={18} />
		</span>
		Crear o unirme a otro hogar
	</a>
{/snippet}

{#if variant === 'topbar'}
	<!-- Chip en la barra superior (móvil). -->
	<button
		type="button"
		onclick={() => (abierto = !abierto)}
		aria-haspopup="menu"
		aria-expanded={abierto}
		class="flex min-w-0 max-w-full items-center gap-2 rounded-full py-1.5 pl-1.5 pr-2.5 text-left transition-colors hover:bg-bg"
	>
		<span class="grid size-7 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
			<House size={15} />
		</span>
		<span class="min-w-0 truncate text-sm font-semibold text-text">{activo?.nombre ?? 'Hogar'}</span>
		<ChevronDown
			size={16}
			class={'shrink-0 text-muted transition-transform duration-200 ' + (abierto ? 'rotate-180' : '')}
		/>
	</button>
{:else}
	<!-- Botón flotante en la esquina inferior derecha (solo escritorio). -->
	<button
		type="button"
		onclick={() => (abierto = !abierto)}
		aria-haspopup="menu"
		aria-expanded={abierto}
		aria-label="Cambiar de hogar"
		class="app-fab fixed bottom-4 right-4 z-30 hidden size-10 items-center justify-center rounded-full bg-brand-50 text-brand-700 shadow-card ring-1 ring-brand-200/60 transition hover:bg-brand-200 active:scale-95 lg:flex"
	>
		<House size={18} />
	</button>
{/if}

{#if abierto}
	<!-- Click-away. En móvil oscurece (bottom sheet); en escritorio es transparente
	     (popover limpio junto al botón, sin modal negro). -->
	<button
		type="button"
		aria-label="Cerrar"
		class={'fixed inset-0 z-40 cursor-default ' + (variant === 'topbar' ? 'bg-black/30' : '')}
		onclick={() => (abierto = false)}
	></button>

	{#if variant === 'topbar'}
		<!-- Bottom sheet (móvil). -->
		<div
			class="animate-fade-up fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-modal border-t border-border bg-surface p-2 shadow-card"
			style="padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px))"
		>
			<div class="mx-auto mb-1.5 mt-0.5 h-1 w-10 rounded-full bg-border"></div>
			{@render lista()}
		</div>
	{:else}
		<!-- Popover junto al botón flotante (esquina inferior derecha, escritorio). -->
		<div
			class="animate-fade-up fixed bottom-20 right-4 z-50 max-h-[calc(100dvh-7rem)] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-card border border-border bg-surface p-1 shadow-card"
		>
			{@render lista()}
		</div>
	{/if}
{/if}
