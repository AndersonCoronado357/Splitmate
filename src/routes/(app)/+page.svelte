<script lang="ts">
	let { data } = $props();

	// Datos placeholder (el balance real llega en fases siguientes).
	const saldoNeto = 0;
	const aFavor = 0;
	const enContra = 0;
	const personas: { nombre: string; saldo: number }[] = [];

	const fmt = (n: number) =>
		new Intl.NumberFormat('es-CO', {
			style: 'currency',
			currency: data.hogarActivo?.moneda || 'COP',
			maximumFractionDigits: 0
		}).format(n);

	const signo = (n: number) => (n > 0 ? '+ ' : n < 0 ? '− ' : '');

	const colorSaldo = (n: number) =>
		n > 0 ? 'text-money-favor' : n < 0 ? 'text-money-contra' : 'text-text';
</script>

<div class="flex flex-col px-5 py-6 md:px-8 lg:flex-1">
	<header>
		<p class="text-xs text-muted">Hola, {data.perfil?.display_name || 'bienvenido'}</p>
		<p class="text-lg font-semibold text-text">{data.hogarActivo?.nombre}</p>
	</header>

	<!-- Tarjetas de resumen: en fila en pantallas grandes -->
	<section class="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3">
		<div class="col-span-2 rounded-card border border-border bg-surface p-5 shadow-card md:col-span-1">
			<p class="text-sm text-muted">Tu saldo</p>
			<p class="tabular mt-1 text-4xl font-bold {colorSaldo(saldoNeto)}">
				{signo(saldoNeto)}{fmt(Math.abs(saldoNeto))}
			</p>
			<p class="mt-1 text-sm text-muted">
				{#if saldoNeto === 0}
					Estás en cero. Sin deudas pendientes.
				{:else if saldoNeto > 0}
					En total te deben.
				{:else}
					En total debes.
				{/if}
			</p>
		</div>

		<div class="rounded-card bg-money-favor-bg p-5">
			<p class="text-sm text-money-favor">Te deben</p>
			<p class="tabular mt-1 text-2xl font-semibold text-money-favor">{fmt(aFavor)}</p>
		</div>

		<div class="rounded-card bg-money-contra-bg p-5">
			<p class="text-sm text-money-contra">Debes</p>
			<p class="tabular mt-1 text-2xl font-semibold text-money-contra">{fmt(enContra)}</p>
		</div>
	</section>

	<!-- Por persona -->
	<section class="mt-8 flex flex-1 flex-col">
		<h2 class="text-sm font-semibold text-text">Por persona</h2>
		{#if personas.length === 0}
			<div
				class="mt-3 flex flex-1 flex-col items-center justify-center rounded-card border border-dashed border-border bg-surface px-6 py-14 text-center"
			>
				<p class="font-medium text-text">Aún no hay movimientos</p>
				<p class="mt-1 text-sm text-muted">
					Cuando registres un gasto compartido o un préstamo, aquí verás cuánto te deben y a quién le
					debes, ya neteado.
				</p>
			</div>
		{:else}
			<ul class="mt-3 grid gap-2 sm:grid-cols-2">
				{#each personas as p (p.nombre)}
					<li class="flex items-center justify-between rounded-card bg-surface p-4 shadow-card">
						<span class="font-medium text-text">{p.nombre}</span>
						<span class="tabular font-semibold {colorSaldo(p.saldo)}">
							{signo(p.saldo)}{fmt(Math.abs(p.saldo))}
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>
