<script lang="ts">
	import { enhance } from '$app/forms';
	import Select from '$lib/components/Select.svelte';
	import DecorPanel from '$lib/components/DecorPanel.svelte';
	import { monedas } from '$lib/monedas';
	import favicon from '$lib/assets/favicon.svg';
	import Home from '@lucide/svelte/icons/house';
	import Users from '@lucide/svelte/icons/users';
	import Receipt from '@lucide/svelte/icons/receipt';
	import LogOut from '@lucide/svelte/icons/log-out';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let tab = $state<'crear' | 'unir'>('crear');
	let moneda = $state('COP');
	let cargando = $state(false);

	const inputClass =
		'w-full rounded-input border border-transparent bg-brand-50 px-3 py-2.5 text-text outline-none placeholder:text-muted/70';

	function onEnhance() {
		cargando = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			cargando = false;
		};
	}

	const pasos = [
		{
			icon: Home,
			titulo: 'Crea tu hogar',
			texto: 'Ponle nombre y elige la moneda en la que llevarán las cuentas.'
		},
		{
			icon: Users,
			titulo: 'Invita a los tuyos',
			texto: 'Comparte un código y suma a tu pareja, familia o roomies.'
		},
		{
			icon: Receipt,
			titulo: 'Registren gastos',
			texto: 'Splitmate netea quién le debe a quién, al instante.'
		}
	];
</script>

<div class="relative h-dvh overflow-y-auto bg-bg lg:overflow-hidden">
	<!-- Panel decorativo (solo desktop) -->
	<aside
		aria-hidden="true"
		class="hidden lg:absolute lg:inset-y-0 lg:left-0 lg:flex lg:w-1/2"
	>
		<DecorPanel modo="bienvenida" />
	</aside>

	<!-- Columna de contenido -->
	<div
		class="flex min-h-dvh items-center justify-center px-6 py-10 lg:absolute lg:inset-y-0 lg:right-0 lg:w-1/2 lg:overflow-y-auto lg:px-12"
	>
		<div class="animate-fade-in w-full max-w-md">
			<!-- Marca (solo móvil; en desktop la muestra el panel) -->
			<div class="flex items-center gap-2 lg:hidden">
				<img src={favicon} alt="" class="h-9 w-9" />
				<span class="text-xl font-bold text-text">Splitmate</span>
			</div>

			<!-- Saludo -->
			<div class="mt-7 lg:mt-0">
				<h1 class="text-3xl font-bold tracking-tight text-text">
					¡Hola{data.nombre ? `, ${data.nombre}` : ''}!
				</h1>
				<p class="mt-2 text-muted">
					Para empezar a usar Splitmate necesitas un hogar. Crea uno nuevo o únete a uno con el
					código de quien te invitó.
				</p>
			</div>

			<!-- Tabs -->
			<div class="mt-7 grid grid-cols-2 gap-1 rounded-input bg-surface p-1 shadow-card">
				<button
					type="button"
					onclick={() => (tab = 'crear')}
					class={'rounded-[10px] px-3 py-2 text-sm font-medium transition-colors ' +
						(tab === 'crear' ? 'bg-brand-500 text-white' : 'text-muted hover:text-text')}
				>
					Crear hogar
				</button>
				<button
					type="button"
					onclick={() => (tab = 'unir')}
					class={'rounded-[10px] px-3 py-2 text-sm font-medium transition-colors ' +
						(tab === 'unir' ? 'bg-brand-500 text-white' : 'text-muted hover:text-text')}
				>
					Unirme
				</button>
			</div>

			{#if tab === 'crear'}
				<form method="POST" action="?/crear" use:enhance={onEnhance} class="mt-5 space-y-4">
					<div class="space-y-1.5">
						<label for="nombre" class="block text-sm font-medium text-text">Nombre del hogar</label>
						<input
							id="nombre"
							name="nombre"
							type="text"
							required
							placeholder="Casa, Apto 301, Roomies…"
							class={inputClass}
						/>
					</div>
					<div class="space-y-1.5">
						<label for="moneda" class="block text-sm font-medium text-text">Moneda</label>
						<Select id="moneda" name="moneda" bind:value={moneda} options={monedas} />
						<p class="text-xs text-muted">Es la moneda en la que verán todos los montos del hogar.</p>
					</div>

					{#if form?.error && form?.modo === 'crear'}
						<p class="rounded-input bg-money-contra-bg px-3 py-2.5 text-sm text-money-contra">
							{form.error}
						</p>
					{/if}

					<button
						type="submit"
						disabled={cargando}
						class="h-11 w-full rounded-input bg-brand-500 font-semibold text-white transition-transform hover:bg-brand-700 active:scale-[0.99] disabled:opacity-60"
					>
						{cargando ? 'Creando…' : 'Crear hogar'}
					</button>
				</form>
			{:else}
				<form method="POST" action="?/unir" use:enhance={onEnhance} class="mt-5 space-y-4">
					<div class="space-y-1.5">
						<label for="codigo" class="block text-sm font-medium text-text">
							Código de invitación
						</label>
						<input
							id="codigo"
							name="codigo"
							type="text"
							required
							placeholder="Ej. A3F9C2"
							autocapitalize="characters"
							class={inputClass + ' uppercase tracking-[0.2em]'}
						/>
						<p class="text-xs text-muted">Te lo comparte alguien que ya está en el hogar.</p>
					</div>

					{#if form?.error && form?.modo === 'unir'}
						<p class="rounded-input bg-money-contra-bg px-3 py-2.5 text-sm text-money-contra">
							{form.error}
						</p>
					{/if}

					<button
						type="submit"
						disabled={cargando}
						class="h-11 w-full rounded-input bg-brand-500 font-semibold text-white transition-transform hover:bg-brand-700 active:scale-[0.99] disabled:opacity-60"
					>
						{cargando ? 'Uniéndote…' : 'Unirme al hogar'}
					</button>
				</form>
			{/if}

			<!-- Cómo funciona -->
			<div class="mt-8 border-t border-border pt-6">
				<p class="text-sm font-semibold text-text">Cómo funciona</p>
				<ul class="mt-4 space-y-4">
					{#each pasos as paso (paso.titulo)}
						<li class="flex gap-3">
							<span
								class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700"
							>
								<paso.icon size={18} />
							</span>
							<div class="min-w-0">
								<p class="text-sm font-medium text-text">{paso.titulo}</p>
								<p class="text-sm text-muted">{paso.texto}</p>
							</div>
						</li>
					{/each}
				</ul>
			</div>

			<!-- Cerrar sesión -->
			<form method="POST" action="/auth/logout" class="mt-8">
				<button
					type="submit"
					class="flex w-full items-center justify-center gap-2 rounded-input px-4 py-2.5 text-sm font-semibold text-money-contra transition-colors hover:bg-money-contra-bg"
				>
					<LogOut size={16} />
					Cerrar sesión
				</button>
			</form>
		</div>
	</div>
</div>
