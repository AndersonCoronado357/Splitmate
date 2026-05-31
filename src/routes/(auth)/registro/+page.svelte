<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import PasswordInput from '$lib/components/PasswordInput.svelte';
	import { supabaseBrowser } from '$lib/supabase-browser';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let cargando = $state(false);

	// Destino tras crear la cuenta (p. ej. al abrir un link de invitación).
	const next = $derived(page.url.searchParams.get('next') ?? '');
	const loginHref = $derived(next ? `/login?next=${encodeURIComponent(next)}` : '/login');

	const inputClass =
		'w-full rounded-input border border-transparent bg-brand-50 px-3 py-2.5 text-text outline-none placeholder:text-muted/70';

	async function entrarConGoogle() {
		cargando = true;
		const destino = next ? `?next=${encodeURIComponent(next)}` : '';
		const { error } = await supabaseBrowser().auth.signInWithOAuth({
			provider: 'google',
			options: { redirectTo: `${location.origin}/auth/callback${destino}` }
		});
		if (error) cargando = false;
	}
</script>

<div class="w-full">
	<div class="animate-fade-in mb-5 flex justify-center lg:hidden" style="animation-delay: 0ms">
		<span class="text-xl font-bold tracking-tight text-text">Splitmate</span>
	</div>

	<header class="animate-fade-in mb-4" style="animation-delay: 70ms">
		<h1 class="text-2xl font-bold tracking-tight text-text sm:text-3xl">Crea tu cuenta</h1>
		<p class="mt-1 text-sm text-muted">Empieza a llevar las cuentas de tu hogar.</p>
	</header>

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
			<label for="nombre" class="block text-sm font-medium text-text">Tu nombre</label>
			<input
				id="nombre"
				name="nombre"
				type="text"
				autocomplete="name"
				required
				value={form?.nombre ?? ''}
				placeholder="¿Cómo te llamas?"
				class={inputClass}
			/>
		</div>

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

		<div class="space-y-1.5">
			<label for="password" class="block text-sm font-medium text-text">Contraseña</label>
			<PasswordInput
				id="password"
				autocomplete="new-password"
				required
				minlength={6}
				placeholder="Mínimo 6 caracteres"
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
			{cargando ? 'Creando…' : 'Crear cuenta'}
		</button>
	</form>

	<div class="animate-fade-in my-3 flex items-center gap-3" style="animation-delay: 210ms">
		<span class="h-px flex-1 bg-border"></span>
		<span class="text-xs tracking-wider text-muted uppercase">o</span>
		<span class="h-px flex-1 bg-border"></span>
	</div>

	<button
		type="button"
		onclick={entrarConGoogle}
		disabled={cargando}
		class="animate-fade-in flex h-11 w-full items-center justify-center gap-3 rounded-input border border-border bg-surface font-medium text-text transition-transform hover:bg-bg active:scale-[0.99] disabled:opacity-60"
		style="animation-delay: 280ms"
	>
		<svg class="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
			<path
				fill="#4285F4"
				d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"
			/>
			<path
				fill="#34A853"
				d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
			/>
			<path
				fill="#FBBC05"
				d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84Z"
			/>
			<path
				fill="#EA4335"
				d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.39 14.97.4 12 .4A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 6.68 9.14 4.75 12 4.75Z"
			/>
		</svg>
		Continuar con Google
	</button>

	<p class="animate-fade-in mt-4 text-center text-sm text-muted" style="animation-delay: 350ms">
		¿Ya tienes cuenta?
		<a href={loginHref} class="font-medium text-brand-700 hover:underline">Inicia sesión</a>
	</p>
</div>
