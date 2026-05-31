<!--
	Recortador de avatar — UX estilo apps pro:
	 - Visor circular limpio.
	 - Zoom SIN slider: rueda del mouse en desktop, pellizco en táctil.
	 - Drag para encuadrar.
	 - Grid de tercios + cruz central, visible SOLO mientras se interactúa
	   (drag, pinch o rueda).
-->
<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import Check from '@lucide/svelte/icons/check';
	import LocateFixed from '@lucide/svelte/icons/locate-fixed';

	let {
		archivo,
		onCancelar,
		onListo
	}: {
		archivo: File;
		onCancelar: () => void;
		onListo: (f: File) => void;
	} = $props();

	const C = 320; // diámetro del visor (px)
	const OUT = 512; // imagen exportada (px × px)

	let url = $state('');
	let W = $state(0);
	let H = $state(0);
	let zoom = $state(1);
	let panX = $state(0);
	let panY = $state(0);
	let procesando = $state(false);

	const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

	$effect(() => {
		const u = URL.createObjectURL(archivo);
		url = u;
		zoom = 1;
		panX = 0;
		panY = 0;
		const img = new Image();
		img.onload = () => {
			W = img.naturalWidth;
			H = img.naturalHeight;
		};
		img.src = u;
		return () => URL.revokeObjectURL(u);
	});

	const coverScale = $derived(W && H ? Math.max(C / W, C / H) : 1);
	const drawScale = $derived(coverScale * zoom);
	const dispW = $derived(W * drawScale);
	const dispH = $derived(H * drawScale);
	const halfX = $derived((C - dispW) / 2);
	const halfY = $derived((C - dispH) / 2);
	const panXc = $derived(clamp(panX, halfX, -halfX));
	const panYc = $derived(clamp(panY, halfY, -halfY));
	const imgLeft = $derived(halfX + panXc);
	const imgTop = $derived(halfY + panYc);

	// === Interacción: drag + pinch + wheel =================================
	type Punto = { id: number; x: number; y: number };
	let punteros = $state<Punto[]>([]);
	let lastX = 0;
	let lastY = 0;
	let pinchDist = 0;
	let pinchZoom = 1;

	// Grid solo visible mientras se mueve / zoomea, luego se desvanece.
	let guiaVisible = $state(false);
	let timerGuia: ReturnType<typeof setTimeout> | null = null;
	function tocarGuia() {
		guiaVisible = true;
		if (timerGuia) clearTimeout(timerGuia);
		timerGuia = setTimeout(() => {
			guiaVisible = false;
		}, 700);
	}

	function dist(a: Punto, b: Punto) {
		return Math.hypot(a.x - b.x, a.y - b.y);
	}

	function onDown(e: PointerEvent) {
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		punteros = [...punteros, { id: e.pointerId, x: e.clientX, y: e.clientY }];
		if (punteros.length === 1) {
			lastX = e.clientX;
			lastY = e.clientY;
		} else if (punteros.length === 2) {
			pinchDist = dist(punteros[0], punteros[1]);
			pinchZoom = zoom;
		}
		tocarGuia();
	}
	function onMove(e: PointerEvent) {
		const idx = punteros.findIndex((p) => p.id === e.pointerId);
		if (idx === -1) return;
		punteros[idx] = { id: e.pointerId, x: e.clientX, y: e.clientY };
		punteros = [...punteros];

		if (punteros.length === 1) {
			panX = clamp(panX + (e.clientX - lastX), halfX, -halfX);
			panY = clamp(panY + (e.clientY - lastY), halfY, -halfY);
			lastX = e.clientX;
			lastY = e.clientY;
		} else if (punteros.length === 2) {
			const d = dist(punteros[0], punteros[1]);
			if (pinchDist > 0) zoom = clamp(pinchZoom * (d / pinchDist), 1, 3);
		}
		tocarGuia();
	}
	function onUp(e: PointerEvent) {
		punteros = punteros.filter((p) => p.id !== e.pointerId);
		if (punteros.length === 1) {
			lastX = punteros[0].x;
			lastY = punteros[0].y;
		}
		tocarGuia();
	}

	function onWheel(e: WheelEvent) {
		// Rueda hacia arriba (deltaY<0) → acercar; abajo → alejar.
		e.preventDefault();
		const factor = e.deltaY > 0 ? 0.94 : 1.06;
		zoom = clamp(zoom * factor, 1, 3);
		tocarGuia();
	}

	async function guardar() {
		procesando = true;
		try {
			const img = new Image();
			img.src = url;
			await img.decode().catch(() => {});
			const canvas = document.createElement('canvas');
			canvas.width = OUT;
			canvas.height = OUT;
			const ctx = canvas.getContext('2d');
			if (!ctx) {
				procesando = false;
				return;
			}
			ctx.fillStyle = '#ffffff';
			ctx.fillRect(0, 0, OUT, OUT);
			const s = OUT / C;
			ctx.drawImage(img, imgLeft * s, imgTop * s, dispW * s, dispH * s);
			canvas.toBlob(
				(blob) => {
					if (!blob) {
						procesando = false;
						return;
					}
					onListo(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
				},
				'image/jpeg',
				0.9
			);
		} catch {
			procesando = false;
		}
	}

	function onTeclaCerrar(e: KeyboardEvent) {
		if (e.key === 'Escape' && !procesando) onCancelar();
	}

	// Resetea pan y zoom para que la imagen vuelva a quedar centrada al tamaño
	// original (cover sin acercamiento).
	function centrar() {
		zoom = 1;
		panX = 0;
		panY = 0;
		tocarGuia();
	}
</script>

<svelte:window onkeydown={onTeclaCerrar} />

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-text/60 p-4"
	role="dialog"
	aria-modal="true"
	aria-label="Ajustar foto de perfil"
>
	<div
		class="animate-fade-in flex w-full max-w-md flex-col overflow-hidden rounded-modal bg-surface shadow-2xl"
	>
		<!-- Header -->
		<header class="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
			<div class="min-w-0">
				<h2 class="text-base font-bold text-text">Ajusta tu foto</h2>
				<p class="mt-0.5 text-xs text-muted">
					Arrastra para encuadrar · rueda o pellizca para zoom
				</p>
			</div>
			<button
				type="button"
				onclick={onCancelar}
				disabled={procesando}
				class="flex size-8 shrink-0 items-center justify-center rounded-input text-muted transition-colors hover:bg-bg hover:text-text disabled:opacity-50"
				aria-label="Cerrar"
			>
				<X size={18} />
			</button>
		</header>

		<!-- Visor circular limpio -->
		<div class="flex flex-col items-center gap-3 bg-bg px-6 py-6">
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="relative touch-none overflow-hidden rounded-full bg-text/95 select-none ring-1 ring-black/10 {punteros.length >
				0
					? 'cursor-grabbing'
					: 'cursor-grab'}"
				style="width:{C}px;height:{C}px;max-width:100%;aspect-ratio:1;"
				onpointerdown={onDown}
				onpointermove={onMove}
				onpointerup={onUp}
				onpointercancel={onUp}
				onwheel={onWheel}
			>
				{#if url}
					<img
						src={url}
						alt=""
						draggable="false"
						class="pointer-events-none absolute max-w-none select-none"
						style="width:{dispW}px;height:{dispH}px;left:{imgLeft}px;top:{imgTop}px;"
					/>
				{/if}

				<!-- Guías estilo pro: grid de tercios + cruz central. Aparecen al
				     interactuar y se desvanecen al rato. -->
				<div
					class={'pointer-events-none absolute inset-0 transition-opacity duration-300 ' +
						(guiaVisible ? 'opacity-100' : 'opacity-0')}
				>
					<!-- Líneas verticales (1/3, 2/3) -->
					<div class="absolute top-0 bottom-0 left-1/3 w-px bg-white/45"></div>
					<div class="absolute top-0 bottom-0 left-2/3 w-px bg-white/45"></div>
					<!-- Líneas horizontales (1/3, 2/3) -->
					<div class="absolute right-0 left-0 top-1/3 h-px bg-white/45"></div>
					<div class="absolute right-0 left-0 top-2/3 h-px bg-white/45"></div>
					<!-- Cruz central -->
					<div
						class="absolute top-1/2 left-1/2 size-3 -translate-x-1/2 -translate-y-1/2"
						aria-hidden="true"
					>
						<div class="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-white/70"></div>
						<div class="absolute top-0 left-1/2 h-full w-px -translate-x-1/2 bg-white/70"></div>
					</div>
				</div>

				<!-- Anillo interior sutil -->
				<div
					class="pointer-events-none absolute inset-0 rounded-full ring-1 ring-white/15 ring-inset"
				></div>
			</div>

			<!-- Botón centrar (resetea pan + zoom) -->
			<button
				type="button"
				onclick={centrar}
				disabled={zoom === 1 && panX === 0 && panY === 0}
				class="inline-flex items-center gap-1.5 rounded-input px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-brand-50 hover:text-brand-700 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted"
			>
				<LocateFixed size={14} />
				Centrar
			</button>
		</div>

		<!-- Acciones -->
		<footer class="flex gap-2 border-t border-border bg-bg/40 px-6 py-4">
			<button
				type="button"
				onclick={onCancelar}
				disabled={procesando}
				class="flex h-11 flex-1 items-center justify-center rounded-input border border-border bg-surface text-sm font-semibold text-text transition-colors hover:bg-bg disabled:opacity-50"
			>
				Cancelar
			</button>
			<button
				type="button"
				onclick={guardar}
				disabled={procesando || !W}
				class="flex h-11 flex-[1.4] items-center justify-center gap-2 rounded-input bg-brand-500 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
			>
				{#if procesando}
					<span
						class="block size-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
					></span>
					Guardando…
				{:else}
					<Check size={16} strokeWidth={3} />
					Usar foto
				{/if}
			</button>
		</footer>
	</div>
</div>
