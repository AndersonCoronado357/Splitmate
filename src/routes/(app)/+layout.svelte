<script lang="ts">
	import SideNav from '$lib/components/SideNav.svelte';
	import AppBar from '$lib/components/AppBar.svelte';
	import { afterNavigate } from '$app/navigation';

	let { children } = $props();
	let menuAbierto = $state(false);

	// Cerrar el cajón al cambiar de ruta.
	afterNavigate(() => {
		menuAbierto = false;
	});

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') menuAbierto = false;
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="app-viewport">
	<div class="app-shell">
		<SideNav abierto={menuAbierto} onCerrar={() => (menuAbierto = false)} />
		<div class="app-body">
			<AppBar onAbrir={() => (menuAbierto = true)} />
			<main class="app-main">
				<div class="app-content">
					{@render children()}
				</div>
			</main>
		</div>
	</div>
</div>
