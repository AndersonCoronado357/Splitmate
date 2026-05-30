<script lang="ts">
	import { onMount } from 'svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';

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

<div class="flex flex-col px-5 py-6 md:px-8 lg:h-full lg:w-full lg:flex-1">
	<header>
		<a
			href="/ajustes"
			class="-ml-2 inline-flex items-center gap-1.5 rounded-input px-2 py-1 text-sm font-medium text-muted transition-colors hover:bg-bg hover:text-text"
		>
			<ArrowLeft size={16} /> Ajustes
		</a>
		<h1 class="mt-2 text-2xl font-bold text-text">Cómo instalar Splitmate</h1>
		<p class="mt-1 text-muted">
			Añade un acceso directo de la app a la pantalla de inicio de tu celular.
		</p>
	</header>

	<nav class="mt-5 grid grid-cols-2 gap-1 rounded-input bg-surface p-1 shadow-card">
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

	<div class="mt-5 grid gap-5 lg:min-h-0 lg:flex-1 lg:grid-cols-2">
		<!-- Instrucciones -->
		<section class="flex flex-col lg:min-h-0">
			<div class="flex flex-1 flex-col rounded-card bg-surface p-5 shadow-card">
				{#if so === 'ios'}
					<h2 class="text-base font-semibold text-text">En iPhone con Safari</h2>
					<ol class="mt-3 list-decimal space-y-3 pl-5 text-sm text-text">
						<li>
							Abre esta página en <strong>Safari</strong> (otros navegadores en iPhone no permiten añadir
							a inicio).
						</li>
						<li>
							Toca el botón <strong>Compartir</strong> (cuadrado con flecha hacia arriba, en la barra inferior).
						</li>
						<li>
							Desplaza hacia abajo en el menú y toca <strong>Añadir a pantalla de inicio</strong>.
						</li>
						<li>
							Ajusta el nombre si quieres (sale "Splitmate" por defecto) y toca <strong>Añadir</strong>.
						</li>
						<li>El ícono aparece en tu pantalla de inicio. Al tocarlo, se abre Splitmate en Safari.</li>
					</ol>
				{:else if so === 'android'}
					<h2 class="text-base font-semibold text-text">En Android con Chrome</h2>
					<ol class="mt-3 list-decimal space-y-3 pl-5 text-sm text-text">
						<li>
							Abre esta página en <strong>Chrome</strong> (también funciona en Edge, Brave y otros basados
							en Chromium).
						</li>
						<li>Toca el menú de tres puntos <strong>⋮</strong> arriba a la derecha.</li>
						<li>
							Toca <strong>Añadir a pantalla de inicio</strong> (o "Instalar app", según versión).
						</li>
						<li>Confirma el nombre y toca <strong>Añadir</strong>.</li>
						<li>El ícono aparece en tu pantalla de inicio.</li>
					</ol>
				{:else}
					<h2 class="text-base font-semibold text-text">Otro dispositivo</h2>
					<p class="mt-2 text-sm text-text">
						Splitmate está pensada para celular. Si estás en computadora, ábrelo desde tu celular para
						añadirlo a la pantalla de inicio. Elige arriba el sistema operativo de tu teléfono para ver
						las instrucciones.
					</p>
				{/if}
			</div>
		</section>

		<!-- Buena onda saberlo -->
		<section class="flex flex-col lg:min-h-0">
			<div class="flex flex-1 flex-col rounded-card border border-border bg-surface p-5">
				<h2 class="text-sm font-semibold text-text">Buena onda saberlo</h2>
				<ul class="mt-3 list-inside list-disc space-y-2 text-sm text-text">
					<li>
						El acceso directo abre Splitmate en una pestaña normal del navegador, no como una "app
						instalada".
					</li>
					<li>Necesitas internet para usarla (no funciona sin conexión).</li>
					<li>
						En Android, las <strong>notificaciones push</strong> sí funcionan tras dar permiso. En iPhone
						<strong>no</strong> hay push con este modo de instalación.
					</li>
				</ul>
			</div>
		</section>
	</div>
</div>
