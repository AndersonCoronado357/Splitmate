<script lang="ts">
	import ZoomIn from '@lucide/svelte/icons/zoom-in';

	let {
		archivo,
		onCancelar,
		onListo
	}: {
		archivo: File;
		onCancelar: () => void;
		onListo: (f: File) => void;
	} = $props();

	const C = 288; // tamaño del visor (px)
	const OUT = 512; // tamaño de salida (px)

	let url = $state('');
	let W = $state(0);
	let H = $state(0);
	let zoom = $state(1);
	let panX = $state(0);
	let panY = $state(0);
	let arrastrando = $state(false);
	let procesando = $state(false);
	let lastX = 0;
	let lastY = 0;

	const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

	// Cargar la imagen elegida y medir su tamaño natural.
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

	function onDown(e: PointerEvent) {
		arrastrando = true;
		lastX = e.clientX;
		lastY = e.clientY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}
	function onMove(e: PointerEvent) {
		if (!arrastrando) return;
		panX = clamp(panX + (e.clientX - lastX), halfX, -halfX);
		panY = clamp(panY + (e.clientY - lastY), halfY, -halfY);
		lastX = e.clientX;
		lastY = e.clientY;
	}
	function onUp() {
		arrastrando = false;
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
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
	role="dialog"
	aria-modal="true"
>
	<div class="animate-fade-in w-full max-w-sm rounded-modal bg-surface p-5 shadow-card">
		<h2 class="text-lg font-bold text-text">Ajusta tu foto</h2>
		<p class="mt-1 text-sm text-muted">Arrastra para mover y usa el control para acercar.</p>

		<!-- Visor circular -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="relative mx-auto mt-4 touch-none overflow-hidden rounded-full bg-bg select-none {arrastrando
				? 'cursor-grabbing'
				: 'cursor-grab'}"
			style="width:{C}px;height:{C}px;"
			onpointerdown={onDown}
			onpointermove={onMove}
			onpointerup={onUp}
			onpointercancel={onUp}
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
			<span
				class="pointer-events-none absolute inset-0 rounded-full ring-1 ring-black/10 ring-inset"
			></span>
		</div>

		<!-- Zoom -->
		<div class="mt-4 flex items-center gap-3">
			<ZoomIn size={18} class="shrink-0 text-muted" />
			<input
				type="range"
				min="1"
				max="3"
				step="0.01"
				bind:value={zoom}
				aria-label="Acercar"
				class="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-brand-50 accent-brand-500"
			/>
		</div>

		<div class="mt-5 flex gap-2">
			<button
				type="button"
				onclick={onCancelar}
				disabled={procesando}
				class="flex-1 rounded-input border border-border py-2.5 text-sm font-medium text-text transition-colors duration-200 ease-out hover:bg-bg disabled:opacity-60"
			>
				Cancelar
			</button>
			<button
				type="button"
				onclick={guardar}
				disabled={procesando || !W}
				class="flex-1 rounded-input bg-brand-500 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-out hover:bg-brand-700 active:scale-[0.99] disabled:opacity-60"
			>
				{procesando ? 'Guardando…' : 'Usar foto'}
			</button>
		</div>
	</div>
</div>
