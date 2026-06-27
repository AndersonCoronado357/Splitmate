<script lang="ts">
	import Menu from '@lucide/svelte/icons/menu';
	import HogarSwitcher from './HogarSwitcher.svelte';

	let { onAbrir }: { onAbrir?: () => void } = $props();
</script>

<header
	class="app-topbar sticky top-0 z-20 flex shrink-0 items-center gap-1 border-b border-border bg-surface px-2 py-2 lg:hidden"
>
	<button
		type="button"
		aria-label="Abrir menú"
		class="shrink-0 rounded-lg p-2 text-text transition-colors hover:bg-bg"
		onclick={onAbrir}
	>
		<Menu size={22} />
	</button>
	<div class="min-w-0 flex-1">
		<HogarSwitcher variant="topbar" />
	</div>
</header>
