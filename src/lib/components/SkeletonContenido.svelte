<!--
	Skeleton del área de contenido. Copia la ESTRUCTURA real de cada vista (mismos
	contenedores, mismas clases flex-1/min-h-0) para que se vea idéntico al layout
	y llene el 100% del alto/ancho en escritorio. Bloques en turquesa (brand-50)
	sobre las tarjetas reales (surface); acentos de dinero en las tarjetas de saldo.
-->
<script lang="ts">
	import { page } from '$app/state';

	// `interior=true` omite el wrapper exterior (padding, h-full, flex-col).
	// Útil cuando se inserta el skeleton dentro de otro contenedor que ya tiene
	// esos estilos aplicados (p.ej. el detalle inline en /gastos).
	let { ruta = '/', interior = false }: { ruta?: string; interior?: boolean } = $props();

	const tipo = $derived(
		ruta === '/'
			? 'inicio'
			: ruta === '/ajustes'
				? 'ajustes'
				: ruta === '/hogar'
					? 'hogar'
					: ruta === '/gastos'
						? 'gastos-lista'
						: ruta === '/gastos/nuevo'
							? 'gasto-nuevo'
							: ruta?.startsWith('/gastos/')
								? 'gasto-detalle'
								: ruta === '/categorias'
									? 'categorias'
									: 'generico'
	);

	// El rol del hogar activo ya está cargado (viene del layout) → decide si la
	// vista de Hogar muestra 1 o 2 columnas, igual que la real.
	const esAdmin = $derived(
		(page.data.hogarActivo as { rol?: string } | undefined)?.rol === 'admin'
	);
</script>

<div
	class={interior
		? 'flex h-full flex-col'
		: 'flex flex-col px-5 py-6 md:px-8 lg:h-full lg:w-full lg:flex-1 lg:min-h-0'}
	aria-hidden="true"
>
	{#if tipo === 'inicio'}
		<div class="flex min-h-0 flex-1 animate-pulse flex-col">
			<!-- Encabezado -->
			<div class="h-3 w-24 rounded bg-brand-50"></div>
			<div class="mt-2 h-5 w-40 rounded bg-brand-50"></div>

			<!-- Tarjetas de saldo -->
			<div class="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3">
				<div
					class="col-span-2 rounded-card border border-border bg-surface p-5 shadow-card md:col-span-1"
				>
					<div class="h-3 w-16 rounded bg-brand-50"></div>
					<div class="mt-3 h-9 w-32 rounded bg-brand-50"></div>
					<div class="mt-3 h-3 w-40 max-w-full rounded bg-brand-50"></div>
				</div>
				<div class="rounded-card bg-money-favor-bg p-5">
					<div class="h-3 w-14 rounded bg-money-favor/20"></div>
					<div class="mt-3 h-6 w-24 max-w-full rounded bg-money-favor/20"></div>
				</div>
				<div class="rounded-card bg-money-contra-bg p-5">
					<div class="h-3 w-14 rounded bg-money-contra/20"></div>
					<div class="mt-3 h-6 w-24 max-w-full rounded bg-money-contra/20"></div>
				</div>
			</div>

			<!-- Por persona (llena el resto) -->
			<div class="mt-8 flex min-h-0 flex-1 flex-col">
				<div class="h-4 w-28 rounded bg-brand-50"></div>
				<div class="mt-3 flex-1 rounded-card border border-dashed border-border bg-surface"></div>
			</div>
		</div>
	{:else if tipo === 'hogar'}
		<div class="flex min-h-0 flex-1 animate-pulse flex-col">
			<!-- Encabezado -->
			<div class="h-7 w-28 rounded bg-brand-50"></div>
			<div class="mt-2.5 h-3 w-80 max-w-full rounded bg-brand-50"></div>

			<div
				class={'mt-5 grid gap-5 lg:min-h-0 lg:flex-1 ' + (esAdmin ? 'lg:grid-cols-2' : '')}
			>
				<!-- Columna izquierda: datos + miembros -->
				<div class="flex flex-col gap-5 lg:min-h-0">
					<section>
						<div class="h-3 w-28 rounded bg-brand-50"></div>
						<div class="mt-2 space-y-3 rounded-card bg-surface p-5 shadow-card">
							<div class="space-y-1.5">
								<div class="h-3 w-32 rounded bg-brand-50"></div>
								<div class="h-11 rounded-input bg-brand-50"></div>
							</div>
							<div class="space-y-1.5">
								<div class="h-3 w-20 rounded bg-brand-50"></div>
								<div class="h-11 rounded-input bg-brand-50"></div>
							</div>
						</div>
					</section>
					<section class="flex flex-col lg:min-h-0 lg:flex-1">
						<div class="h-3 w-24 rounded bg-brand-50"></div>
						<div class="mt-2 overflow-hidden rounded-card bg-surface shadow-card lg:flex-1">
							{#each Array(4) as _, i (i)}
								<div
									class="flex items-center gap-3 px-4 py-3"
									class:border-t={i > 0}
									class:border-border={i > 0}
								>
									<div class="size-10 shrink-0 rounded-full bg-brand-50"></div>
									<div class="min-w-0 flex-1">
										<div class="h-3 w-32 max-w-full rounded bg-brand-50"></div>
									</div>
									<div class="h-6 w-24 rounded-full bg-brand-50"></div>
								</div>
							{/each}
						</div>
					</section>
				</div>

				<!-- Columna derecha: invitación (solo admin) -->
				{#if esAdmin}
					<div class="flex flex-col gap-5 lg:min-h-0">
						<section class="flex flex-col lg:min-h-0 lg:flex-1">
							<div class="h-3 w-24 rounded bg-brand-50"></div>
							<div
								class="mt-2 rounded-card bg-surface p-4 shadow-card lg:flex lg:min-h-0 lg:flex-1 lg:flex-col"
							>
								<!-- Toggle aceptar miembros -->
								<div class="flex items-center gap-3 rounded-card bg-brand-50 px-4 py-3">
									<div class="size-5 shrink-0 rounded-full border-2 border-brand-200"></div>
									<div class="flex-1 space-y-1.5">
										<div class="h-3 w-40 max-w-full rounded bg-brand-200/60"></div>
										<div class="h-2.5 w-52 max-w-full rounded bg-brand-200/60"></div>
									</div>
								</div>
								<!-- Código -->
								<div class="mt-4">
									<div class="h-2.5 w-16 rounded bg-brand-50"></div>
									<div class="mt-1.5 flex items-center gap-2">
										<div class="h-10 flex-1 rounded-input bg-brand-50"></div>
										<div class="size-10 shrink-0 rounded-input bg-brand-50"></div>
										<div class="size-10 shrink-0 rounded-input bg-brand-50"></div>
									</div>
								</div>
								<!-- Enlace -->
								<div class="mt-3">
									<div class="h-2.5 w-14 rounded bg-brand-50"></div>
									<div class="mt-1.5 flex items-center gap-2">
										<div class="h-10 flex-1 rounded-input bg-brand-50"></div>
										<div class="size-10 shrink-0 rounded-input bg-brand-50"></div>
										<div class="size-10 shrink-0 rounded-input bg-brand-50"></div>
									</div>
								</div>
								<!-- QR -->
								<div class="mt-4 flex flex-1 items-center justify-center">
									<div class="size-44 max-w-full rounded-card bg-brand-50"></div>
								</div>
							</div>
						</section>
					</div>
				{/if}
			</div>
		</div>
	{:else if tipo === 'ajustes'}
		<div class="grid min-h-0 flex-1 animate-pulse gap-5 lg:grid-cols-2">
			<!-- Perfil -->
			<section class="flex flex-col lg:min-h-0">
				<div class="h-3 w-14 rounded bg-brand-50"></div>
				<div class="mt-2 flex flex-1 flex-col rounded-card bg-surface p-6 shadow-card lg:min-h-0">
					<div class="flex flex-1 flex-col items-center justify-center gap-4">
						<div class="size-40 rounded-full bg-brand-50 lg:size-[clamp(10rem,38vh,20rem)]"></div>
						<div class="h-8 w-48 max-w-full rounded bg-brand-50"></div>
						<div class="h-4 w-40 max-w-full rounded bg-brand-50"></div>
						<div class="h-4 w-24 rounded bg-brand-50"></div>
					</div>
					<div class="mt-3 grid gap-2 border-t border-border pt-4 sm:grid-cols-2">
						<div class="h-14 rounded-input bg-brand-50"></div>
						<div class="h-14 rounded-input bg-brand-50"></div>
					</div>
				</div>
			</section>

			<!-- Seguridad + hogar -->
			<div class="flex flex-col gap-5 lg:min-h-0">
				<section class="flex flex-col lg:min-h-0 lg:flex-1">
					<div class="h-3 w-20 rounded bg-brand-50"></div>
					<div
						class="mt-2 flex flex-1 flex-col justify-evenly gap-3 rounded-card bg-surface p-5 shadow-card lg:min-h-0"
					>
						{#each Array(3) as _, i (i)}
							<div class="space-y-1.5">
								<div class="h-3 w-32 rounded bg-brand-50"></div>
								<div class="h-10 rounded-input bg-brand-50"></div>
							</div>
						{/each}
						<div class="h-11 rounded-input bg-brand-50"></div>
					</div>
				</section>
				<section class="flex flex-col">
					<div class="h-3 w-12 rounded bg-brand-50"></div>
					<div class="mt-2 space-y-3 rounded-card bg-surface p-4 shadow-card">
						<div class="flex items-center gap-3">
							<div class="size-9 shrink-0 rounded-input bg-brand-50"></div>
							<div class="flex-1 space-y-1.5">
								<div class="h-3 w-28 rounded bg-brand-50"></div>
								<div class="h-2.5 w-20 rounded bg-brand-50"></div>
							</div>
							<div class="h-7 w-20 rounded-input bg-brand-50"></div>
						</div>
						<div class="h-10 rounded-input border border-border bg-surface"></div>
					</div>
				</section>
			</div>
		</div>
	{:else if tipo === 'gastos-lista'}
		<!-- /gastos: header + lista de cards con gap-2 -->
		<div class="flex flex-1 flex-col animate-pulse">
			<div class="flex items-end justify-between gap-3">
				<div class="space-y-2">
					<div class="h-7 w-56 rounded bg-brand-50"></div>
					<div class="h-3 w-64 max-w-full rounded bg-brand-50"></div>
				</div>
				<div class="flex shrink-0 gap-2">
					<div class="h-9 w-28 rounded-input bg-brand-50"></div>
					<div class="h-9 w-24 rounded-input bg-brand-50"></div>
				</div>
			</div>
			<ul class="mt-5 flex flex-col gap-2">
				{#each Array(6) as _, i (i)}
					<li class="flex items-center gap-3 rounded-card border border-border bg-surface p-3.5 shadow-card">
						<div class="size-11 shrink-0 rounded-input bg-brand-50"></div>
						<div class="min-w-0 flex-1 space-y-1.5">
							<div class="h-3.5 w-48 max-w-full rounded bg-brand-50"></div>
							<div class="h-2.5 w-36 max-w-full rounded bg-brand-50"></div>
						</div>
						<div class="shrink-0 space-y-1.5 text-right">
							<div class="ml-auto h-3.5 w-20 rounded bg-brand-50"></div>
							<div class="ml-auto h-2.5 w-16 rounded bg-brand-50"></div>
						</div>
						<div class="size-4 shrink-0 rounded bg-brand-50"></div>
					</li>
				{/each}
			</ul>
		</div>
	{:else if tipo === 'gasto-nuevo'}
		<!-- /gastos/nuevo: volver + header con botones + vista previa + 5-col grid -->
		<div class="flex flex-1 flex-col animate-pulse lg:min-h-0">
			<div class="h-4 w-20 rounded bg-brand-50"></div>
			<div class="mt-4 flex items-start justify-between gap-3">
				<div class="space-y-2">
					<div class="h-7 w-40 rounded bg-brand-50"></div>
					<div class="h-3 w-72 max-w-full rounded bg-brand-50"></div>
				</div>
				<div class="flex shrink-0 gap-2">
					<div class="hidden h-10 w-24 rounded-input bg-brand-50 sm:block"></div>
					<div class="h-10 w-32 rounded-input bg-brand-50"></div>
				</div>
			</div>

			<!-- Vista previa -->
			<section class="mt-5 rounded-card border border-border bg-surface p-4 shadow-card">
				<div class="h-2.5 w-20 rounded bg-brand-50"></div>
				<div class="mt-3 flex items-center gap-3">
					<div class="size-14 shrink-0 rounded-card bg-brand-50"></div>
					<div class="min-w-0 flex-1 space-y-1.5">
						<div class="h-4 w-48 max-w-full rounded bg-brand-50"></div>
						<div class="h-2.5 w-40 max-w-full rounded bg-brand-50"></div>
					</div>
					<div class="h-8 w-24 shrink-0 rounded bg-brand-50"></div>
				</div>
			</section>

			<!-- Form 5 cols: llena el alto en lg -->
			<div class="mt-5 grid gap-5 lg:grid-cols-5 lg:min-h-0 lg:flex-1">
				<!-- Izquierda (col-span-3): Datos + Categoría + Notas (la última crece) -->
				<div class="flex flex-col gap-5 lg:col-span-3 lg:min-h-0">
					<section>
						<div class="h-2.5 w-24 rounded bg-brand-50"></div>
						<div class="mt-2 space-y-3 rounded-card border border-border bg-surface p-5 shadow-card">
							<div class="h-3 w-20 rounded bg-brand-50"></div>
							<div class="h-11 rounded-input bg-brand-50"></div>
							<div class="grid gap-3 sm:grid-cols-2">
								<div class="h-11 rounded-input bg-brand-50"></div>
								<div class="h-11 rounded-input bg-brand-50"></div>
							</div>
						</div>
					</section>
					<section>
						<div class="h-2.5 w-24 rounded bg-brand-50"></div>
						<div class="mt-2 space-y-3 rounded-card border border-border bg-surface p-5 shadow-card">
							<div class="h-3 w-20 rounded bg-brand-50"></div>
							<div class="h-11 rounded-input bg-brand-50"></div>
						</div>
					</section>
					<!-- Notas: crece para llenar lo que sobra -->
					<section class="flex flex-col lg:min-h-0 lg:flex-1">
						<div class="h-2.5 w-24 rounded bg-brand-50"></div>
						<div
							class="mt-2 flex flex-col space-y-3 rounded-card border border-border bg-surface p-5 shadow-card lg:min-h-0 lg:flex-1"
						>
							<div class="h-3 w-20 rounded bg-brand-50"></div>
							<div class="h-20 rounded-input bg-brand-50 lg:min-h-0 lg:flex-1"></div>
						</div>
					</section>
				</div>

				<!-- Derecha (col-span-2): modo (4 filas) + participantes (crece) -->
				<div class="flex flex-col gap-5 lg:col-span-2 lg:min-h-0">
					<section>
						<div class="h-2.5 w-28 rounded bg-brand-50"></div>
						<div class="mt-2 overflow-hidden rounded-card bg-surface shadow-card">
							{#each Array(4) as _, i (i)}
								<div
									class="flex items-center gap-3 px-4 py-3"
									class:border-t={i > 0}
									class:border-border={i > 0}
								>
									<div class="size-5 shrink-0 rounded-full border-2 border-brand-50"></div>
									<div class="min-w-0 flex-1 space-y-1.5">
										<div class="h-3 w-24 rounded bg-brand-50"></div>
										<div class="h-2 w-40 max-w-full rounded bg-brand-50"></div>
									</div>
								</div>
							{/each}
						</div>
					</section>
					<section class="flex flex-col lg:min-h-0 lg:flex-1">
						<div class="flex items-end justify-between">
							<div class="h-2.5 w-24 rounded bg-brand-50"></div>
							<div class="h-2.5 w-16 rounded bg-brand-50"></div>
						</div>
						<div
							class="mt-2 overflow-hidden rounded-card bg-surface shadow-card lg:min-h-0 lg:flex-1"
						>
							{#each Array(5) as _, i (i)}
								<div
									class="flex items-center gap-3 px-4 py-3"
									class:border-t={i > 0}
									class:border-border={i > 0}
								>
									<div class="size-9 shrink-0 rounded-full bg-brand-50"></div>
									<div class="min-w-0 flex-1">
										<div class="h-3 w-32 max-w-full rounded bg-brand-50"></div>
									</div>
									<div class="h-3 w-12 rounded bg-brand-50"></div>
								</div>
							{/each}
						</div>
					</section>
				</div>
			</div>
		</div>
	{:else if tipo === 'gasto-detalle'}
		<!-- /gastos/[id]: volver + 2 columnas (cada columna llena el alto). El
		     "Volver" se omite cuando interior=true (el contenedor padre ya lo
		     pinta, p.ej. el detalle inline en /gastos). -->
		<div class="flex flex-1 flex-col animate-pulse lg:min-h-0">
			{#if !interior}
				<div class="h-4 w-20 rounded bg-brand-50"></div>
			{/if}
			<div class={(interior ? '' : 'mt-4 ') + 'grid flex-1 gap-5 lg:grid-cols-2 lg:gap-6 lg:min-h-0'}>
				<!-- IZQUIERDA: header card + detalles + cómo va cada uno -->
				<div class="flex flex-col gap-5 lg:min-h-0">
					<!-- Header del gasto -->
					<section class="rounded-card border border-border bg-surface p-6 shadow-card">
						<div class="flex items-start gap-4">
							<div class="size-16 shrink-0 rounded-card bg-brand-50"></div>
							<div class="min-w-0 flex-1 space-y-2">
								<div class="h-5 w-48 max-w-full rounded bg-brand-50"></div>
								<div class="h-10 w-40 rounded bg-brand-50"></div>
								<div class="h-2.5 w-56 max-w-full rounded bg-brand-50"></div>
							</div>
							<div class="size-9 shrink-0 rounded-input bg-brand-50"></div>
						</div>
					</section>
					<!-- Detalles 4 filas -->
					<section>
						<div class="h-2.5 w-16 rounded bg-brand-50"></div>
						<div class="mt-2 divide-y divide-border rounded-card bg-surface shadow-card">
							{#each Array(4) as _, i (i)}
								<div class="flex items-center gap-3 px-4 py-3">
									<div class="size-9 shrink-0 rounded-input bg-brand-50"></div>
									<div class="min-w-0 flex-1 space-y-1.5">
										<div class="h-2.5 w-16 rounded bg-brand-50"></div>
										<div class="h-3 w-40 max-w-full rounded bg-brand-50"></div>
									</div>
								</div>
							{/each}
						</div>
					</section>
					<!-- Cómo va cada uno: crece + scroll interno -->
					<section class="flex flex-col lg:min-h-0 lg:flex-1">
						<div class="flex items-end justify-between">
							<div class="h-2.5 w-32 rounded bg-brand-50"></div>
							<div class="h-2.5 w-16 rounded bg-brand-50"></div>
						</div>
						<div
							class="mt-2 overflow-hidden rounded-card bg-surface shadow-card lg:min-h-0 lg:flex-1"
						>
							{#each Array(4) as _, i (i)}
								<div
									class="flex items-center gap-3 px-4 py-3"
									class:border-t={i > 0}
									class:border-border={i > 0}
								>
									<div class="size-10 shrink-0 rounded-full bg-brand-50"></div>
									<div class="min-w-0 flex-1 space-y-1.5">
										<div class="flex items-center justify-between gap-2">
											<div class="h-3 w-32 rounded bg-brand-50"></div>
											<div class="h-5 w-20 rounded-full bg-brand-50"></div>
										</div>
										<div class="h-2.5 w-40 max-w-full rounded bg-brand-50"></div>
										<div class="h-1 rounded-full bg-brand-50"></div>
									</div>
								</div>
							{/each}
						</div>
					</section>
				</div>

				<!-- DERECHA: registrar pago + historial (crece) -->
				<div class="flex flex-col gap-5 lg:min-h-0">
					<!-- Registrar pago -->
					<section>
						<div class="h-2.5 w-32 rounded bg-brand-50"></div>
						<div class="mt-2 rounded-card border border-border bg-surface p-5 shadow-card">
							<div class="flex flex-col gap-3 sm:flex-row sm:items-end">
								<div class="flex-1 space-y-1.5">
									<div class="h-3 w-40 rounded bg-brand-50"></div>
									<div class="h-11 rounded-input bg-brand-50"></div>
								</div>
								<div class="h-11 w-40 shrink-0 rounded-input bg-brand-50"></div>
							</div>
						</div>
					</section>
					<!-- Historial: crece + scroll interno -->
					<section class="flex flex-col lg:min-h-0 lg:flex-1">
						<div class="flex items-end justify-between">
							<div class="h-2.5 w-36 rounded bg-brand-50"></div>
							<div class="h-2.5 w-16 rounded bg-brand-50"></div>
						</div>
						<div
							class="mt-2 overflow-hidden rounded-card bg-surface shadow-card lg:min-h-0 lg:flex-1"
						>
							{#each Array(7) as _, i (i)}
								<div
									class="flex items-center gap-3 px-4 py-3"
									class:border-t={i > 0}
									class:border-border={i > 0}
								>
									<div class="size-9 shrink-0 rounded-full bg-brand-50"></div>
									<div class="min-w-0 flex-1">
										<div class="h-3 w-32 max-w-full rounded bg-brand-50"></div>
									</div>
									<div class="h-3 w-16 shrink-0 rounded bg-brand-50"></div>
								</div>
							{/each}
						</div>
					</section>
				</div>
			</div>
		</div>
	{:else if tipo === 'categorias'}
		<!-- /categorias: volver + header + form fijo + grid de tiles (crece + scroll interno) -->
		<div class="flex flex-1 flex-col animate-pulse lg:min-h-0">
			<div class="h-4 w-20 rounded bg-brand-50"></div>
			<div class="mt-4 flex items-end justify-between gap-3">
				<div class="space-y-2">
					<div class="h-7 w-44 rounded bg-brand-50"></div>
					<div class="h-3 w-64 max-w-full rounded bg-brand-50"></div>
				</div>
				<div class="h-6 w-16 shrink-0 rounded-full bg-brand-50"></div>
			</div>

			<!-- Form horizontal (fijo arriba) -->
			<section class="mt-5">
				<div class="h-2.5 w-28 rounded bg-brand-50"></div>
				<div class="mt-2 rounded-card border border-border bg-surface p-4 shadow-card">
					<div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-5">
						<!-- Nombre -->
						<div class="space-y-1.5 lg:w-96 lg:shrink-0">
							<div class="h-3 w-16 rounded bg-brand-50"></div>
							<div class="h-11 rounded-input bg-brand-50"></div>
						</div>
						<!-- Iconos -->
						<div class="min-w-0 flex-1 space-y-1.5">
							<div class="h-3 w-12 rounded bg-brand-50"></div>
							<div class="flex flex-wrap gap-1.5">
								{#each Array(20) as _, i (i)}
									<div class="size-10 shrink-0 rounded-input bg-brand-50"></div>
								{/each}
							</div>
						</div>
						<!-- Botón -->
						<div class="h-11 w-44 shrink-0 rounded-input bg-brand-50"></div>
					</div>
				</div>
			</section>

			<!-- Grid de tiles: ocupa lo que sobra del alto y scrollea internamente -->
			<section class="mt-5 flex flex-col lg:min-h-0 lg:flex-1">
				<div class="h-2.5 w-36 rounded bg-brand-50"></div>
				<div
					class="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:min-h-0 lg:flex-1 lg:content-start"
				>
					{#each Array(12) as _, i (i)}
						<div
							class="flex flex-col items-center gap-3 rounded-card border border-border bg-surface p-5 text-center shadow-card"
						>
							<div class="size-14 rounded-card bg-brand-50"></div>
							<div class="h-3 w-20 rounded bg-brand-50"></div>
							<div class="mt-1 flex w-full gap-1 border-t border-border pt-3">
								<div class="h-7 flex-1 rounded-input bg-brand-50"></div>
								<div class="h-7 flex-1 rounded-input bg-brand-50"></div>
							</div>
						</div>
					{/each}
				</div>
			</section>
		</div>
	{:else}
		<!-- Genérico (módulos sin layout propio todavía) -->
		<div class="flex min-h-0 flex-1 animate-pulse flex-col">
			<div class="h-6 w-40 rounded bg-brand-50"></div>
			<div class="mt-2.5 h-3 w-64 max-w-full rounded bg-brand-50"></div>
			<div class="mt-5 grid gap-4 sm:grid-cols-2">
				<div class="h-28 rounded-card bg-surface shadow-card"></div>
				<div class="h-28 rounded-card bg-surface shadow-card"></div>
			</div>
			<div class="mt-4 flex-1 rounded-card border border-dashed border-border bg-surface"></div>
		</div>
	{/if}
</div>
