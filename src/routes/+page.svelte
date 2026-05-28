<script lang="ts">
	const muestra = [
		{ nombre: 'brand-50', valor: '#E6F7F5' },
		{ nombre: 'brand-200', valor: '#9FE3DC' },
		{ nombre: 'brand-400', valor: '#46C9BC' },
		{ nombre: 'brand-500', valor: '#0EB5A6' },
		{ nombre: 'brand-700', valor: '#0A8A7E' },
		{ nombre: 'brand-900', valor: '#075C54' }
	];
</script>

<main class="mx-auto max-w-md p-6 pb-24">
	<header>
		<p class="text-sm text-muted">Vista de humo · Paso 0.1</p>
		<h1 class="mt-1 text-3xl font-bold text-brand-500">Splitmate</h1>
		<p class="mt-1 text-muted">El compañero para dividir los gastos del hogar.</p>
	</header>

	<section class="mt-6 rounded-card bg-surface p-5 shadow-card">
		<p class="text-sm text-muted">Saldo total</p>
		<p class="tabular mt-1 text-4xl font-bold text-money-favor">+ $ 0</p>
		<p class="mt-1 text-sm text-muted">Sin movimientos todavía.</p>
	</section>

	<section class="mt-4 grid grid-cols-2 gap-3">
		<div class="rounded-card bg-money-favor-bg p-4">
			<p class="text-xs text-muted">A favor</p>
			<p class="tabular mt-1 text-lg font-semibold text-money-favor">+ $ 0</p>
		</div>
		<div class="rounded-card bg-money-contra-bg p-4">
			<p class="text-xs text-muted">En contra</p>
			<p class="tabular mt-1 text-lg font-semibold text-money-contra">− $ 0</p>
		</div>
	</section>

	<section class="mt-8">
		<h2 class="text-sm font-semibold text-text">Paleta turquesa</h2>
		<div class="mt-2 grid grid-cols-3 gap-2">
			{#each muestra as c (c.nombre)}
				<div class="overflow-hidden rounded-input border border-border">
					<div class="h-10" style="background: {c.valor}"></div>
					<div class="bg-surface p-2">
						<p class="text-[10px] text-muted">{c.nombre}</p>
						<p class="text-[11px] font-medium text-text">{c.valor}</p>
					</div>
				</div>
			{/each}
		</div>
	</section>

	<section class="mt-8 space-y-2">
		<a
			href="/verificar-supabase"
			class="block rounded-input bg-brand-500 px-4 py-3 text-center font-semibold text-white hover:bg-brand-700"
		>
			Verificar conexión a Supabase
		</a>
		<a
			href="/como-instalar"
			class="block rounded-input border border-border bg-surface px-4 py-3 text-center font-medium text-brand-700 hover:bg-brand-50"
		>
			Cómo instalar en el celular
		</a>
	</section>

	<footer class="mt-10 border-t border-border pt-4 text-xs text-muted">
		Si ves los colores correctos y la tipografía limpia, el paso 0.1 está OK.
		Toca el botón de arriba para validar el paso 0.2 (Supabase).
	</footer>
</main>
