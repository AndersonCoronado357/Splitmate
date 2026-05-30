<!--
	Skeleton del área de contenido. Copia la ESTRUCTURA real de cada vista (mismos
	contenedores, mismas clases flex-1/min-h-0) para que se vea idéntico al layout
	y llene el 100% del alto/ancho en escritorio. Bloques en turquesa (brand-50)
	sobre las tarjetas reales (surface); acentos de dinero en las tarjetas de saldo.
-->
<script lang="ts">
	import { page } from '$app/state';

	let { ruta = '/' }: { ruta?: string } = $props();

	const tipo = $derived(
		ruta === '/'
			? 'inicio'
			: ruta === '/ajustes'
				? 'ajustes'
				: ruta === '/hogar'
					? 'hogar'
					: 'generico'
	);

	// El rol del hogar activo ya está cargado (viene del layout) → decide si la
	// vista de Hogar muestra 1 o 2 columnas, igual que la real.
	const esAdmin = $derived(
		(page.data.hogarActivo as { rol?: string } | undefined)?.rol === 'admin'
	);
</script>

<div class="flex flex-col px-5 py-6 md:px-8 lg:h-full lg:w-full lg:flex-1" aria-hidden="true">
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
						<div class="size-44 rounded-full bg-brand-50 lg:size-[clamp(12rem,44vh,26rem)]"></div>
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
					<div class="mt-2 flex flex-1 flex-col justify-evenly gap-3 rounded-card bg-surface p-5 shadow-card lg:min-h-0">
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
