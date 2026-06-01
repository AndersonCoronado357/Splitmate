<script lang="ts">
	// Input de dinero con separador de miles automático (300000 → "300.000")
	// y bindable a número entero. Internamente el value es siempre un entero
	// (en COP no usamos centavos) — si llega un float desde afuera, lo
	// redondeamos. Cuando se envía el form, mete un hidden con el número
	// crudo bajo el `name` indicado.
	//
	// Sync del DOM: NO confiamos en la reactividad de Svelte para refrescar
	// el `<input>`. Si el usuario tipea pasado el `max` y nosotros recortamos
	// `text` al mismo valor que tenía, Svelte no diff-ea y el DOM se queda
	// con lo que tecleó el usuario (p. ej. "3.7048" cuando max=3704). Por eso
	// tomamos referencia al input y le seteamos `inputEl.value` a mano cada
	// vez que la representación cambia. Misma técnica para cuando el `value`
	// llega desde fuera (clamp del padre, reset, decimales del server).
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

	// Devuelve el entero permitido para un número crudo: lo redondea, lo
	// recorta al `max` (truncando hacia abajo por seguridad) y respeta el `min`.
	function clamp(n: number): number {
		if (!Number.isFinite(n)) return min;
		let r = Math.round(n);
		if (max !== undefined && r > Math.floor(max)) r = Math.floor(max);
		if (r < min) r = min;
		return r;
	}

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

	function renderFrom(v: number | null | undefined): string {
		if (v === null || v === undefined) return '';
		return formatThousands(clamp(v));
	}

	// Texto visible — Svelte usa esto para el `value={text}` inicial; los
	// updates en caliente los hacemos directo sobre el input para evitar
	// el problema del diff.
	let text = $state(renderFrom(value));
	let inputEl: HTMLInputElement | null = $state(null);

	// Si `value` cambia desde fuera (clamping del padre, reset, decimales
	// recibidos del server) lo redondeamos y forzamos el DOM al texto correcto.
	$effect(() => {
		const v = value;
		untrack(() => {
			if (v === null || v === undefined) {
				text = '';
				if (inputEl && inputEl.value !== '') inputEl.value = '';
				return;
			}
			const entero = clamp(v);
			if (v !== entero) {
				// Snap a entero si llegó un float (3.7039999... → 4) o si excedía max.
				value = entero;
				return; // el efecto re-correrá con el value nuevo.
			}
			const formatted = formatThousands(entero);
			text = formatted;
			if (inputEl && inputEl.value !== formatted) inputEl.value = formatted;
		});
	});

	function onInput(e: Event) {
		const target = e.currentTarget as HTMLInputElement;
		const digits = target.value.replace(/\D/g, '');
		if (!digits) {
			value = null;
			text = '';
			if (target.value !== '') target.value = '';
			return;
		}
		const n = clamp(parseInt(digits, 10));
		const formatted = formatThousands(n);
		value = n;
		text = formatted;
		// Forzamos el DOM aunque `text` no haya cambiado: el usuario podría
		// haber tecleado dígitos extra que pasaron el `max` y necesitamos
		// borrarlos visualmente.
		if (target.value !== formatted) {
			target.value = formatted;
			// Cursor al final, para que tipear "888" cuando ya estás en max
			// no te deje el cursor en una posición rara.
			const len = formatted.length;
			try {
				target.setSelectionRange(len, len);
			} catch {
				/* algunos tipos de input no soportan selección — ignorar */
			}
		}
	}
</script>

<input
	bind:this={inputEl}
	{id}
	{disabled}
	{placeholder}
	{required}
	type="text"
	inputmode="numeric"
	autocomplete="off"
	autocorrect="off"
	autocapitalize="off"
	spellcheck="false"
	value={text}
	oninput={onInput}
	class={'tabular ' + classExt}
/>
{#if name}
	<input type="hidden" {name} value={value === null || value === undefined ? '' : String(value)} />
{/if}
