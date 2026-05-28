<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';

	let {
		id,
		name = 'password',
		autocomplete = 'current-password',
		required = false,
		minlength = undefined,
		placeholder = '••••••••'
	}: {
		id: string;
		name?: string;
		autocomplete?: HTMLInputAttributes['autocomplete'];
		required?: boolean;
		minlength?: number;
		placeholder?: string;
	} = $props();

	let visible = $state(false);
</script>

<div class="relative">
	<input
		{id}
		{name}
		type={visible ? 'text' : 'password'}
		{autocomplete}
		{required}
		{minlength}
		{placeholder}
		class="w-full rounded-input border border-transparent bg-brand-50 px-3 py-2.5 pr-11 text-text outline-none placeholder:text-muted/70"
	/>
	<button
		type="button"
		onclick={() => (visible = !visible)}
		tabindex="-1"
		aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
		class="absolute inset-y-0 right-0 flex items-center px-3 text-muted transition-colors hover:text-text"
	>
		{#if visible}
			<EyeOff size={18} />
		{:else}
			<Eye size={18} />
		{/if}
	</button>
</div>
