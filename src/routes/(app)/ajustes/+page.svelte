<script lang="ts">
	import Smartphone from '@lucide/svelte/icons/smartphone';
	import PlugZap from '@lucide/svelte/icons/plug-zap';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import LogOut from '@lucide/svelte/icons/log-out';
	import { page } from '$app/state';

	const correo = $derived(page.data.user?.email ?? '');

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

<div class="flex w-full flex-1 flex-col px-5 py-6 md:px-8">
	<header>
		<h1 class="text-2xl font-bold text-text">Ajustes</h1>
	</header>

	<section class="pt-5">
		<h2 class="px-1 text-xs font-semibold tracking-wide text-muted uppercase">Cuenta</h2>
		<div class="mt-2 rounded-card bg-surface p-4 shadow-card">
			<p class="text-xs text-muted">Sesión iniciada como</p>
			<p class="mt-0.5 truncate font-medium text-text">{correo}</p>
			<form method="POST" action="/auth/logout" class="mt-3">
				<button
					type="submit"
					class="flex w-full items-center justify-center gap-2 rounded-input border border-border px-4 py-2.5 text-sm font-medium text-money-contra transition-colors hover:bg-money-contra-bg"
				>
					<LogOut size={16} />
					Cerrar sesión
				</button>
			</form>
		</div>
	</section>

	<section class="pt-6">
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

	<footer class="mt-auto pt-8 pb-2 text-center">
		<p class="text-xs text-muted">Splitmate · versión 0.0.1</p>
	</footer>
</div>
