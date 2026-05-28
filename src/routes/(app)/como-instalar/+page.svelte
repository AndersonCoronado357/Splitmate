<script lang="ts">
	import { onMount } from 'svelte';

	type SO = 'ios' | 'android' | 'otro';

	let so = $state<SO>('otro');

	onMount(() => {
		const ua = navigator.userAgent;
		if (/iPhone|iPad|iPod/i.test(ua)) so = 'ios';
		else if (/Android/i.test(ua)) so = 'android';
		else so = 'otro';
	});

	function elegir(opcion: SO) {
		so = opcion;
	}
</script>

<main class="w-full px-5 py-6 md:px-8">
	<header>
		<p class="text-sm text-muted">
			<a href="/ajustes" class="text-brand-500 underline">← Ajustes</a>
		</p>
		<h1 class="mt-1 text-2xl font-bold text-text">Cómo instalar Splitmate</h1>
		<p class="mt-1 text-muted">
			Añade un acceso directo de la app a la pantalla de inicio de tu celular.
		</p>
	</header>

	<nav class="mt-6 grid grid-cols-2 gap-2 rounded-input bg-surface p-1 shadow-card">
		<button
			type="button"
			onclick={() => elegir('ios')}
			class="rounded-input px-3 py-2 text-sm font-medium transition-colors"
			class:bg-brand-500={so === 'ios'}
			class:text-white={so === 'ios'}
			class:text-muted={so !== 'ios'}>iPhone (iOS)</button
		>
		<button
			type="button"
			onclick={() => elegir('android')}
			class="rounded-input px-3 py-2 text-sm font-medium transition-colors"
			class:bg-brand-500={so === 'android'}
			class:text-white={so === 'android'}
			class:text-muted={so !== 'android'}>Android</button
		>
	</nav>

	{#if so === 'ios'}
		<section class="mt-6 rounded-card bg-surface p-5 shadow-card">
			<h2 class="text-base font-semibold text-text">En iPhone con Safari</h2>
			<ol class="mt-3 list-decimal space-y-3 pl-5 text-sm text-text">
				<li>Abre esta página en <strong>Safari</strong> (otros navegadores en iPhone no permiten añadir a inicio).</li>
				<li>Toca el botón <strong>Compartir</strong> (cuadrado con flecha hacia arriba, en la barra inferior).</li>
				<li>Desplaza hacia abajo en el menú y toca <strong>Añadir a pantalla de inicio</strong>.</li>
				<li>Ajusta el nombre si quieres (sale "Splitmate" por defecto) y toca <strong>Añadir</strong>.</li>
				<li>El ícono aparece en tu pantalla de inicio. Al tocarlo, se abre Splitmate en Safari.</li>
			</ol>
		</section>
	{:else if so === 'android'}
		<section class="mt-6 rounded-card bg-surface p-5 shadow-card">
			<h2 class="text-base font-semibold text-text">En Android con Chrome</h2>
			<ol class="mt-3 list-decimal space-y-3 pl-5 text-sm text-text">
				<li>Abre esta página en <strong>Chrome</strong> (también funciona en Edge, Brave y otros basados en Chromium).</li>
				<li>Toca el menú de tres puntos <strong>⋮</strong> arriba a la derecha.</li>
				<li>Toca <strong>Añadir a pantalla de inicio</strong> (o "Instalar app", según versión).</li>
				<li>Confirma el nombre y toca <strong>Añadir</strong>.</li>
				<li>El ícono aparece en tu pantalla de inicio.</li>
			</ol>
		</section>
	{:else}
		<section class="mt-6 rounded-card bg-surface p-5 shadow-card">
			<h2 class="text-base font-semibold text-text">Otro dispositivo</h2>
			<p class="mt-2 text-sm text-text">
				Splitmate está pensada para celular. Si estás en computadora, ábrelo desde tu celular para añadirlo a la pantalla de inicio. Elige arriba el sistema operativo de tu teléfono para ver las instrucciones.
			</p>
		</section>
	{/if}

	<section class="mt-6 rounded-card border border-border bg-surface p-5">
		<h2 class="text-sm font-semibold text-text">Buena onda saberlo</h2>
		<ul class="mt-2 list-inside list-disc space-y-1 text-sm text-text">
			<li>
				El acceso directo abre Splitmate en una pestaña normal del navegador, no como una "app instalada".
			</li>
			<li>Necesitas internet para usarla (no funciona sin conexión).</li>
			<li>
				En Android, las <strong>notificaciones push</strong> sí funcionan tras dar permiso. En iPhone <strong>no</strong> hay push con este modo de instalación.
			</li>
		</ul>
	</section>
</main>
