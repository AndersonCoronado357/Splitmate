<!--
	Página de detalle directa (deep link). Usa el componente compartido
	`GastoDetalle` y agrega un link "Volver" + manejo de borrar (navega a /gastos
	cuando el gasto se borra exitosamente).
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import GastoDetalle from '$lib/components/GastoDetalle.svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Si el gasto se borró: el callback se llama optimísticamente, así que
	// navegamos al listado de inmediato.
	function onGastoBorrado() {
		goto('/gastos');
	}
</script>

<div class="flex flex-col px-5 py-6 md:px-8 lg:h-full lg:w-full lg:flex-1 lg:min-h-0">
	<a
		href="/gastos"
		class="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-text"
	>
		<ArrowLeft size={16} />
		Volver
	</a>

	<div class="mt-4 flex-1 lg:min-h-0">
		<GastoDetalle gasto={data.gasto} {onGastoBorrado} />
	</div>
</div>
