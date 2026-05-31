<script lang="ts">
	import Calendar from '@lucide/svelte/icons/calendar';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';

	let {
		value = $bindable(''),
		name = undefined,
		id = undefined,
		placeholder = 'Elige una fecha',
		disabled = false,
		min = undefined,
		max = undefined
	}: {
		value?: string; // YYYY-MM-DD
		name?: string;
		id?: string;
		placeholder?: string;
		disabled?: boolean;
		min?: string;
		max?: string;
	} = $props();

	const MESES = [
		'enero',
		'febrero',
		'marzo',
		'abril',
		'mayo',
		'junio',
		'julio',
		'agosto',
		'septiembre',
		'octubre',
		'noviembre',
		'diciembre'
	];
	const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

	// Helpers para no depender de zonas horarias (usamos componentes locales).
	function parseIso(iso: string): { y: number; m: number; d: number } | null {
		const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
		if (!m) return null;
		return { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) };
	}
	function pad(n: number) {
		return String(n).padStart(2, '0');
	}
	function toIso(y: number, m: number, d: number) {
		return `${y}-${pad(m + 1)}-${pad(d)}`;
	}
	const hoyDate = new Date();
	const hoyIso = toIso(hoyDate.getFullYear(), hoyDate.getMonth(), hoyDate.getDate());

	// Mes/año visibles en el popover (independiente del value). El valor inicial
	// se captura una sola vez al montar; después abrir() lo reposiciona al value.
	const _ini = parseIso(value) ?? parseIso(hoyIso)!;
	let visAnio = $state(_ini.y);
	let visMes = $state(_ini.m);

	let abierto = $state(false);
	let raiz = $state<HTMLDivElement>();
	let triggerEl = $state<HTMLButtonElement>();
	let haciaArriba = $state(false);

	// Cuando se abre, reposicionar visMes/Año en el value (o en hoy).
	function abrir() {
		if (disabled || abierto) return;
		const p = parseIso(value) ?? parseIso(hoyIso)!;
		visAnio = p.y;
		visMes = p.m;
		// Decide arriba/abajo según espacio disponible.
		const r = triggerEl!.getBoundingClientRect();
		const abajo = window.innerHeight - r.bottom;
		const arriba = r.top;
		haciaArriba = abajo < 360 && arriba > abajo;
		abierto = true;
	}
	function cerrar() {
		abierto = false;
	}

	function mesAnt() {
		if (visMes === 0) {
			visMes = 11;
			visAnio -= 1;
		} else visMes -= 1;
	}
	function mesSig() {
		if (visMes === 11) {
			visMes = 0;
			visAnio += 1;
		} else visMes += 1;
	}

	function elegir(d: number) {
		value = toIso(visAnio, visMes, d);
		cerrar();
		triggerEl?.focus();
	}

	// Celdas visibles del mes (6 filas x 7 = 42 celdas, con borde de meses
	// adyacentes para completar el grid).
	type Celda = { y: number; m: number; d: number; mesActual: boolean };
	const celdas = $derived.by<Celda[]>(() => {
		const primerDia = new Date(visAnio, visMes, 1);
		// JS: 0=domingo. Queremos lunes como primer día (0 = lunes).
		const offset = (primerDia.getDay() + 6) % 7;
		const ultimoDia = new Date(visAnio, visMes + 1, 0).getDate();
		const ultimoMesAntes = new Date(visAnio, visMes, 0).getDate();

		const out: Celda[] = [];
		// Trailing del mes anterior (greys).
		for (let i = offset - 1; i >= 0; i--) {
			const d = ultimoMesAntes - i;
			const y = visMes === 0 ? visAnio - 1 : visAnio;
			const m = visMes === 0 ? 11 : visMes - 1;
			out.push({ y, m, d, mesActual: false });
		}
		// Mes actual.
		for (let d = 1; d <= ultimoDia; d++) {
			out.push({ y: visAnio, m: visMes, d, mesActual: true });
		}
		// Leading del mes siguiente para completar 42.
		let dd = 1;
		while (out.length < 42) {
			const y = visMes === 11 ? visAnio + 1 : visAnio;
			const m = visMes === 11 ? 0 : visMes + 1;
			out.push({ y, m, d: dd++, mesActual: false });
		}
		return out;
	});

	function esDeshabilitada(c: Celda) {
		const iso = toIso(c.y, c.m, c.d);
		if (min && iso < min) return true;
		if (max && iso > max) return true;
		return false;
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
		}
	}
	function onWindowClick(e: MouseEvent) {
		if (abierto && raiz && !raiz.contains(e.target as Node)) cerrar();
	}

	// Texto mostrado en el trigger.
	const textoBoton = $derived.by(() => {
		const p = parseIso(value);
		if (!p) return placeholder;
		const f = new Date(p.y, p.m, p.d);
		return f.toLocaleDateString('es-CO', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	});

	function esHoy(c: Celda) {
		return toIso(c.y, c.m, c.d) === hoyIso;
	}
	function esSeleccionada(c: Celda) {
		return toIso(c.y, c.m, c.d) === value;
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
		aria-haspopup="dialog"
		aria-expanded={abierto}
		class={'flex w-full items-center justify-between gap-2 rounded-input border border-transparent bg-brand-50 px-3 py-2.5 text-left text-text outline-none disabled:opacity-60 ' +
			(abierto ? (haciaArriba ? 'rounded-t-none' : 'rounded-b-none') : '')}
	>
		<span class={value ? '' : 'text-muted/70'}>{textoBoton}</span>
		<Calendar size={18} class="shrink-0 text-muted" />
	</button>

	{#if abierto}
		<div
			role="dialog"
			class={'absolute left-0 z-50 w-full min-w-[18rem] rounded-input border border-border bg-surface p-3 shadow-card ' +
				(haciaArriba
					? 'bottom-full -mb-px rounded-b-none'
					: 'top-full -mt-px rounded-t-none')}
		>
			<!-- Cabecera mes/año + flechas -->
			<div class="flex items-center justify-between gap-1">
				<button
					type="button"
					onclick={mesAnt}
					class="grid size-8 place-items-center rounded-input text-muted transition-colors hover:bg-brand-50 hover:text-brand-700"
					aria-label="Mes anterior"
				>
					<ChevronLeft size={18} />
				</button>
				<p class="flex-1 text-center text-sm font-semibold text-text capitalize">
					{MESES[visMes]}
					{visAnio}
				</p>
				<button
					type="button"
					onclick={mesSig}
					class="grid size-8 place-items-center rounded-input text-muted transition-colors hover:bg-brand-50 hover:text-brand-700"
					aria-label="Mes siguiente"
				>
					<ChevronRight size={18} />
				</button>
			</div>

			<!-- Cabecera días de la semana -->
			<div class="mt-2 grid grid-cols-7 gap-0.5 text-center text-xs font-medium text-muted">
				{#each DIAS as d (d)}
					<span class="py-1">{d}</span>
				{/each}
			</div>

			<!-- Grid del mes -->
			<div class="mt-0.5 grid grid-cols-7 gap-0.5">
				{#each celdas as c (`${c.y}-${c.m}-${c.d}`)}
					{@const sel = esSeleccionada(c)}
					{@const hoy = esHoy(c)}
					{@const inactivo = !c.mesActual}
					{@const off = esDeshabilitada(c)}
					<button
						type="button"
						disabled={off}
						onclick={() => elegir(c.d)}
						class={'grid h-9 place-items-center rounded-input text-sm transition-colors ' +
							(sel
								? 'bg-brand-500 font-semibold text-white'
								: hoy
									? 'bg-brand-50 font-semibold text-brand-700'
									: inactivo
										? 'text-muted/50 hover:bg-bg'
										: 'text-text hover:bg-brand-50') +
							(off ? ' opacity-30 pointer-events-none' : '')}
					>
						{c.d}
					</button>
				{/each}
			</div>

			<!-- Botón "Hoy" para volver rápido -->
			<div class="mt-2 flex justify-between border-t border-border pt-2">
				<button
					type="button"
					onclick={() => {
						const p = parseIso(hoyIso)!;
						visAnio = p.y;
						visMes = p.m;
					}}
					class="rounded-input px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-brand-50 hover:text-brand-700"
				>
					Hoy
				</button>
				<button
					type="button"
					onclick={cerrar}
					class="rounded-input px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-brand-50 hover:text-brand-700"
				>
					Cerrar
				</button>
			</div>
		</div>
	{/if}
</div>
