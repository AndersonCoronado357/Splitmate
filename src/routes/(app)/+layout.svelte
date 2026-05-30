<script lang="ts">
	import SideNav from '$lib/components/SideNav.svelte';
	import AppBar from '$lib/components/AppBar.svelte';
	import HogarSwitcher from '$lib/components/HogarSwitcher.svelte';
	import SkeletonContenido from '$lib/components/SkeletonContenido.svelte';
	import { cambioHogar } from '$lib/stores/cambioHogar.svelte';
	import { navTabs } from '$lib/nav';
	import { afterNavigate, preloadData } from '$app/navigation';
	import { page, navigating } from '$app/state';

	let { children } = $props();
	let menuAbierto = $state(false);

	// Tras cada navegación: cerrar el cajón y PRECARGAR los demás módulos del menú
	// (así el siguiente clic ya está en caché y la navegación es instantánea).
	afterNavigate(() => {
		menuAbierto = false;
		for (const tab of navTabs) {
			if (tab.href !== page.url.pathname) preloadData(tab.href);
		}
	});

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') menuAbierto = false;
	}

	// Skeleton mientras navega a un módulo. 80 ms de gracia para no parpadear en
	// navegaciones realmente instantáneas; se excluyen los envíos de formulario.
	let navCargando = $state(false);
	$effect(() => {
		const t = navigating.type;
		if (!navigating.to || (t !== 'link' && t !== 'goto' && t !== 'popstate')) {
			navCargando = false;
			return;
		}
		const id = setTimeout(() => (navCargando = true), 80);
		return () => clearTimeout(id);
	});
</script>

<svelte:window onkeydown={onKeydown} />

<div class="app-viewport">
	<div class="app-shell">
		<SideNav abierto={menuAbierto} onCerrar={() => (menuAbierto = false)} />
		<div class="app-body">
			<AppBar onAbrir={() => (menuAbierto = true)} />
			<main class="app-main">
				<div class="app-content">
					{#if cambioHogar.activo || navCargando}
						<!-- Al navegar imita la vista de destino; al cambiar de hogar, la actual. -->
						<SkeletonContenido ruta={navigating.to?.url.pathname ?? page.url.pathname} />
					{:else}
						{@render children()}
					{/if}
				</div>
			</main>
		</div>
	</div>

	<!-- Selector de hogar: botón flotante (escritorio). En móvil va en la barra superior. -->
	<HogarSwitcher variant="flotante" />
</div>
