<script lang="ts">
	import { page, navigating } from '$app/state';
	import { navTabs, navActivo } from '$lib/nav';
	import favicon from '$lib/assets/favicon.svg';
	import X from '@lucide/svelte/icons/x';

	let { abierto = false, onCerrar }: { abierto?: boolean; onCerrar?: () => void } = $props();

	// Ruta activa OPTIMISTA: si hay una navegación en curso, resaltamos el destino
	// al instante (se siente inmediato aunque el contenido aún esté cargando).
	const rutaActiva = $derived(navigating.to?.url.pathname ?? page.url.pathname);
	// Mientras navega, bloqueamos el menú para no encolar otra navegación.
	const navegando = $derived(!!navigating.to);

	const perfil = $derived(
		page.data.perfil as
			| { display_name: string; email: string; avatar: string | null }
			| undefined
	);

	const iniciales = $derived(
		((perfil?.display_name || perfil?.email || '?')
			.trim()
			.split(/\s+/)
			.map((w) => w[0])
			.slice(0, 2)
			.join('') || '?'
		).toUpperCase()
	);
</script>

<!-- Fondo oscuro (solo móvil, cuando el cajón está abierto) -->
{#if abierto}
	<button
		type="button"
		aria-label="Cerrar menú"
		class="fixed inset-0 z-30 bg-black/40 lg:hidden"
		onclick={onCerrar}
	></button>
{/if}

<aside
	class="app-sidenav fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border bg-surface transition-transform duration-200 ease-out lg:w-60 lg:translate-x-0"
	class:translate-x-0={abierto}
	class:-translate-x-full={!abierto}
	class:is-open={abierto}
>
	<div class="flex items-center justify-between px-5 py-5">
		<a href="/" class="flex items-center gap-2.5">
			<img src={favicon} alt="" class="h-8 w-8" />
			<span class="text-lg font-bold text-text">Splitmate</span>
		</a>
		<button
			type="button"
			aria-label="Cerrar menú"
			class="rounded-full p-1.5 text-muted transition-colors hover:bg-bg lg:hidden"
			onclick={onCerrar}
		>
			<X size={20} />
		</button>
	</div>

	<nav
		class="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4"
		class:pointer-events-none={navegando}
	>
		{#each navTabs as tab (tab.href)}
			{@const Icono = tab.icon}
			{@const esActivo = navActivo(rutaActiva, tab.href)}
			<a
				href={tab.href}
				aria-current={esActivo ? 'page' : undefined}
				class="flex items-center gap-3 rounded-input px-3 py-2.5 text-sm font-medium transition-colors duration-200 ease-out"
				class:bg-brand-50={esActivo}
				class:text-brand-700={esActivo}
				class:text-muted={!esActivo}
				class:hover:bg-bg={!esActivo}
			>
				<Icono size={20} strokeWidth={2} />
				<span>{tab.label}</span>
			</a>
		{/each}
	</nav>

	{#if perfil}
		<a
			href="/ajustes"
			aria-current={navActivo(rutaActiva, '/ajustes') ? 'page' : undefined}
			class="flex items-center gap-3 border-t border-border px-4 py-3 transition-colors duration-200 ease-out hover:bg-bg"
			class:pointer-events-none={navegando}
		>
			{#if perfil.avatar}
				<img
					src={perfil.avatar}
					alt=""
					referrerpolicy="no-referrer"
					class="size-9 shrink-0 rounded-full object-cover"
				/>
			{:else}
				<span
					class="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700"
				>
					{iniciales}
				</span>
			{/if}
			<span class="min-w-0 flex-1 truncate text-sm font-medium text-text">
				{perfil.display_name || 'Sin nombre'}
			</span>
		</a>
	{/if}
</aside>
