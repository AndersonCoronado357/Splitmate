<script lang="ts">
	import { enhance } from '$app/forms';
	import PasswordInput from '$lib/components/PasswordInput.svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let cargando = $state(false);
</script>

<div class="h-dvh overflow-y-auto bg-bg">
	<div class="flex min-h-full items-center justify-center px-5 py-10">
		<div class="w-full max-w-sm">
			<header class="animate-fade-in mb-4" style="animation-delay: 40ms">
				<h1 class="text-2xl font-bold tracking-tight text-text">Nueva contraseña</h1>
				<p class="mt-1 text-sm text-muted">Escribe tu nueva contraseña para entrar.</p>
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
				style="animation-delay: 110ms"
			>
				<div class="space-y-1.5">
					<label for="password" class="block text-sm font-medium text-text">Nueva contraseña</label>
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
					{cargando ? 'Guardando…' : 'Guardar y entrar'}
				</button>
			</form>
		</div>
	</div>
</div>
