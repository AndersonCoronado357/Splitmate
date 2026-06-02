<script lang="ts">
	// Sparkline — gráfica de línea mini para meter en KPI cards y mostrar
	// la tendencia del valor en el período. Smooth curve (cardinal spline)
	// generada con un control point chico por segmento.

	let {
		valores,
		color = 'var(--color-brand-500)',
		width = 80,
		height = 24,
		conRelleno = true
	}: {
		valores: number[];
		color?: string;
		width?: number;
		height?: number;
		conRelleno?: boolean;
	} = $props();

	const path = $derived.by(() => {
		const vs = valores ?? [];
		if (vs.length === 0) return { linea: '', area: '' };
		const max = Math.max(...vs, 1);
		const min = Math.min(...vs, 0);
		const range = max - min || 1;
		const dx = vs.length > 1 ? width / (vs.length - 1) : 0;
		const puntos = vs.map((v, i) => {
			const x = i * dx;
			const y = height - ((v - min) / range) * (height - 2) - 1;
			return { x, y };
		});
		// Curva suave: smoothing entre puntos con control points
		let linea = `M ${puntos[0].x} ${puntos[0].y}`;
		for (let i = 1; i < puntos.length; i++) {
			const p0 = puntos[i - 1];
			const p1 = puntos[i];
			const cx = (p0.x + p1.x) / 2;
			linea += ` Q ${cx} ${p0.y}, ${cx} ${(p0.y + p1.y) / 2} T ${p1.x} ${p1.y}`;
		}
		const area = linea + ` L ${puntos[puntos.length - 1].x} ${height} L 0 ${height} Z`;
		return { linea, area };
	});

	const gradId = `spark-${Math.floor(Math.random() * 1e9)}`;
</script>

<svg
	viewBox="0 0 {width} {height}"
	width={width}
	height={height}
	preserveAspectRatio="none"
	class="block"
>
	{#if conRelleno}
		<defs>
			<linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
				<stop offset="0%" stop-color={color} stop-opacity="0.25" />
				<stop offset="100%" stop-color={color} stop-opacity="0" />
			</linearGradient>
		</defs>
		<path d={path.area} fill="url(#{gradId})" />
	{/if}
	<path d={path.linea} fill="none" stroke={color} stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
</svg>
