<script lang="ts">
	import { enhance } from '$app/forms';
	import Smartphone from '@lucide/svelte/icons/smartphone';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Camera from '@lucide/svelte/icons/camera';
	import House from '@lucide/svelte/icons/house';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import PasswordInput from '$lib/components/PasswordInput.svelte';
	import RecorteFoto from '$lib/components/RecorteFoto.svelte';
	import { page } from '$app/state';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	const perfil = $derived(
		page.data.perfil ?? {
			display_name: '',
			email: '',
			avatar: null as string | null,
			fotoPropia: false,
			desde: null as string | null
		}
	);

	const hogarActivo = $derived(
		page.data.hogarActivo as { nombre: string; rol: string; miembros?: number } | undefined
	);

	const miembroDesde = $derived(
		perfil.desde
			? new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(
					new Date(perfil.desde)
				)
			: null
	);

	const rolLabel = (rol: string) => (rol === 'admin' ? 'Administrador' : 'Miembro');

	const iniciales = $derived(
		((perfil.display_name || perfil.email || '?')
			.trim()
			.split(/\s+/)
			.map((w: string) => w[0])
			.slice(0, 2)
			.join('') || '?'
		).toUpperCase()
	);

	let nombre = $state('');
	let subiendoFoto = $state(false);
	let guardandoClave = $state(false);
	let fileInput = $state<HTMLInputElement>();
	let imgError = $state(false);
	let confirmarSalir = $state(false);
	let archivoFoto = $state<File | null>(null);

	$effect(() => {
		nombre = perfil.display_name ?? '';
	});
	$effect(() => {
		void perfil.avatar;
		imgError = false;
	});

	function abrirSelectorFoto() {
		fileInput?.click();
	}
	// Al elegir un archivo, abre el recortador (no sube de una).
	function onArchivo(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const f = input.files?.[0];
		if (f) archivoFoto = f;
	}

	// El recortador devuelve la imagen final → la pone en el input y envía.
	function fotoRecortada(file: File) {
		archivoFoto = null;
		if (!fileInput) return;
		const dt = new DataTransfer();
		dt.items.add(file);
		fileInput.files = dt.files;
		if (typeof fileInput.form?.requestSubmit === 'function') fileInput.form.requestSubmit();
		else fileInput.form?.submit();
	}

	function cancelarRecorte() {
		archivoFoto = null;
		if (fileInput) fileInput.value = '';
	}

	function guardarNombre(e: FocusEvent) {
		const el = e.currentTarget as HTMLInputElement;
		const v = nombre.trim();
		if (!v || v === (perfil.display_name ?? '')) {
			nombre = perfil.display_name ?? '';
			return;
		}
		el.form?.requestSubmit();
	}
	function onNombreKey(e: KeyboardEvent) {
		const el = e.currentTarget as HTMLInputElement;
		if (e.key === 'Enter') {
			e.preventDefault();
			el.blur();
		} else if (e.key === 'Escape') {
			nombre = perfil.display_name ?? '';
			el.blur();
		}
	}

	const herramientas = [
		{
			href: '/como-instalar',
			titulo: 'Cómo instalar en el celular',
			detalle: 'Añade Splitmate a tu pantalla de inicio',
			icon: Smartphone
		}
	];
</script>

<div class="flex flex-col px-5 py-6 md:px-8 lg:h-full lg:w-full lg:flex-1">
	<header>
		<h1 class="text-2xl font-bold text-text">Ajustes</h1>
	</header>

	<div class="mt-5 grid gap-5 lg:min-h-0 lg:flex-1 lg:grid-cols-2">
		<!-- ===================== IZQUIERDA: PERFIL ===================== -->
		<section class="flex flex-col lg:min-h-0">
			<h2 class="px-1 text-xs font-semibold tracking-wide text-muted uppercase">Perfil</h2>
			<div class="mt-2 flex flex-1 flex-col rounded-card bg-surface p-6 shadow-card lg:min-h-0">
				<div class="flex flex-1 flex-col items-center justify-center gap-4 text-center">
				<!-- Foto (grande) -->
				<form
					method="POST"
					action="?/subirFoto"
					enctype="multipart/form-data"
					use:enhance={() => {
						subiendoFoto = true;
						return async ({ update }) => {
							await update({ reset: false });
							subiendoFoto = false;
						};
					}}
				>
					<input
						bind:this={fileInput}
						type="file"
						name="foto"
						accept="image/*"
						class="hidden"
						onchange={onArchivo}
					/>
					<button
						type="button"
						onclick={abrirSelectorFoto}
						disabled={subiendoFoto}
						class="group relative block size-44 rounded-full disabled:opacity-60 lg:size-[clamp(12rem,44vh,26rem)]"
						aria-label="Cambiar foto"
					>
						<div class="size-full overflow-hidden rounded-full ring-4 ring-brand-50">
							{#if perfil.avatar && !imgError}
								<img
									src={perfil.avatar}
									alt="Tu foto"
									referrerpolicy="no-referrer"
									onerror={() => (imgError = true)}
									class="size-full object-cover"
								/>
							{:else}
								<span
									class="flex size-full items-center justify-center bg-brand-50 text-5xl font-bold text-brand-700"
								>
									{iniciales}
								</span>
							{/if}
						</div>
						<span
							class="absolute right-[7%] bottom-[7%] flex size-10 items-center justify-center rounded-full bg-brand-500 text-white shadow-card ring-2 ring-surface transition-colors duration-200 ease-out group-hover:bg-brand-700 lg:size-12"
						>
							{#if subiendoFoto}
								<span
									class="block size-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
								></span>
							{:else}
								<Camera size={18} />
							{/if}
						</span>
					</button>
				</form>

				<!-- Nombre (texto editable; se guarda al salir, sin botón) -->
				<form
					method="POST"
					action="?/guardarNombre"
					use:enhance={() => async ({ update }) => {
						await update({ reset: false });
					}}
					class="w-full"
				>
					<input
						name="nombre"
						bind:value={nombre}
						maxlength="60"
						placeholder="Tu nombre"
						onblur={guardarNombre}
						onkeydown={onNombreKey}
						aria-label="Tu nombre"
						class="mx-auto block w-full max-w-sm rounded-input border border-transparent bg-transparent px-2 py-1 text-center text-3xl font-bold text-text outline-none transition-colors duration-200 ease-out hover:bg-brand-50 focus:bg-brand-50 lg:text-4xl"
					/>
				</form>
				<p class="-mt-2 text-muted lg:text-lg">{perfil.email}</p>

				<div class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
					<button
						type="button"
						onclick={abrirSelectorFoto}
						class="text-sm font-medium text-brand-700 hover:underline"
					>
						Cambiar foto
					</button>
					{#if perfil.fotoPropia}
						<form
							method="POST"
							action="?/quitarFoto"
							use:enhance={() => {
								subiendoFoto = true;
								return async ({ update }) => {
									await update({ reset: false });
									subiendoFoto = false;
								};
							}}
						>
							<button type="submit" class="text-sm font-medium text-muted hover:text-text">
								Quitar foto
							</button>
						</form>
					{/if}
				</div>

				{#if form?.seccion === 'foto' && form?.error}
						<p class="rounded-input bg-money-contra-bg px-3 py-1.5 text-sm text-money-contra">
							{form.error}
						</p>
					{/if}
				</div>

				<!-- Datos de la cuenta (rellena la parte baja de la tarjeta) -->
				<div class="mt-3 grid gap-2 border-t border-border pt-4 text-left sm:grid-cols-2">
					<div class="flex items-center gap-3 rounded-input bg-brand-50/60 p-3">
						<span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
							<CalendarDays size={17} />
						</span>
						<div class="min-w-0">
							<p class="text-xs text-muted">Miembro desde</p>
							<p class="truncate text-sm font-semibold text-text first-letter:uppercase">
								{miembroDesde ?? '—'}
							</p>
						</div>
					</div>
					{#if hogarActivo}
						<div class="flex items-center gap-3 rounded-input bg-brand-50/60 p-3">
							<span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
								<House size={17} />
							</span>
							<div class="min-w-0">
								<p class="text-xs text-muted">{rolLabel(hogarActivo.rol)} en</p>
								<p class="truncate text-sm font-semibold text-text">{hogarActivo.nombre}</p>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</section>

		<!-- ===================== DERECHA ===================== -->
		<div class="flex flex-col gap-5 lg:min-h-0">
			<!-- Seguridad -->
			<section class="flex flex-col lg:min-h-0 lg:flex-1">
				<h2 class="px-1 text-xs font-semibold tracking-wide text-muted uppercase">Seguridad</h2>
				<div class="mt-2 flex flex-1 flex-col rounded-card bg-surface p-5 shadow-card lg:min-h-0">
					<form
						method="POST"
						action="?/cambiarContrasena"
						use:enhance={() => {
							guardandoClave = true;
							return async ({ update }) => {
								await update();
								guardandoClave = false;
							};
						}}
						class="flex flex-1 flex-col justify-evenly gap-3"
					>
						<div class="space-y-1.5">
							<label for="actual" class="block text-sm font-medium text-text">Contraseña actual</label
							>
							<PasswordInput
								id="actual"
								name="actual"
								autocomplete="current-password"
								placeholder="Tu contraseña de ahora"
							/>
						</div>
						<div class="space-y-1.5">
							<label for="nueva" class="block text-sm font-medium text-text">Nueva contraseña</label>
							<PasswordInput
								id="nueva"
								name="nueva"
								autocomplete="new-password"
								placeholder="Mínimo 8 caracteres"
							/>
						</div>
						<div class="space-y-1.5">
							<label for="repetir" class="block text-sm font-medium text-text"
								>Repite la nueva</label
							>
							<PasswordInput
								id="repetir"
								name="repetir"
								autocomplete="new-password"
								placeholder="Vuelve a escribir la nueva contraseña"
							/>
						</div>

						{#if form?.seccion === 'clave' && form?.error}
							<p class="rounded-input bg-money-contra-bg px-3 py-2 text-sm text-money-contra">
								{form.error}
							</p>
						{/if}

						<button
							type="submit"
							disabled={guardandoClave}
							class="h-11 w-full rounded-input bg-brand-500 font-semibold text-white transition-all duration-200 ease-out hover:bg-brand-700 active:scale-[0.99] disabled:opacity-60"
						>
							{guardandoClave ? 'Guardando…' : 'Cambiar contraseña'}
						</button>
					</form>
					<p class="text-center text-xs text-muted">
						Tu contraseña protege las cuentas de tu hogar. Usa 8 o más caracteres y evita reutilizar la
						de otros sitios.
					</p>
				</div>
			</section>

			<!-- Hogar (entre Seguridad y Herramientas) -->
			<section class="flex flex-col">
				<h2 class="px-1 text-xs font-semibold tracking-wide text-muted uppercase">Hogar</h2>
				<div class="mt-2 rounded-card bg-surface p-4 shadow-card">
					{#if confirmarSalir}
						<p class="text-sm font-medium text-text">
							¿Salir de {hogarActivo?.nombre ?? 'este hogar'}?
						</p>
						<p class="mt-1 text-xs text-muted">
							Dejarás de ver sus cuentas y balances. Podrás volver a unirte con un código.
						</p>
						<div class="mt-3 flex gap-2">
							<form method="POST" action="?/salirHogar" class="flex-1" use:enhance>
								<button
									type="submit"
									class="w-full rounded-input bg-money-contra px-3 py-2 text-sm font-semibold text-white transition-opacity duration-200 ease-out hover:opacity-90"
								>
									Sí, salir
								</button>
							</form>
							<button
								type="button"
								onclick={() => (confirmarSalir = false)}
								class="flex-1 rounded-input bg-bg px-3 py-2 text-sm font-medium text-text transition-colors duration-200 ease-out hover:bg-brand-50"
							>
								Cancelar
							</button>
						</div>
					{:else}
						<div class="flex items-center gap-3">
							<span class="rounded-input bg-brand-50 p-2 text-brand-500">
								<House size={18} />
							</span>
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium text-text">
									{hogarActivo?.nombre ?? 'Tu hogar'}
								</p>
								<p class="text-xs text-muted">{hogarActivo ? rolLabel(hogarActivo.rol) : ''}</p>
							</div>
							<a
								href="/hogar"
								class="rounded-input px-3 py-1.5 text-sm font-medium text-brand-700 transition-colors duration-200 ease-out hover:bg-brand-50"
							>
								Gestionar
							</a>
						</div>
						<div
							class="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm"
						>
							<span class="text-muted">Miembros</span>
							<span class="font-medium text-text">{hogarActivo?.miembros ?? 1}</span>
						</div>
						<button
							type="button"
							onclick={() => (confirmarSalir = true)}
							class="mt-3 w-full rounded-input border border-border py-2 text-sm font-medium text-money-contra transition-colors duration-200 ease-out hover:bg-money-contra-bg"
						>
							Salir del hogar
						</button>
					{/if}
				</div>
			</section>

			<!-- Herramientas -->
			<section class="flex flex-col">
				<h2 class="px-1 text-xs font-semibold tracking-wide text-muted uppercase">Herramientas</h2>
				<ul class="mt-2 overflow-hidden rounded-card bg-surface shadow-card">
					{#each herramientas as item (item.href)}
						{@const Icono = item.icon}
						<li>
							<a
								href={item.href}
								class="flex items-center gap-3 px-4 py-3.5 transition-colors duration-200 ease-out hover:bg-brand-50"
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

			<!-- Cerrar sesión -->
			<form method="POST" action="/auth/logout">
				<button
					type="submit"
					class="flex w-full items-center justify-center gap-2 rounded-card border border-border bg-surface py-3 text-sm font-semibold text-money-contra shadow-card transition-colors duration-200 ease-out hover:bg-money-contra-bg"
				>
					<LogOut size={16} />
					Cerrar sesión
				</button>
			</form>
		</div>
	</div>

	<footer class="shrink-0 pt-4 text-center">
		<p class="text-xs text-muted">Splitmate · versión 0.0.1</p>
	</footer>
</div>

{#if archivoFoto}
	<RecorteFoto archivo={archivoFoto} onCancelar={cancelarRecorte} onListo={fotoRecortada} />
{/if}
