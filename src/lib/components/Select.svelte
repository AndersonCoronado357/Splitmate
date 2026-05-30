<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';

	type Opcion = { value: string; label: string };

	let {
		options,
		value = $bindable(''),
		placeholder = 'Selecciona…',
		name = undefined,
		id = undefined,
		disabled = false,
		onChange = undefined
	}: {
		options: Opcion[];
		value?: string;
		placeholder?: string;
		name?: string;
		id?: string;
		disabled?: boolean;
		onChange?: (value: string) => void;
	} = $props();

	let abierto = $state(false);
	let haciaArriba = $state(false);
	let resaltado = $state(-1);
	let raiz = $state<HTMLDivElement>();
	let triggerEl = $state<HTMLButtonElement>();

	const seleccionada = $derived(options.find((o) => o.value === value) ?? null);

	function abrir() {
		if (disabled || abierto) return;
		// Decide la dirección según el espacio disponible arriba/abajo.
		const r = triggerEl!.getBoundingClientRect();
		const abajo = window.innerHeight - r.bottom;
		const arriba = r.top;
		const alto = Math.min(288, options.length * 42 + 12);
		haciaArriba = abajo < alto && arriba > abajo;
		resaltado = Math.max(0, options.findIndex((o) => o.value === value));
		abierto = true;
	}
	function cerrar() {
		abierto = false;
	}
	function elegir(o: Opcion) {
		const cambio = o.value !== value;
		value = o.value;
		cerrar();
		triggerEl?.focus();
		if (cambio) onChange?.(o.value);
	}

	function onKey(e: KeyboardEvent) {
		if (disabled) return;
		if (!abierto) {
			if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
				e.preventDefault();
				abrir();
			}
			return;
		}
		if (e.key === 'Escape') {
			e.preventDefault();
			cerrar();
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			resaltado = (resaltado + 1) % options.length;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			resaltado = (resaltado - 1 + options.length) % options.length;
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (options[resaltado]) elegir(options[resaltado]);
		}
	}

	function onWindowClick(e: MouseEvent) {
		if (abierto && raiz && !raiz.contains(e.target as Node)) cerrar();
	}
</script>

<svelte:window onclick={onWindowClick} />

<div class="relative" bind:this={raiz}>
	{#if name}
		<input type="hidden" {name} value={value ?? ''} />
	{/if}

	<button
		type="button"
		{id}
		{disabled}
		bind:this={triggerEl}
		onclick={() => (abierto ? cerrar() : abrir())}
		onkeydown={onKey}
		aria-haspopup="listbox"
		aria-expanded={abierto}
		class={'flex w-full items-center justify-between gap-2 rounded-input border border-transparent bg-brand-50 px-3 py-2.5 text-left text-text outline-none disabled:opacity-60 ' +
			(abierto ? (haciaArriba ? 'rounded-t-none' : 'rounded-b-none') : '')}
	>
		<span class={seleccionada ? '' : 'text-muted/70'}>
			{seleccionada ? seleccionada.label : placeholder}
		</span>
		<ChevronDown
			size={18}
			class={'shrink-0 text-muted transition-transform duration-200 ' + (abierto ? 'rotate-180' : '')}
		/>
	</button>

	{#if abierto}
		<ul
			role="listbox"
			class={'absolute z-50 max-h-72 w-full overflow-auto rounded-input border border-border bg-surface shadow-card ' +
				(haciaArriba ? 'bottom-full -mb-px rounded-b-none' : 'top-full -mt-px rounded-t-none')}
		>
			{#each options as o, i (o.value)}
				<li role="option" aria-selected={o.value === value}>
					<button
						type="button"
						onclick={() => elegir(o)}
						onmouseenter={() => (resaltado = i)}
						class={'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors ' +
							(i === resaltado ? 'bg-brand-50 ' : '') +
							(o.value === value ? 'font-medium text-brand-700' : 'text-text')}
					>
						<span>{o.label}</span>
						{#if o.value === value}
							<Check size={16} class="shrink-0 text-brand-500" />
						{/if}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
