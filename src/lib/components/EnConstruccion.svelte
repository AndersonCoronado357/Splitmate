<script lang="ts">
	import type { Component } from 'svelte';

	let {
		titulo,
		descripcion,
		Icono
	}: { titulo: string; descripcion: string; Icono: Component } = $props();
</script>

<div class="flex flex-1 flex-col">
	<header class="px-5 pt-6 pb-2">
		<h1 class="text-2xl font-bold text-text">{titulo}</h1>
	</header>
	<div class="flex flex-1 flex-col items-center justify-center px-10 pb-12 text-center">
		<div class="rounded-2xl bg-brand-50 p-5 text-brand-500">
			<Icono size={36} strokeWidth={2} />
		</div>
		<p class="mt-4 text-base font-semibold text-text">Próximamente</p>
		<p class="mt-1 text-sm text-muted">{descripcion}</p>
	</div>
</div>
