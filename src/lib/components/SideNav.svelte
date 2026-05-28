<script lang="ts">
	import { page } from '$app/state';
	import { navTabs, navActivo } from '$lib/nav';
	import favicon from '$lib/assets/favicon.svg';
	import X from '@lucide/svelte/icons/x';

	let { abierto = false, onCerrar }: { abierto?: boolean; onCerrar?: () => void } = $props();
</script>

<!-- Fondo oscuro (solo móvil, cuando el cajón está abierto) -->
{#if abierto}
	<button
		type="button"
		aria-label="Cerrar menú"
		class="fixed inset-0 z-30 bg-black/40 md:hidden"
		onclick={onCerrar}
	></button>
{/if}

<aside
	class="fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border bg-surface transition-transform duration-200 ease-out md:static md:z-auto md:w-60 md:translate-x-0"
	class:translate-x-0={abierto}
	class:-translate-x-full={!abierto}
>
	<div class="flex items-center justify-between px-5 py-5">
		<a href="/" class="flex items-center gap-2.5">
			<img src={favicon} alt="" class="h-8 w-8" />
			<span class="text-lg font-bold text-text">Splitmate</span>
		</a>
		<button
			type="button"
			aria-label="Cerrar menú"
			class="rounded-full p-1.5 text-muted transition-colors hover:bg-bg md:hidden"
			onclick={onCerrar}
		>
			<X size={20} />
		</button>
	</div>

	<nav class="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4">
		{#each navTabs as tab (tab.href)}
			{@const Icono = tab.icon}
			{@const esActivo = navActivo(page.url.pathname, tab.href)}
			<a
				href={tab.href}
				aria-current={esActivo ? 'page' : undefined}
				class="flex items-center gap-3 rounded-input px-3 py-2.5 text-sm font-medium transition-colors"
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
</aside>
