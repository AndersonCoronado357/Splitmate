<script lang="ts">
	import { page } from '$app/state';
	import DecorPanel from '$lib/components/DecorPanel.svelte';

	let { children } = $props();

	// En /registro el formulario y el panel cruzan posiciones (se deslizan).
	let esRegistro = $derived(page.url.pathname === '/registro');
</script>

<div class="relative h-dvh overflow-x-hidden overflow-y-auto bg-bg lg:overflow-hidden">
	<!-- Panel decorativo.
	     Móvil: oculto.
	     Desktop (lg+): mitad izquierda en login; se desliza a la derecha en registro. -->
	<aside
		aria-hidden="true"
		class={'hidden lg:absolute lg:inset-y-0 lg:left-0 lg:flex lg:w-1/2 lg:transition-transform lg:duration-[800ms] lg:ease-[cubic-bezier(0.16,1,0.3,1)] ' +
			(esRegistro ? 'lg:translate-x-full' : '')}
	>
		<DecorPanel modo={esRegistro ? 'registro' : 'login'} />
	</aside>

	<!-- Columna del formulario.
	     Móvil: ocupa toda la pantalla, centrado.
	     Desktop (lg+): mitad derecha en login; se desliza a la izquierda en registro. -->
	<div
		class={'flex min-h-dvh items-center justify-center px-6 py-8 lg:absolute lg:inset-y-0 lg:right-0 lg:w-1/2 lg:px-12 lg:py-12 lg:transition-transform lg:duration-[800ms] lg:ease-[cubic-bezier(0.16,1,0.3,1)] ' +
			(esRegistro ? 'lg:-translate-x-full' : '')}
	>
		<div class="w-full max-w-sm">
			{@render children()}
		</div>
	</div>
</div>
