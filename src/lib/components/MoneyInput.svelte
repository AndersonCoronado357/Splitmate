<script lang="ts">
	// Input de dinero con separador de miles automático (300000 → "300.000")
	// y bindable a número. Internamente el value es number|null; lo que se
	// muestra es el texto formateado. Cuando se envía el form, mete un hidden
	// con el número crudo bajo el `name` indicado.
	import { untrack } from 'svelte';

	let {
		value = $bindable<number | null>(null),
		placeholder = '0',
		disabled = false,
		name = undefined,
		id = undefined,
		max = undefined,
		min = 0,
		class: classExt = '',
		required = false
	}: {
		value?: number | null;
		placeholder?: string;
		disabled?: boolean;
		name?: string;
		id?: string;
		max?: number;
		min?: number;
		class?: string;
		required?: boolean;
	} = $props();

	// Formateo manual (sin Intl con locale): es-CO usa '.' como separador de
	// miles. Lo aplicamos a mano para no depender del runtime.
	function formatThousands(n: number): string {
		if (!Number.isFinite(n)) return '';
		const s = String(Math.trunc(Math.abs(n)));
		const out = [];
		for (let i = 0; i < s.length; i++) {
			const distDesdeFin = s.length - i;
			if (i > 0 && distDesdeFin % 3 === 0) out.push('.');
			out.push(s[i]);
		}
		return (n < 0 ? '-' : '') + out.join('');
	}

	// Texto visible — se mantiene sincronizado con `value` desde afuera.
	let text = $state(value === null || value === undefined ? '' : formatThousands(value));

	// Si `value` cambia desde fuera (clamping del padre, reset, etc.) refrescamos
	// el texto. Solo cuando los dígitos no coinciden, para no pisar lo que el
	// usuario está escribiendo (untrack evita bucle infinito).
	$effect(() => {
		const v = value;
		untrack(() => {
			const expected = v === null || v === undefined ? '' : formatThousands(v);
			const actualDigits = text.replace(/\D/g, '');
			const expectedDigits = v === null || v === undefined ? '' : String(v);
			if (actualDigits !== expectedDigits) {
				text = expected;
			}
		});
	});

	function onInput(e: Event) {
		const t = (e.target as HTMLInputElement).value;
		const digits = t.replace(/\D/g, '');
		if (!digits) {
			value = null;
			text = '';
			return;
		}
		let n = parseInt(digits, 10);
		if (max !== undefined && n > max) n = max;
		if (n < min) n = min;
		value = n;
		text = formatThousands(n);
	}
</script>

<input
	{id}
	{disabled}
	{placeholder}
	{required}
	type="text"
	inputmode="numeric"
	value={text}
	oninput={onInput}
	class={'tabular ' + classExt}
/>
{#if name}
	<input type="hidden" {name} value={value === null || value === undefined ? '' : String(value)} />
{/if}
