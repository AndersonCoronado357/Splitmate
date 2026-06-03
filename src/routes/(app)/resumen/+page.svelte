<script lang="ts">
	import { fade } from 'svelte/transition';
	import { page } from '$app/state';
	import { iconoCategoria } from '$lib/iconosCategoria';
	import AreaChart from '$lib/components/AreaChart.svelte';
	import ChartColumn from '@lucide/svelte/icons/chart-column';
	import Users from '@lucide/svelte/icons/users';
	import Tag from '@lucide/svelte/icons/tag';
	import TrendingUp from '@lucide/svelte/icons/trending-up';
	import TrendingDown from '@lucide/svelte/icons/trending-down';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Receipt from '@lucide/svelte/icons/receipt';
	import Repeat from '@lucide/svelte/icons/repeat';
	import HandCoins from '@lucide/svelte/icons/hand-coins';
	import ArrowRightLeft from '@lucide/svelte/icons/arrow-right-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import type { PageData } from './$types';
	import type { MovimientoCrudo, TipoMov } from '$lib/server/resumen';

	let { data }: { data: PageData } = $props();

	const yo = $derived((page.data.user as { id?: string } | undefined)?.id ?? '');
	type MiembroLayout = { userId: string; nombre: string; avatar: string | null };
	const miembrosLayout = $derived((page.data.miembros ?? []) as MiembroLayout[]);

	const fmt = $derived(
		new Intl.NumberFormat('es-CO', {
			style: 'currency',
			currency: data.moneda,
			maximumFractionDigits: 0
		})
	);
	const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
	const MESES_LARGO = [
		'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
		'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
	];
	function fmtMesAnio(iso: string) {
		const [a, m] = iso.split('-');
		return `${MESES_CORTO[parseInt(m, 10) - 1]} ${a}`;
	}

	// ============================================================
	// Estado local — todo client-side, sin URL.
	// ============================================================
	type Periodo = 'mes' | 'anterior' | 'tres' | 'anio' | 'todo';
	let periodo = $state<Periodo>('todo');
	let soloMio = $state(false);
	let mesElegido = $state<string | null>(null); // YYYY-MM (override del período por click en la gráfica)

	// Drill-down: categoría o persona seleccionada por click. Reemplaza
	// el contenido de la Row 2 con la lista de movimientos del item.
	type Seleccion =
		| { tipo: 'categoria'; clave: string; nombre: string; icono: string | null }
		| { tipo: 'persona'; clave: string; nombre: string; avatar: string | null }
		| null;
	let seleccion = $state<Seleccion>(null);

	function volverAlDashboard() {
		seleccion = null;
		mesElegido = null;
	}

	// Rango (desde/hasta) derivado del período seleccionado.
	const rangoPeriodo = $derived.by(() => {
		const hoy = new Date();
		const y = hoy.getFullYear();
		const m = hoy.getMonth() + 1;
		const pad = (n: number) => String(n).padStart(2, '0');
		const finDeMes = (anio: number, mes: number) => new Date(anio, mes, 0).getDate();
		if (periodo === 'mes') {
			return { desde: `${y}-${pad(m)}-01`, hasta: `${y}-${pad(m)}-${pad(finDeMes(y, m))}` };
		}
		if (periodo === 'anterior') {
			const ant = m === 1 ? { a: y - 1, m: 12 } : { a: y, m: m - 1 };
			return {
				desde: `${ant.a}-${pad(ant.m)}-01`,
				hasta: `${ant.a}-${pad(ant.m)}-${pad(finDeMes(ant.a, ant.m))}`
			};
		}
		if (periodo === 'tres') {
			const d = new Date(y, m - 1, 1);
			d.setMonth(d.getMonth() - 2);
			return {
				desde: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`,
				hasta: `${y}-${pad(m)}-${pad(finDeMes(y, m))}`
			};
		}
		if (periodo === 'anio') return { desde: `${y}-01-01`, hasta: `${y}-12-31` };
		return { desde: null as string | null, hasta: null as string | null };
	});

	const rangoTexto = $derived.by(() => {
		if (mesElegido) {
			const [a, m] = mesElegido.split('-').map((s) => parseInt(s, 10));
			return `${MESES_LARGO[m - 1]} ${a}`;
		}
		const { desde, hasta } = rangoPeriodo;
		if (!desde || !hasta) return 'Histórico completo';
		const fmtD = (iso: string) => {
			const [a, m, d] = iso.split('-').map((s) => parseInt(s, 10));
			return `${d} ${MESES_LARGO[m - 1]} ${a}`;
		};
		return `${fmtD(desde)} – ${fmtD(hasta)}`;
	});

	// ============================================================
	// Filtrado y agregación — todo client-side, instantáneo.
	//
	// movsPeriodo: SIEMPRE corresponde al rango del período (chips).
	// Es lo que alimenta a la gráfica (que nunca debe perder su forma
	// aunque se haya clickeado un mes específico).
	//
	// movsEnFoco: si hay un mes elegido en la gráfica, esto es el subset
	// de ese mes. Si no, es igual a movsPeriodo.
	// Lo usan los KPIs grandes — "qué pasa cuando hago zoom en ese mes".
	// ============================================================
	const movsPeriodo = $derived.by<MovimientoCrudo[]>(() => {
		const { desde, hasta } = rangoPeriodo;
		let lista = data.movimientos;
		if (desde) lista = lista.filter((m) => m.fecha >= desde);
		if (hasta) lista = lista.filter((m) => m.fecha <= hasta);
		if (soloMio) {
			lista = lista.filter(
				(m) => m.pagadorId === yo || m.otraParteId === yo || m.miParte > 0
			);
		}
		return lista;
	});

	// Si hay categoría/persona seleccionada, recortamos sobre eso.
	// Esto SÍ alimenta a la gráfica — queremos ver la evolución del item
	// elegido, no del hogar entero. Pero NO se filtra por mesElegido (la
	// forma temporal se preserva).
	const movsSeleccionEnPeriodo = $derived.by<MovimientoCrudo[]>(() => {
		const sel = seleccion;
		if (!sel) return movsPeriodo;
		if (sel.tipo === 'categoria') {
			return movsPeriodo.filter(
				(m) => (m.categoriaNombre ?? 'Sin categoría') === sel.clave
			);
		}
		return movsPeriodo.filter((m) => m.pagadorId === sel.clave);
	});

	// Foco: + mesElegido. Lo que ven los KPIs y la lista de movimientos.
	const movsEnFoco = $derived.by<MovimientoCrudo[]>(() => {
		if (!mesElegido) return movsSeleccionEnPeriodo;
		return movsSeleccionEnPeriodo.filter((m) => m.fecha.slice(0, 7) === mesElegido);
	});

	// Alias para mantener compat con el resto del código existente.
	const movsEfectivos = $derived(movsEnFoco);

	type AgregadosPersona = {
		clave: string;
		nombre: string;
		avatar: string | null;
		total: number;
		porcentaje: number;
	};
	type AgregadosCategoria = {
		clave: string;
		nombre: string;
		icono: string | null;
		total: number;
		porcentaje: number;
	};
	type AgregadosMes = { clave: string; etiqueta: string; valor: number; valorTexto: string };

	function porMesDe(lista: MovimientoCrudo[]): AgregadosMes[] {
		const gastos = lista.filter((m) => m.tipo === 'compartido' || m.tipo === 'fijo');
		const mapa = new Map<string, number>();
		for (const m of gastos) {
			const k = m.fecha.slice(0, 7);
			mapa.set(k, (mapa.get(k) ?? 0) + m.monto);
		}
		return Array.from(mapa.entries())
			.sort((a, b) => a[0].localeCompare(b[0]))
			.map(([k, v]) => ({
				clave: k,
				etiqueta: fmtMesAnio(`${k}-01`),
				valor: v,
				valorTexto: fmt.format(v)
			}));
	}

	function porCategoriaDe(lista: MovimientoCrudo[]): AgregadosCategoria[] {
		const gastos = lista.filter((m) => m.tipo === 'compartido' || m.tipo === 'fijo');
		const mapa = new Map<string, { icono: string | null; total: number }>();
		for (const m of gastos) {
			const k = m.categoriaNombre ?? 'Sin categoría';
			const prev = mapa.get(k) ?? { icono: m.categoriaIcono, total: 0 };
			prev.total += m.monto;
			if (!prev.icono && m.categoriaIcono) prev.icono = m.categoriaIcono;
			mapa.set(k, prev);
		}
		const totalCat = Array.from(mapa.values()).reduce((a, v) => a + v.total, 0) || 1;
		return Array.from(mapa.entries())
			.map(([nombre, v]) => ({
				clave: nombre,
				nombre,
				icono: v.icono,
				total: v.total,
				porcentaje: (v.total / totalCat) * 100
			}))
			.sort((a, b) => b.total - a.total);
	}

	function porPersonaDe(lista: MovimientoCrudo[]): AgregadosPersona[] {
		const gastos = lista.filter((m) => m.tipo === 'compartido' || m.tipo === 'fijo');
		const mapa = new Map<string, number>();
		for (const mi of miembrosLayout) mapa.set(mi.userId, 0);
		for (const m of gastos) {
			if (m.tipo === 'compartido' && m.pagadorId) {
				mapa.set(m.pagadorId, (mapa.get(m.pagadorId) ?? 0) + m.monto);
			} else if (m.tipo === 'fijo') {
				const n = miembrosLayout.length || 1;
				const porc = m.monto / n;
				for (const mi of miembrosLayout) {
					mapa.set(mi.userId, (mapa.get(mi.userId) ?? 0) + porc);
				}
			}
		}
		const totalPer = Array.from(mapa.values()).reduce((a, v) => a + v, 0) || 1;
		return Array.from(mapa.entries())
			.map(([userId, totalP]) => {
				const mi = miembrosLayout.find((x) => x.userId === userId);
				return {
					clave: userId,
					nombre: mi?.nombre ?? 'Sin nombre',
					avatar: mi?.avatar ?? null,
					total: totalP,
					porcentaje: (totalP / totalPer) * 100
				};
			})
			.filter((p) => p.total > 0.01)
			.sort((a, b) => b.total - a.total);
	}

	// Totales del KPI principal (recortado por selección si aplica).
	const totalEfectivo = $derived(
		movsEfectivos
			.filter((m) => m.tipo === 'compartido' || m.tipo === 'fijo')
			.reduce((a, m) => a + m.monto, 0)
	);
	const miParteEfectiva = $derived(movsEfectivos.reduce((a, m) => a + m.miParte, 0));

	// Listas: usan el foco (período + mes elegido), así también responden
	// al click en la gráfica. Si querés ver el dashboard completo, deselecciona
	// el mes en la gráfica o cambia de chip de período.
	const porCategoriaDelPeriodo = $derived(porCategoriaDe(movsEnFoco));
	const porPersonaDelPeriodo = $derived(porPersonaDe(movsEnFoco));

	// Evolución: si hay categoría/persona seleccionada, ES su evolución;
	// sino, la del hogar. NUNCA se recorta por mesElegido — la gráfica
	// conserva la forma temporal, solo se ilumina el mes clickeado.
	const porMesEvolucion = $derived(porMesDe(movsSeleccionEnPeriodo));

	// Promedio y meses-distintos: nivel período (es una métrica del período,
	// no del foco). Total / Mi parte / conteo sí siguen al foco.
	const mesesDistintos = $derived(Math.max(1, porMesEvolucion.length));
	const promedio = $derived(
		porMesEvolucion.reduce((a, m) => a + m.valor, 0) / mesesDistintos
	);
	const conteoEfectivo = $derived(movsEfectivos.length);

	// Comparativa: cuando hay mes elegido, comparamos ese mes vs el anterior
	// dentro del período. Cuando no, los dos últimos del período.
	const comparativa = $derived.by(() => {
		const ms = porMesEvolucion;
		if (ms.length < 2) return null;
		const idxAncla = mesElegido
			? ms.findIndex((m) => m.clave === mesElegido)
			: ms.length - 1;
		if (idxAncla < 1) return null;
		const ultimo = ms[idxAncla];
		const anterior = ms[idxAncla - 1];
		const diff = ultimo.valor - anterior.valor;
		const pct = anterior.valor > 0 ? (diff / anterior.valor) * 100 : 0;
		return { ultimo, anterior, diff, pct, arriba: diff > 0.01, abajo: diff < -0.01 };
	});

	// Punto activo / seleccionado del AreaChart.
	let ptoActivoIdx = $state<number | null>(null);
	let ptoSeleccionadoIdx = $state<number | null>(null);

	// Si cambia el período, limpio el punto seleccionado (los índices ya no aplican).
	$effect(() => {
		void periodo;
		void soloMio;
		ptoSeleccionadoIdx = null;
	});

	const ptoActivo = $derived(
		ptoActivoIdx !== null ? porMesEvolucion[ptoActivoIdx] ?? null : null
	);
	const ptoSeleccionado = $derived(
		ptoSeleccionadoIdx !== null ? porMesEvolucion[ptoSeleccionadoIdx] ?? null : null
	);

	function onClickPuntoChart(idx: number | null) {
		if (idx === null) {
			mesElegido = null;
			return;
		}
		const m = porMesEvolucion[idx];
		if (m) mesElegido = m.clave;
	}

	function iniciales(nombre: string) {
		return (
			nombre
				.trim()
				.split(/\s+/)
				.map((w) => w[0])
				.slice(0, 2)
				.join('') || '?'
		).toUpperCase();
	}

	function elegirPeriodo(p: Periodo) {
		mesElegido = null;
		ptoSeleccionadoIdx = null;
		periodo = p;
	}

	const TOP = 8;
	const categoriasTop = $derived(porCategoriaDelPeriodo.slice(0, TOP));
	const categoriasResto = $derived(Math.max(0, porCategoriaDelPeriodo.length - TOP));

	// Iconos y labels para la lista de movimientos del drill-down.
	const TIPOS_ICON: Record<TipoMov, typeof Receipt> = {
		compartido: Receipt,
		fijo: Repeat,
		prestamo: HandCoins,
		pago: ArrowRightLeft
	};
	const TIPOS_LABEL: Record<TipoMov, string> = {
		compartido: 'Compartido',
		fijo: 'Fijo',
		prestamo: 'Préstamo',
		pago: 'Pago'
	};

	function fmtFechaCorta(iso: string) {
		const [, m, d] = iso.split('-');
		return `${parseInt(d, 10)} ${MESES_CORTO[parseInt(m, 10) - 1]}`;
	}

	// Lista de movimientos a mostrar en el drill-down (ordenada desc).
	const movsDrilldown = $derived(
		movsEnFoco.slice().sort((a, b) => b.fecha.localeCompare(a.fecha))
	);

	// Cuando porMesEvolucion tiene UN SOLO mes (período = "Este mes" o
	// alguno parecido), la gráfica grande pierde sentido. La reemplazamos
	// por un breakdown DIARIO con barras + estadísticas para que la card
	// no se sienta vacía.
	type DiaMes = { dia: number; valor: number };
	const breakdownDiario = $derived.by(() => {
		if (porMesEvolucion.length !== 1) return null;
		const clave = porMesEvolucion[0].clave; // YYYY-MM
		const [a, m] = clave.split('-').map((s) => parseInt(s, 10));
		const finMes = new Date(a, m, 0).getDate();
		const gastos = movsEfectivos.filter(
			(mov) => mov.tipo === 'compartido' || mov.tipo === 'fijo'
		);
		const mapa = new Map<number, number>();
		for (const mov of gastos) {
			const d = parseInt(mov.fecha.slice(8, 10), 10);
			if (mov.fecha.slice(0, 7) === clave) {
				mapa.set(d, (mapa.get(d) ?? 0) + mov.monto);
			}
		}
		const dias: DiaMes[] = [];
		for (let d = 1; d <= finMes; d++) dias.push({ dia: d, valor: mapa.get(d) ?? 0 });
		const max = Math.max(...dias.map((d) => d.valor), 1);
		const activos = dias.filter((d) => d.valor > 0);
		let diaPico: DiaMes | null = null;
		for (const d of activos) {
			if (!diaPico || d.valor > diaPico.valor) diaPico = d;
		}
		const sumaActivos = activos.reduce((a, b) => a + b.valor, 0);
		const promedio = activos.length > 0 ? sumaActivos / activos.length : 0;
		return { dias, max, finMes, activos: activos.length, diaPico, promedio };
	});

	// Top 3 movimientos del foco (para enriquecer el caso de mes único).
	const topMovsMesUnico = $derived(
		porMesEvolucion.length === 1
			? movsEfectivos
					.filter((m) => m.tipo === 'compartido' || m.tipo === 'fijo')
					.slice()
					.sort((a, b) => b.monto - a.monto)
					.slice(0, 3)
			: []
	);
</script>

<div class="flex flex-col px-5 py-6 md:px-8 lg:h-full lg:w-full lg:min-h-0 lg:gap-5">
	<!-- ============= HEADER ============= -->
	<header class="flex shrink-0 flex-wrap items-end justify-between gap-3">
		<div class="flex min-w-0 items-center gap-3">
			{#if seleccion}
				<button
					type="button"
					onclick={volverAlDashboard}
					class="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted shadow-card transition-all duration-200 hover:bg-bg hover:text-text"
				>
					<ArrowLeft size={14} />
					Volver
				</button>
			{/if}
			<div class="min-w-0">
				<h1 class="flex items-center gap-2 truncate text-2xl font-bold tracking-tight text-text">
					{#if !seleccion}
						<ChartColumn size={22} class="shrink-0 text-brand-500" />
						Resumen
					{:else if seleccion.tipo === 'categoria'}
						{@const Ico = iconoCategoria(seleccion.icono)}
						<Ico size={22} class="shrink-0 text-brand-500" />
						<span class="truncate">{seleccion.nombre}</span>
					{:else}
						{#if seleccion.avatar}
							<img src={seleccion.avatar} alt="" referrerpolicy="no-referrer" class="size-7 shrink-0 rounded-full object-cover" />
						{:else}
							<span class="grid size-7 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
								{iniciales(seleccion.nombre)}
							</span>
						{/if}
						<span class="truncate">{seleccion.nombre}</span>
					{/if}
				</h1>
				<p class="mt-0.5 truncate text-xs text-muted">{rangoTexto}</p>
			</div>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<div class="flex flex-wrap gap-1">
				{#each [
					{ id: 'mes', label: 'Este mes' },
					{ id: 'anterior', label: 'Anterior' },
					{ id: 'tres', label: '3 meses' },
					{ id: 'anio', label: 'Año' },
					{ id: 'todo', label: 'Todo' }
				] as const as p (p.id)}
					{@const activo = periodo === p.id && !mesElegido}
					<button
						type="button"
						onclick={() => elegirPeriodo(p.id)}
						class={'rounded-full border border-border px-3 py-1 text-[11px] font-semibold transition-all duration-200 ' +
							(activo
								? 'bg-brand-500 text-white'
								: 'bg-surface text-muted hover:bg-bg hover:text-text')}
					>
						{p.label}
					</button>
				{/each}
			</div>
			<div class="flex items-center gap-1 rounded-full border border-border bg-surface p-0.5">
				<button
					type="button"
					onclick={() => (soloMio = false)}
					class={'rounded-full px-3 py-0.5 text-[11px] font-semibold transition-all duration-200 ' +
						(!soloMio ? 'bg-brand-500 text-white' : 'text-muted hover:text-text')}
				>
					Hogar
				</button>
				<button
					type="button"
					onclick={() => (soloMio = true)}
					class={'rounded-full px-3 py-0.5 text-[11px] font-semibold transition-all duration-200 ' +
						(soloMio ? 'bg-brand-500 text-white' : 'text-muted hover:text-text')}
				>
					Solo mío
				</button>
			</div>
		</div>
	</header>

	{#if movsPeriodo.length === 0}
		<div
			class="mt-4 flex flex-1 flex-col items-center justify-center rounded-card border border-dashed border-border bg-surface p-8 text-center lg:mt-0 lg:min-h-0"
		>
			<p class="text-sm font-medium text-text">Sin movimientos en este período</p>
			<p class="mt-1 text-xs text-muted">Elige un rango más amplio o registra algo primero.</p>
		</div>
	{:else}
		<!-- ============= ROW 1: HERO + EVOLUCIÓN ============= -->
		<section class="mt-4 grid shrink-0 gap-4 lg:mt-0 lg:grid-cols-7 lg:gap-5">
			<!-- Hero (más compacto: 2/7 ~ 28%) -->
			<div class="flex flex-col rounded-card border border-border bg-surface p-5 shadow-card lg:col-span-2 lg:p-6">
				<p class="text-[11px] font-semibold uppercase tracking-wide text-muted transition-colors duration-200">
					{#if seleccion && mesElegido}
						{@const [a, m] = mesElegido.split('-').map((s) => parseInt(s, 10))}
						{seleccion.tipo === 'categoria' ? 'Categoría' : 'Aportes'} · {MESES_LARGO[m - 1]} {a}
					{:else if seleccion}
						{seleccion.tipo === 'categoria' ? 'Total en categoría' : 'Total aportado'}
					{:else if mesElegido}
						{@const [a, m] = mesElegido.split('-').map((s) => parseInt(s, 10))}
						Total en {MESES_LARGO[m - 1]} {a}
					{:else}
						Total del hogar
					{/if}
				</p>
				<p
					class="tabular mt-1 text-4xl font-bold tracking-tight text-text lg:text-5xl"
					style="min-height: 1em;"
				>
					{#key totalEfectivo}
						<span in:fade={{ duration: 180 }} class="inline-block">
							{fmt.format(totalEfectivo)}
						</span>
					{/key}
				</p>
				<div class="mt-1 min-h-[1.25rem]">
					{#if comparativa}
						{#key comparativa.ultimo.clave + ':' + comparativa.anterior.clave}
							<p
								in:fade={{ duration: 200 }}
								class="flex items-center gap-1 text-xs font-semibold"
							>
								{#if comparativa.arriba}
									<TrendingUp size={13} class="text-money-contra" />
									<span class="tabular text-money-contra">↑ {Math.abs(comparativa.pct).toFixed(1)}%</span>
								{:else if comparativa.abajo}
									<TrendingDown size={13} class="text-money-favor" />
									<span class="tabular text-money-favor">↓ {Math.abs(comparativa.pct).toFixed(1)}%</span>
								{:else}
									<span class="text-muted">Sin cambio</span>
								{/if}
								<span class="font-medium text-muted">vs {comparativa.anterior.etiqueta}</span>
							</p>
						{/key}
					{:else}
						<p class="text-xs text-muted">
							{conteoEfectivo} {conteoEfectivo === 1 ? 'movimiento' : 'movimientos'}
						</p>
					{/if}
				</div>

				<dl class="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4">
					<div>
						<dt class="text-[10px] font-semibold uppercase tracking-wide text-muted">Mi parte</dt>
						<dd class="tabular mt-1 text-sm font-bold text-text">
							{#key miParteEfectiva}
								<span in:fade={{ duration: 180 }} class="inline-block">{fmt.format(miParteEfectiva)}</span>
							{/key}
						</dd>
						{#if totalEfectivo > 0}
							<dd class="tabular text-[10px] text-muted">
								{((miParteEfectiva / totalEfectivo) * 100).toFixed(0)}%
							</dd>
						{/if}
					</div>
					<div>
						<dt class="text-[10px] font-semibold uppercase tracking-wide text-muted">Promedio / mes</dt>
						<dd class="tabular mt-1 text-sm font-bold text-text">{fmt.format(promedio)}</dd>
						<dd class="tabular text-[10px] text-muted">
							{mesesDistintos} {mesesDistintos === 1 ? 'mes' : 'meses'}
						</dd>
					</div>
					<div>
						<dt class="text-[10px] font-semibold uppercase tracking-wide text-muted">Movimientos</dt>
						<dd class="tabular mt-1 text-sm font-bold text-text">
							{#key conteoEfectivo}
								<span in:fade={{ duration: 180 }} class="inline-block">{conteoEfectivo}</span>
							{/key}
						</dd>
					</div>
				</dl>
			</div>

			<!-- Evolución (más grande: 5/7 ~ 72%) -->
			<div class="flex flex-col rounded-card border border-border bg-surface p-5 shadow-card lg:col-span-5 lg:p-6">
				<div class="flex items-baseline justify-between gap-2">
					<p class="text-[11px] font-semibold uppercase tracking-wide text-muted">Evolución</p>
					<p class="tabular text-xs font-semibold transition-opacity duration-200">
						{#if ptoActivo}
							<span class="capitalize text-muted">{ptoActivo.etiqueta}</span>
							<span class="text-muted"> · </span>
							<span class="text-brand-700">{ptoActivo.valorTexto}</span>
						{:else if ptoSeleccionado}
							<span class="capitalize text-muted">{ptoSeleccionado.etiqueta}</span>
							<span class="text-muted"> · </span>
							<span class="text-brand-700">{ptoSeleccionado.valorTexto}</span>
							<button
								type="button"
								onclick={() => {
									ptoSeleccionadoIdx = null;
									mesElegido = null;
								}}
								class="ml-2 text-[10px] font-medium text-muted hover:text-text"
							>
								(limpiar)
							</button>
						{:else if comparativa}
							<span class="text-muted">Último: </span>
							<span class="text-text">{comparativa.ultimo.valorTexto}</span>
						{/if}
					</p>
				</div>
				<div class="mt-3 flex flex-1 flex-col">
					{#if porMesEvolucion.length === 0}
						<div class="flex flex-1 items-center justify-center">
							<p class="text-center text-xs text-muted">Sin datos para graficar.</p>
						</div>
					{:else if porMesEvolucion.length === 1 && breakdownDiario}
						<!-- Caso 1 solo mes: barras por día + estadísticas + top movimientos.
						     Llena el espacio con info real en vez de mostrar el número solo. -->
						<div class="flex flex-1 flex-col gap-4" in:fade={{ duration: 200 }}>
							<!-- Mini bar chart por día -->
							<div class="flex flex-col">
								<div class="flex items-baseline justify-between">
									<p class="text-[10px] font-semibold uppercase tracking-wide text-muted">
										Por día de {porMesEvolucion[0].etiqueta}
									</p>
									{#if breakdownDiario.diaPico}
										<p class="tabular text-[11px] text-muted">
											Pico día {breakdownDiario.diaPico.dia}
											· <span class="font-semibold text-text">{fmt.format(breakdownDiario.diaPico.valor)}</span>
										</p>
									{/if}
								</div>
								<div class="mt-2 flex h-24 items-end gap-[2px]">
									{#each breakdownDiario.dias as d (d.dia)}
										{@const altura = (d.valor / breakdownDiario.max) * 100}
										{@const esPico =
											breakdownDiario.diaPico && d.dia === breakdownDiario.diaPico.dia}
										<div
											class="group relative flex h-full flex-1 items-end"
											title={d.valor > 0
												? `Día ${d.dia} · ${fmt.format(d.valor)}`
												: `Día ${d.dia} · sin gastos`}
										>
											<div
												class={'w-full rounded-sm transition-all duration-300 ease-out ' +
													(d.valor === 0
														? 'bg-border'
														: esPico
															? 'bg-brand-500'
															: 'bg-brand-200 group-hover:bg-brand-400')}
												style="height: {d.valor > 0 ? Math.max(4, altura) : 6}%"
											></div>
										</div>
									{/each}
								</div>
								<div class="mt-1 flex justify-between text-[10px] font-medium text-muted">
									<span>1</span>
									<span>{Math.ceil(breakdownDiario.finMes / 2)}</span>
									<span>{breakdownDiario.finMes}</span>
								</div>
							</div>

							<!-- Stats strip -->
							<dl class="grid grid-cols-3 gap-3 border-t border-border pt-3">
								<div>
									<dt class="text-[10px] font-semibold uppercase tracking-wide text-muted">
										Días activos
									</dt>
									<dd class="tabular mt-0.5 text-base font-bold text-text">
										{breakdownDiario.activos}
									</dd>
									<dd class="tabular text-[10px] text-muted">
										de {breakdownDiario.finMes}
									</dd>
								</div>
								<div>
									<dt class="text-[10px] font-semibold uppercase tracking-wide text-muted">
										Promedio
									</dt>
									<dd class="tabular mt-0.5 text-base font-bold text-text">
										{fmt.format(breakdownDiario.promedio)}
									</dd>
									<dd class="tabular text-[10px] text-muted">por día activo</dd>
								</div>
								<div>
									<dt class="text-[10px] font-semibold uppercase tracking-wide text-muted">
										Total
									</dt>
									<dd class="tabular mt-0.5 text-base font-bold text-text">
										{porMesEvolucion[0].valorTexto}
									</dd>
									<dd class="tabular text-[10px] capitalize text-muted">
										{porMesEvolucion[0].etiqueta}
									</dd>
								</div>
							</dl>

							<!-- Top 3 movimientos del mes -->
							{#if topMovsMesUnico.length > 0}
								<div class="border-t border-border pt-3">
									<p class="text-[10px] font-semibold uppercase tracking-wide text-muted">
										Los más caros
									</p>
									<ul class="mt-2 flex flex-col gap-1.5">
										{#each topMovsMesUnico as m (m.id)}
											{@const Ico = TIPOS_ICON[m.tipo]}
											<li>
												<a
													href={m.url}
													class="flex items-center gap-2 rounded-input px-2 py-1.5 transition-colors duration-150 hover:bg-bg"
												>
													<span class="grid size-6 shrink-0 place-items-center rounded-input bg-brand-50 text-brand-700">
														<Ico size={11} />
													</span>
													<span class="min-w-0 flex-1 truncate text-xs font-medium text-text">
														{m.titulo}
													</span>
													<span class="tabular shrink-0 text-xs font-bold text-text">
														{fmt.format(m.monto)}
													</span>
												</a>
											</li>
										{/each}
									</ul>
								</div>
							{/if}
						</div>
					{:else}
						<AreaChart
							puntos={porMesEvolucion.map((m) => ({
								etiqueta: m.etiqueta,
								etiquetaCorta: m.etiqueta,
								valor: m.valor,
								valorTexto: m.valorTexto
							}))}
							altura={220}
							bind:ptoActivoIdx
							bind:ptoSeleccionadoIdx
							onClickPunto={onClickPuntoChart}
						/>
					{/if}
				</div>
			</div>
		</section>

		<!-- ============= ROW 2: depende de selección ============= -->
		{#if seleccion}
			<!-- Lista de movimientos del item seleccionado -->
			<section
				in:fade={{ duration: 180 }}
				class="mt-4 flex flex-1 flex-col overflow-hidden rounded-card border border-border bg-surface p-5 shadow-card lg:mt-0 lg:p-6 lg:min-h-0"
			>
				<div class="flex items-baseline justify-between">
					<p class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
						<Receipt size={12} class="text-brand-500" /> Movimientos
					</p>
					<p class="tabular text-[11px] text-muted">
						{movsDrilldown.length} {movsDrilldown.length === 1 ? 'movimiento' : 'movimientos'}
					</p>
				</div>
				{#if movsDrilldown.length === 0}
					<div class="mt-4 flex flex-1 items-center justify-center">
						<p class="text-xs text-muted">Sin movimientos en este foco.</p>
					</div>
				{:else}
					<ul class="mt-3 flex flex-1 flex-col overflow-y-auto lg:min-h-0">
						{#each movsDrilldown as m, i (m.id)}
							{@const Ico = TIPOS_ICON[m.tipo]}
							<li>
								<a
									href={m.url}
									class={'flex items-center gap-3 px-2 py-3 transition-colors duration-200 hover:bg-bg ' +
										(i > 0 ? 'border-t border-border' : '')}
								>
									<span class="grid size-9 shrink-0 place-items-center rounded-input bg-brand-50 text-brand-700">
										<Ico size={14} />
									</span>
									<div class="min-w-0 flex-1">
										<p class="truncate text-sm font-medium text-text">{m.titulo}</p>
										<p class="truncate text-[11px] text-muted">
											{TIPOS_LABEL[m.tipo]}
											{#if m.categoriaNombre && seleccion?.tipo !== 'categoria'}· {m.categoriaNombre}{/if}
											· {fmtFechaCorta(m.fecha)}
										</p>
									</div>
									<span class="tabular shrink-0 text-sm font-bold text-text">
										{fmt.format(m.monto)}
									</span>
									<ChevronRight size={14} class="shrink-0 text-muted" />
								</a>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{:else}
			<!-- CATEGORÍAS + PERSONAS (dashboard normal) -->
			<section
				in:fade={{ duration: 180 }}
				class="mt-4 grid flex-1 gap-4 lg:mt-0 lg:grid-cols-2 lg:gap-5 lg:min-h-0"
			>
				<!-- En qué se gasta -->
				<div class="flex flex-col overflow-hidden rounded-card border border-border bg-surface p-5 shadow-card lg:p-6 lg:min-h-0">
					<div class="flex items-baseline justify-between">
						<p class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
							<Tag size={12} class="text-brand-500" /> En qué se gasta
						</p>
						<p class="tabular text-[11px] text-muted">
							{porCategoriaDelPeriodo.length} {porCategoriaDelPeriodo.length === 1 ? 'categoría' : 'categorías'}
						</p>
					</div>
					{#if porCategoriaDelPeriodo.length === 0}
						<div class="mt-4 flex flex-1 items-center justify-center">
							<p class="text-xs text-muted">Sin categorías con gasto.</p>
						</div>
					{:else}
						<ul class="mt-4 flex flex-1 flex-col gap-3 overflow-y-auto lg:min-h-0">
							{#each categoriasTop as c, i (c.clave)}
								{@const Ico = iconoCategoria(c.icono)}
								{@const destacado = i === 0}
								<li>
									<button
										type="button"
										onclick={() =>
											(seleccion = {
												tipo: 'categoria',
												clave: c.clave,
												nombre: c.nombre,
												icono: c.icono
											})}
										class="group w-full rounded-input px-1 py-0.5 text-left transition-colors duration-200 hover:bg-bg"
									>
										<div class="flex items-center justify-between gap-3">
											<div class="flex min-w-0 items-center gap-2">
												<span
													class={'grid size-7 shrink-0 place-items-center rounded-input transition-colors duration-200 ' +
														(destacado ? 'bg-brand-500 text-white' : 'bg-brand-50 text-brand-700')}
												>
													<Ico size={13} />
												</span>
												<span class="truncate text-sm font-medium text-text">{c.nombre}</span>
											</div>
											<div class="flex shrink-0 items-baseline gap-2">
												<span class="tabular text-sm font-bold text-text">{fmt.format(c.total)}</span>
												<span class="tabular text-[10px] font-medium text-muted">
													{c.porcentaje.toFixed(0)}%
												</span>
											</div>
										</div>
										<div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg group-hover:bg-surface">
											<div
												class={'h-full rounded-full transition-all duration-300 ' +
													(destacado ? 'bg-brand-500' : 'bg-brand-200')}
												style="width: {c.porcentaje}%"
											></div>
										</div>
									</button>
								</li>
							{/each}
							{#if categoriasResto > 0}
								<li class="pt-1 text-center text-[11px] font-medium text-muted">
									+ {categoriasResto} {categoriasResto === 1 ? 'categoría más' : 'categorías más'}
								</li>
							{/if}
						</ul>
					{/if}
				</div>

				<!-- Quién está aportando -->
				<div class="flex flex-col overflow-hidden rounded-card border border-border bg-surface p-5 shadow-card lg:p-6 lg:min-h-0">
					<div class="flex items-baseline justify-between">
						<p class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
							<Users size={12} class="text-brand-500" /> Quién está aportando
						</p>
						<p class="tabular text-[11px] text-muted">
							{porPersonaDelPeriodo.length} {porPersonaDelPeriodo.length === 1 ? 'persona' : 'personas'}
						</p>
					</div>
					{#if porPersonaDelPeriodo.length === 0}
						<div class="mt-4 flex flex-1 items-center justify-center">
							<p class="text-xs text-muted">Sin aportes registrados.</p>
						</div>
					{:else}
						<ul class="mt-4 flex flex-1 flex-col gap-3 overflow-y-auto lg:min-h-0">
							{#each porPersonaDelPeriodo as p, i (p.clave)}
								{@const destacado = i === 0}
								<li>
									<button
										type="button"
										onclick={() =>
											(seleccion = {
												tipo: 'persona',
												clave: p.clave,
												nombre: p.nombre,
												avatar: p.avatar
											})}
										class="group w-full rounded-input px-1 py-0.5 text-left transition-colors duration-200 hover:bg-bg"
									>
										<div class="flex items-center justify-between gap-3">
											<div class="flex min-w-0 items-center gap-2">
												{#if p.avatar}
													<img
														src={p.avatar}
														alt=""
														referrerpolicy="no-referrer"
														class="size-7 shrink-0 rounded-full object-cover"
													/>
												{:else}
													<span
														class={'grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-bold transition-colors duration-200 ' +
															(destacado ? 'bg-brand-500 text-white' : 'bg-brand-50 text-brand-700')}
													>
														{iniciales(p.nombre)}
													</span>
												{/if}
												<span class="truncate text-sm font-medium text-text">
													{p.nombre}{#if p.clave === yo}<span class="text-muted"> · Tú</span>{/if}
												</span>
											</div>
											<div class="flex shrink-0 items-baseline gap-2">
												<span class="tabular text-sm font-bold text-text">{fmt.format(p.total)}</span>
												<span class="tabular text-[10px] font-medium text-muted">
													{p.porcentaje.toFixed(0)}%
												</span>
											</div>
										</div>
										<div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg group-hover:bg-surface">
											<div
												class={'h-full rounded-full transition-all duration-300 ' +
													(destacado ? 'bg-brand-500' : 'bg-brand-200')}
												style="width: {p.porcentaje}%"
											></div>
										</div>
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</section>
		{/if}
	{/if}
</div>
