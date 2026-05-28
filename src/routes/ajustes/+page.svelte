<script lang="ts">
	import Smartphone from '@lucide/svelte/icons/smartphone';
	import PlugZap from '@lucide/svelte/icons/plug-zap';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';

	const herramientas = [
		{
			href: '/como-instalar',
			titulo: 'Cómo instalar en el celular',
			detalle: 'Añade Splitmate a tu pantalla de inicio',
			icon: Smartphone
		},
		{
			href: '/verificar-supabase',
			titulo: 'Verificar conexión',
			detalle: 'Estado de la conexión con Supabase',
			icon: PlugZap
		}
	];
</script>

<div class="flex w-full flex-1 flex-col px-5 py-1 md:px-8">
	<header class="px-5 pt-6 pb-2">
		<h1 class="text-2xl font-bold text-text">Ajustes</h1>
	</header>

	<section class="px-5 pt-4">
		<h2 class="px-1 text-xs font-semibold tracking-wide text-muted uppercase">Cuenta y hogar</h2>
		<div class="mt-2 rounded-card border border-dashed border-border bg-surface px-5 py-6 text-center">
			<p class="text-sm text-muted">
				La cuenta y la gestión del hogar llegan en la siguiente fase (inicio de sesión e
				invitaciones).
			</p>
		</div>
	</section>

	<section class="px-5 pt-6 pb-8">
		<h2 class="px-1 text-xs font-semibold tracking-wide text-muted uppercase">Herramientas</h2>
		<ul class="mt-2 overflow-hidden rounded-card bg-surface shadow-card">
			{#each herramientas as item, i (item.href)}
				{@const Icono = item.icon}
				<li>
					<a
						href={item.href}
						class="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-brand-50"
						class:border-t={i > 0}
						class:border-border={i > 0}
					>
						<span class="rounded-input bg-brand-50 p-2 text-brand-500">
							<Icono size={18} />
						</span>
						<span class="flex-1">
							<span class="block text-sm font-medium text-text">{item.titulo}</span>
							<span class="block text-xs text-muted">{item.detalle}</span>
						</span>
						<ChevronRight size={18} class="text-muted" />
					</a>
				</li>
			{/each}
		</ul>
	</section>

	<footer class="mt-auto px-5 pb-6 text-center">
		<p class="text-xs text-muted">Splitmate · versión 0.0.1</p>
	</footer>
</div>
