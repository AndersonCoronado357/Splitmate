<script lang="ts">
	import { enhance } from '$app/forms';
	import DecorPanel from '$lib/components/DecorPanel.svelte';
	import PasswordInput from '$lib/components/PasswordInput.svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let cargando = $state(false);
</script>

<div class="relative h-dvh overflow-x-hidden overflow-y-auto bg-bg lg:overflow-hidden">
	<!-- Panel decorativo (izquierda en desktop, oculto en móvil) -->
	<aside
		aria-hidden="true"
		class="hidden lg:absolute lg:inset-y-0 lg:left-0 lg:flex lg:w-1/2"
	>
		<DecorPanel modo="login" />
	</aside>

	<!-- Formulario (derecha en desktop) -->
	<div
		class="flex min-h-dvh items-center justify-center px-6 py-8 lg:absolute lg:inset-y-0 lg:right-0 lg:w-1/2 lg:px-12 lg:py-12"
	>
		<div class="w-full max-w-sm">
			<div class="animate-fade-in mb-5 flex justify-center lg:hidden" style="animation-delay: 0ms">
				<span class="text-xl font-bold tracking-tight text-text">Splitmate</span>
			</div>

			<header class="animate-fade-in mb-6" style="animation-delay: 70ms">
				<h1 class="text-2xl font-bold tracking-tight text-text sm:text-3xl">
					Crea una nueva contraseña
				</h1>
				<p class="mt-1 text-sm text-muted">Será tu nueva contraseña para entrar a Splitmate.</p>
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
				class="animate-fade-in space-y-3.5"
				style="animation-delay: 140ms"
			>
				<div class="space-y-1.5">
					<label for="password" class="block text-sm font-medium text-text">Nueva contraseña</label>
					<PasswordInput
						id="password"
						name="password"
						autocomplete="new-password"
						required
						minlength={6}
						placeholder="Mínimo 6 caracteres"
					/>
				</div>

				<div class="space-y-1.5">
					<label for="password_confirm" class="block text-sm font-medium text-text">Repítela</label>
					<PasswordInput
						id="password_confirm"
						name="password_confirm"
						autocomplete="new-password"
						required
						minlength={6}
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
					class="mt-1 h-12 w-full rounded-input bg-brand-500 font-semibold text-white transition-transform hover:bg-brand-700 active:scale-[0.99] disabled:opacity-60"
				>
					{cargando ? 'Guardando…' : 'Guardar y entrar'}
				</button>
			</form>

			<p class="animate-fade-in mt-6 text-center text-sm text-muted" style="animation-delay: 210ms">
				<a href="/login" class="font-medium text-brand-700 hover:underline">
					Volver a iniciar sesión
				</a>
			</p>
		</div>
	</div>
</div>
