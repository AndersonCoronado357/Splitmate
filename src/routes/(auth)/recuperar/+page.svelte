<script lang="ts">
	import { enhance } from '$app/forms';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import logo from '$lib/assets/logo.png';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let cargando = $state(false);

	const inputClass =
		'w-full rounded-input border border-transparent bg-brand-50 px-3 py-2.5 text-text outline-none placeholder:text-muted/70';
</script>

<div class="w-full">
	<div class="animate-fade-in mb-5 flex items-center justify-center gap-2 lg:hidden" style="animation-delay: 0ms">
		<img src={logo} alt="" class="h-8 w-8" />
		<span class="text-xl font-bold tracking-tight text-text">Splitmate</span>
	</div>

	<header class="animate-fade-in mb-4" style="animation-delay: 70ms">
		<h1 class="text-2xl font-bold tracking-tight text-text sm:text-3xl">Recuperar contraseña</h1>
		<p class="mt-1 text-sm text-muted">Te enviamos un enlace para crear una nueva.</p>
	</header>

	{#if form?.sent}
		<div
			class="animate-fade-in rounded-card bg-brand-50 px-4 py-5 text-center"
			style="animation-delay: 140ms"
		>
			<p class="font-medium text-text">Revisa tu correo</p>
			<p class="mt-1 text-sm text-muted">
				Si <span class="font-medium">{form.email}</span> tiene una cuenta, te llegó un enlace para
				restablecer la contraseña.
			</p>
		</div>
	{:else}
		<form
			method="POST"
			use:enhance={() => {
				cargando = true;
				return async ({ update }) => {
					await update();
					cargando = false;
				};
			}}
			class="animate-fade-in space-y-3"
			style="animation-delay: 140ms"
		>
			<div class="space-y-1.5">
				<label for="email" class="block text-sm font-medium text-text">Correo</label>
				<input
					id="email"
					name="email"
					type="email"
					autocomplete="email"
					inputmode="email"
					required
					value={form?.email ?? ''}
					placeholder="tu@correo.com"
					class={inputClass}
				/>
			</div>

			{#if form?.error}
				<p class="rounded-input bg-money-contra-bg px-3 py-2.5 text-sm text-money-contra">
					{form.error}
				</p>
			{/if}

			<button
				type="submit"
				disabled={cargando}
				class="h-11 w-full rounded-input bg-brand-500 font-semibold text-white transition-transform hover:bg-brand-700 active:scale-[0.99] disabled:opacity-60"
			>
				{cargando ? 'Enviando…' : 'Enviar enlace'}
			</button>
		</form>
	{/if}

	<p class="animate-fade-in mt-6 text-center text-sm text-muted" style="animation-delay: 210ms">
		<a
			href="/login"
			class="inline-flex items-center gap-1.5 font-medium text-brand-700 hover:underline"
		>
			<ArrowLeft size={15} /> Volver a iniciar sesión
		</a>
	</p>
</div>
