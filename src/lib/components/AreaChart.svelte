<script lang="ts">
	// Gráfica de área suave con eje Y y grid.
	//   - UN color de marca, sin paletas.
	//   - Eje Y a la izquierda con 4 ticks formateados (k / M).
	//   - Padding lateral generoso cuando hay pocos puntos (no se pegan al borde).
	//   - Hover: dot sólido brand-500 sin centro blanco + línea guía discontinua.
	//   - Click en un punto lo deja seleccionado (mes elegido). Click de nuevo
	//     en el mismo punto lo limpia.

	type Punto = { etiqueta: string; valor: number; etiquetaCorta?: string; valorTexto?: string };

	let {
		puntos,
		altura = 160,
		mostrarLabels = true,
		ptoActivoIdx = $bindable<number | null>(null),
		ptoSeleccionadoIdx = $bindable<number | null>(null),
		onClickPunto = undefined
	}: {
		puntos: Punto[];
		altura?: number;
		mostrarLabels?: boolean;
		ptoActivoIdx?: number | null; // hover
		ptoSeleccionadoIdx?: number | null; // click (persistente)
		onClickPunto?: (idx: number | null) => void;
	} = $props();

	const W = 600;
	const H = 200;
	const PAD_Y = 14;
	const PAD_LEFT_AXIS = 48; // espacio para los labels del eje Y
	const PAD_RIGHT = 8;

	// Padding horizontal dentro del área de dibujo: si hay pocos puntos
	// les damos margen para que no queden pegados al borde.
	const PAD_X_INTERNO = $derived.by(() => {
		const n = puntos.length;
		if (n <= 1) return 0;
		if (n === 2) return (W - PAD_LEFT_AXIS - PAD_RIGHT) * 0.22;
		if (n === 3) return (W - PAD_LEFT_AXIS - PAD_RIGHT) * 0.12;
		return 8;
	});

	const max = $derived(Math.max(...puntos.map((p) => p.valor), 1));

	type Pto = { x: number; y: number };
	const ptos = $derived.by<Pto[]>(() => {
		const n = puntos.length;
		if (n === 0) return [];
		const usableW = W - PAD_LEFT_AXIS - PAD_RIGHT - 2 * PAD_X_INTERNO;
		const x0 = PAD_LEFT_AXIS + PAD_X_INTERNO;
		if (n === 1) return [{ x: x0 + usableW / 2, y: H / 2 }];
		const dx = usableW / (n - 1);
		return puntos.map((p, i) => ({
			x: x0 + i * dx,
			y: PAD_Y + (H - 2 * PAD_Y) - (p.valor / max) * (H - 2 * PAD_Y)
		}));
	});

	const path = $derived.by(() => {
		if (ptos.length === 0) return { linea: '', area: '' };
		if (ptos.length === 1) {
			const p = ptos[0];
			return { linea: `M ${PAD_LEFT_AXIS} ${p.y} L ${W - PAD_RIGHT} ${p.y}`, area: '' };
		}
		let linea = `M ${ptos[0].x} ${ptos[0].y}`;
		for (let i = 1; i < ptos.length; i++) {
			const p0 = ptos[i - 1];
			const p1 = ptos[i];
			const cx = (p0.x + p1.x) / 2;
			linea += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
		}
		const area = linea + ` L ${ptos[ptos.length - 1].x} ${H - PAD_Y} L ${ptos[0].x} ${H - PAD_Y} Z`;
		return { linea, area };
	});

	// Etiquetas del eje X: primera, última, y la del valor máximo si no coincide.
	const idxMax = $derived.by(() => {
		let idx = 0;
		let v = -Infinity;
		for (let i = 0; i < puntos.length; i++) {
			if (puntos[i].valor > v) {
				v = puntos[i].valor;
				idx = i;
			}
		}
		return idx;
	});
	const labelsXVisibles = $derived.by<Set<number>>(() => {
		const s = new Set<number>();
		if (puntos.length > 0) s.add(0);
		if (puntos.length > 1) s.add(puntos.length - 1);
		if (puntos.length > 2 && idxMax !== 0 && idxMax !== puntos.length - 1) s.add(idxMax);
		return s;
	});

	// Eje Y: 4 ticks (0, max/3, max*2/3, max).
	function compactNum(n: number): string {
		if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + 'M';
		if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + 'k';
		return Math.round(n).toString();
	}
	const ticksY = $derived([
		{ pct: 0, label: compactNum(max) },
		{ pct: 33.33, label: compactNum((max * 2) / 3) },
		{ pct: 66.66, label: compactNum(max / 3) },
		{ pct: 100, label: '0' }
	]);
	// Las grid lines en coords SVG:
	const gridLinesY = $derived(
		[0, 1 / 3, 2 / 3, 1].map((t) => PAD_Y + (H - 2 * PAD_Y) * t)
	);

	let svgEl: SVGSVGElement | null = $state(null);

	function idxDesdeEvento(e: PointerEvent | MouseEvent): number | null {
		if (!svgEl || ptos.length === 0) return null;
		const rect = svgEl.getBoundingClientRect();
		const xViewBox = ((e.clientX - rect.left) / rect.width) * W;
		let mejor = 0;
		let dMin = Infinity;
		for (let i = 0; i < ptos.length; i++) {
			const d = Math.abs(ptos[i].x - xViewBox);
			if (d < dMin) {
				dMin = d;
				mejor = i;
			}
		}
		return mejor;
	}

	function onMove(e: PointerEvent) {
		ptoActivoIdx = idxDesdeEvento(e);
	}
	function onLeave() {
		ptoActivoIdx = null;
	}
	function onClickSvg(e: MouseEvent) {
		if (!onClickPunto) return;
		const idx = idxDesdeEvento(e);
		if (idx === null) return;
		// Toggle: si ya está seleccionado, lo limpia.
		const nuevo = ptoSeleccionadoIdx === idx ? null : idx;
		ptoSeleccionadoIdx = nuevo;
		onClickPunto(nuevo);
	}

	// Punto a resaltar: hover > seleccionado > último.
	const dotIdx = $derived.by(() => {
		if (ptoActivoIdx !== null) return ptoActivoIdx;
		if (ptoSeleccionadoIdx !== null) return ptoSeleccionadoIdx;
		if (ptos.length > 0) return ptos.length - 1;
		return null;
	});
</script>

<div class="relative">
	<!-- Labels del eje Y (HTML overlay para tipografía nítida) -->
	<div class="pointer-events-none absolute inset-y-0 left-0" style="width: {(PAD_LEFT_AXIS / W) * 100}%; height: {altura}px;">
		{#each ticksY as t (t.label)}
			<span
				class="tabular absolute right-1 text-[10px] font-medium text-muted"
				style="top: {(PAD_Y + ((H - 2 * PAD_Y) * t.pct) / 100) / H * 100}%; transform: translateY(-50%);"
			>
				{t.label}
			</span>
		{/each}
	</div>

	<svg
		bind:this={svgEl}
		viewBox="0 0 {W} {H}"
		preserveAspectRatio="none"
		class="block w-full select-none"
		style="height: {altura}px"
		aria-hidden="true"
		onpointermove={onMove}
		onpointerleave={onLeave}
		onclick={onClickSvg}
		role="presentation"
	>
		<defs>
			<linearGradient id="area-grad" x1="0" x2="0" y1="0" y2="1">
				<stop offset="0%" stop-color="var(--color-brand-500)" stop-opacity="0.22" />
				<stop offset="100%" stop-color="var(--color-brand-500)" stop-opacity="0" />
			</linearGradient>
		</defs>

		<!-- Grid horizontal -->
		{#each gridLinesY as y, i (i)}
			<line
				x1={PAD_LEFT_AXIS}
				x2={W - PAD_RIGHT}
				y1={y}
				y2={y}
				stroke="var(--color-border)"
				stroke-width="1"
				vector-effect="non-scaling-stroke"
			/>
		{/each}

		<!-- Banda spotlight: rectángulo tenue brand-500 detrás del mes seleccionado.
		     Es lo que da el "estás viendo ESTE mes" sin necesidad de leer texto. -->
		{#if ptoSeleccionadoIdx !== null && ptos[ptoSeleccionadoIdx] && ptos.length > 1}
			{@const p = ptos[ptoSeleccionadoIdx]}
			{@const dx = ptos.length > 1 ? ptos[1].x - ptos[0].x : 40}
			<rect
				x={p.x - dx / 2}
				y={PAD_Y}
				width={dx}
				height={H - 2 * PAD_Y}
				fill="var(--color-brand-500)"
				opacity="0.08"
				style="transition: x 180ms ease-out;"
			/>
		{/if}

		{#if path.area}
			<path
				d={path.area}
				fill="url(#area-grad)"
				style="transition: opacity 200ms ease-out; opacity: {ptoSeleccionadoIdx !== null ? 0.3 : 1};"
			/>
		{/if}
		<path
			d={path.linea}
			fill="none"
			stroke="var(--color-brand-500)"
			stroke-width="2"
			stroke-linejoin="round"
			stroke-linecap="round"
			vector-effect="non-scaling-stroke"
			style="transition: opacity 200ms ease-out; opacity: {ptoSeleccionadoIdx !== null ? 0.4 : 1};"
		/>

		<!-- Línea guía vertical: persistente si hay seleccionado, transitoria si solo hay hover -->
		{#if ptoSeleccionadoIdx !== null && ptos[ptoSeleccionadoIdx]}
			{@const p = ptos[ptoSeleccionadoIdx]}
			<line
				x1={p.x}
				x2={p.x}
				y1={PAD_Y}
				y2={H - PAD_Y}
				stroke="var(--color-brand-500)"
				stroke-width="1.5"
				stroke-dasharray="4 3"
				vector-effect="non-scaling-stroke"
			/>
		{:else if ptoActivoIdx !== null && ptos[ptoActivoIdx]}
			{@const p = ptos[ptoActivoIdx]}
			<line
				x1={p.x}
				x2={p.x}
				y1={PAD_Y}
				y2={H - PAD_Y}
				stroke="var(--color-brand-500)"
				stroke-width="1"
				stroke-dasharray="3 3"
				vector-effect="non-scaling-stroke"
				opacity="0.45"
			/>
		{/if}

		<!-- Dots: punto activo / seleccionado / último — siempre finos -->
		{#if dotIdx !== null && ptos[dotIdx]}
			{@const p = ptos[dotIdx]}
			{@const esSeleccionado = ptoSeleccionadoIdx === dotIdx}
			{@const esHover = ptoActivoIdx === dotIdx}
			{#if esSeleccionado}
				<circle cx={p.x} cy={p.y} r="6" fill="var(--color-brand-500)" opacity="0.18" />
				<circle cx={p.x} cy={p.y} r="3.5" fill="var(--color-brand-500)" />
			{:else if esHover}
				<circle cx={p.x} cy={p.y} r="3.5" fill="var(--color-brand-500)" />
			{:else}
				<circle cx={p.x} cy={p.y} r="2.5" fill="var(--color-brand-500)" />
			{/if}
		{/if}
	</svg>

	<!-- Tooltip anclado al punto activo. NO sigue al cursor literal: salta
	     limpio de un punto al siguiente con transición CSS. Muestra el
	     hover si hay, sino el seleccionado. -->
	{#if (ptoActivoIdx ?? ptoSeleccionadoIdx) !== null}
		{@const tipIdx = (ptoActivoIdx ?? ptoSeleccionadoIdx) as number}
		{#if ptos[tipIdx] && puntos[tipIdx]}
			{@const p = ptos[tipIdx]}
			{@const dato = puntos[tipIdx]}
			{@const xPct = (p.x / W) * 100}
			{@const yPx = (p.y / H) * altura}
			<div
				class="pointer-events-none absolute z-10 rounded-input border border-border bg-surface px-2.5 py-1.5 shadow-card"
				style="left: {xPct}%; top: {yPx}px; transform: translate(-50%, calc(-100% - 14px)); transition: left 160ms ease-out, top 160ms ease-out;"
			>
				<p class="whitespace-nowrap text-[10px] font-medium capitalize text-muted">
					{dato.etiqueta}
				</p>
				<p class="tabular whitespace-nowrap text-xs font-bold text-text">
					{dato.valorTexto ?? dato.valor.toLocaleString('es-CO')}
				</p>
			</div>
		{/if}
	{/if}

	{#if mostrarLabels && puntos.length > 1}
		<div class="relative mt-1 h-4" style="margin-left: {(PAD_LEFT_AXIS / W) * 100}%;">
			{#each puntos as p, i (p.etiqueta)}
				{#if labelsXVisibles.has(i)}
					{@const usableW = W - PAD_LEFT_AXIS - PAD_RIGHT - 2 * PAD_X_INTERNO}
					{@const x = PAD_X_INTERNO + (puntos.length > 1 ? (i * usableW) / (puntos.length - 1) : usableW / 2)}
					{@const xPct = (x / (W - PAD_LEFT_AXIS)) * 100}
					<span
						class="absolute top-0 text-[10px] font-medium capitalize text-muted"
						style="left: {xPct}%; transform: translateX({i === 0 ? '0%' : i === puntos.length - 1 ? '-100%' : '-50%'});"
					>
						{p.etiquetaCorta ?? p.etiqueta}
					</span>
				{/if}
			{/each}
		</div>
	{/if}
</div>
