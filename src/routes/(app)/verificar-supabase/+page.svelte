<script lang="ts">
	let { data } = $props();
</script>

<main class="w-full px-5 py-6 md:px-8">
	<header>
		<p class="text-sm text-muted">
			<a href="/ajustes" class="text-brand-500 underline">← Ajustes</a>
		</p>
		<h1 class="mt-1 text-2xl font-bold text-text">Verificar Supabase</h1>
		<p class="mt-1 text-muted">Paso 0.2: confirmar que el proyecto se conecta.</p>
	</header>

	<section
		class="mt-6 rounded-card p-5 shadow-card"
		class:bg-money-favor-bg={data.conexionPublishable.ok}
		class:bg-money-contra-bg={!data.conexionPublishable.ok}
	>
		<p class="text-sm text-muted">Conexión con llave publishable (cliente)</p>
		<p
			class="mt-1 text-xl font-bold"
			class:text-money-favor={data.conexionPublishable.ok}
			class:text-money-contra={!data.conexionPublishable.ok}
		>
			{data.conexionPublishable.ok ? '✓ Conectado' : '✗ Sin conexión'}
		</p>
		<p class="mt-1 text-sm text-text">{data.conexionPublishable.mensaje}</p>
	</section>

	<section
		class="mt-4 rounded-card p-5 shadow-card"
		class:bg-money-favor-bg={data.conexionSecret.ok}
		class:bg-money-contra-bg={!data.conexionSecret.ok}
	>
		<p class="text-sm text-muted">Conexión con llave secret (servidor)</p>
		<p
			class="mt-1 text-xl font-bold"
			class:text-money-favor={data.conexionSecret.ok}
			class:text-money-contra={!data.conexionSecret.ok}
		>
			{data.conexionSecret.ok ? '✓ Conectado' : '✗ Sin conexión'}
		</p>
		<p class="mt-1 text-sm text-text">{data.conexionSecret.mensaje}</p>
	</section>

	<section class="mt-6 rounded-card bg-surface p-5 shadow-card">
		<h2 class="text-sm font-semibold text-text">Variables de entorno</h2>
		<dl class="mt-3 space-y-3 text-sm">
			<div>
				<dt class="text-muted">PUBLIC_SUPABASE_URL</dt>
				<dd
					class="tabular mt-0.5 font-medium"
					class:text-money-favor={data.checks.url.configurado}
					class:text-money-contra={!data.checks.url.configurado}
				>
					{data.checks.url.valor}
				</dd>
			</div>
			<div>
				<dt class="text-muted">PUBLIC_SUPABASE_PUBLISHABLE_KEY</dt>
				<dd
					class="tabular mt-0.5 font-medium"
					class:text-money-favor={data.checks.publishable.configurado}
					class:text-money-contra={!data.checks.publishable.configurado}
				>
					{data.checks.publishable.valor}
				</dd>
			</div>
			<div>
				<dt class="text-muted">SUPABASE_SECRET_KEY</dt>
				<dd
					class="tabular mt-0.5 font-medium"
					class:text-money-favor={data.checks.secret.configurado}
					class:text-money-contra={!data.checks.secret.configurado}
				>
					{data.checks.secret.valor}
				</dd>
			</div>
		</dl>
	</section>

	<section class="mt-6 rounded-card border border-border bg-surface p-5">
		<h2 class="text-sm font-semibold text-text">¿Qué hace esta página?</h2>
		<ul class="mt-2 list-inside list-disc space-y-1 text-sm text-text">
			<li>
				Lee las llaves desde <code>.env</code>.
			</li>
			<li>
				Crea un cliente Supabase con la llave pública y llama
				<code>auth.getSession()</code>.
			</li>
			<li>
				Si la URL y la llave son válidas, ves <span class="text-money-favor">✓ Conectado</span>.
			</li>
			<li>
				La <code>secret</code> se prueba desde el servidor (SSR) con el SDK
				oficial: lista 1 usuario admin para confirmar que tiene permisos de
				servicio. La <code>secret</code> nunca viaja al navegador.
			</li>
		</ul>
	</section>
</main>
