<script lang="ts">
	import Menu from '@lucide/svelte/icons/menu';
	import favicon from '$lib/assets/favicon.svg';

	let { onAbrir }: { onAbrir?: () => void } = $props();
</script>

<header
	class="flex shrink-0 items-center gap-3 border-b border-border bg-surface px-4 py-3 md:hidden"
>
	<button
		type="button"
		aria-label="Abrir menú"
		class="rounded-lg p-1.5 text-text transition-colors hover:bg-bg"
		onclick={onAbrir}
	>
		<Menu size={22} />
	</button>
	<a href="/" class="flex items-center gap-2">
		<img src={favicon} alt="" class="h-6 w-6" />
		<span class="font-bold text-text">Splitmate</span>
	</a>
</header>
