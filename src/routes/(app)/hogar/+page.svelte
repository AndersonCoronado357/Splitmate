<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import Select from '$lib/components/Select.svelte';
	import { monedas } from '$lib/monedas';
	import { supabaseBrowser } from '$lib/supabase-browser';
	import Crown from '@lucide/svelte/icons/crown';
	import Copy from '@lucide/svelte/icons/copy';
	import Check from '@lucide/svelte/icons/check';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import Share2 from '@lucide/svelte/icons/share-2';
	import LogOut from '@lucide/svelte/icons/log-out';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let nombre = $state('');
	let moneda = $state('COP');
	let regenerando = $state(false);
	let copiadoCodigo = $state(false);
	let copiadoLink = $state(false);
	let confirmarSalir = $state(false);
	let qrSvg = $state('');
	let formHogar = $state<HTMLFormElement>();

	// "Aceptar miembros": estado local instantáneo; se persiste en segundo plano
	// con la RPC (sin recargar). Si está apagado, los datos se muestran falsos.
	let activa = $state(true);
	$effect(() => {
		activa = data.invitacion?.activa ?? true;
	});

	// Mantener el form sincronizado si cambian los datos (tras guardar).
	$effect(() => {
		nombre = data.hogar.nombre;
		moneda = data.hogar.moneda;
	});

	const link = $derived(
		data.invitacion ? `${page.url.origin}/unirse/${data.invitacion.token}` : ''
	);
	const codigoMostrado = $derived(
		data.invitacion ? (activa ? data.invitacion.codigo : '••••••') : ''
	);
	const linkMostrado = $derived(
		data.invitacion ? (activa ? link : `${page.url.origin}/unirse/desactivada`) : ''
	);

	// Generar el QR (SVG) a partir del enlace mostrado.
	$effect(() => {
		const l = linkMostrado;
		if (!l) {
			qrSvg = '';
			return;
		}
		// Carga diferida de la librería de QR: solo cuando hace falta dibujarlo, así
		// la página abre más liviana (no arrastra `qrcode` en la carga inicial).
		import('qrcode')
			.then(({ default: QRCode }) =>
				QRCode.toString(l, { type: 'svg', margin: 0, color: { dark: '#16201e', light: '#ffffff' } })
			)
			.then((s) => (qrSvg = s))
			.catch(() => (qrSvg = ''));
	});

	// Activar/desactivar al instante (optimista) y persistir con la RPC.
	async function toggleActiva() {
		const nuevo = !activa;
		activa = nuevo;
		const { error } = await supabaseBrowser().rpc('set_invitacion_activa', {
			p_hogar: data.hogar.id,
			p_activa: nuevo
		});
		if (error) activa = !nuevo; // revertir si falla
	}

	// Guardar el nombre del hogar al salir del campo (sin botón) si cambió.
	function guardarHogarNombre() {
		const v = nombre.trim();
		if (v && v !== data.hogar.nombre) formHogar?.requestSubmit();
		else nombre = data.hogar.nombre;
	}

	const inputClass =
		'w-full rounded-input border border-transparent bg-brand-50 px-3 py-2.5 text-text outline-none placeholder:text-muted/70';

	const fmtFecha = (iso: string) =>
		new Intl.DateTimeFormat('es-CO', { dateStyle: 'long' }).format(new Date(iso));

	const nombreMoneda = $derived(
		monedas.find((m) => m.value === data.hogar.moneda)?.label ?? data.hogar.moneda
	);

	function enhanceFlag(set: (v: boolean) => void) {
		return () => {
			set(true);
			return async ({ update }: { update: () => Promise<void> }) => {
				await update();
				set(false);
			};
		};
	}

	async function copiar(texto: string, set: (v: boolean) => void) {
		try {
			await navigator.clipboard.writeText(texto);
			set(true);
			setTimeout(() => set(false), 1800);
		} catch {
			/* sin portapapeles: el usuario puede copiarlo a mano */
		}
	}

	// Compartir el enlace con la hoja nativa del sistema (WhatsApp, etc.).
	async function compartir() {
		if (!linkMostrado) return;
		try {
			if (navigator.share) {
				await navigator.share({
					title: 'Únete a mi hogar en Splitmate',
					text: `Te invito a llevar las cuentas conmigo en Splitmate. Hogar: ${data.hogar.nombre}.`,
					url: linkMostrado
				});
			} else {
				await copiar(linkMostrado, (v) => (copiadoLink = v));
			}
		} catch {
			/* el usuario canceló el diálogo */
		}
	}

	// Compartir el código (texto + enlace).
	async function compartirCodigo() {
		if (!data.invitacion) return;
		try {
			if (navigator.share) {
				await navigator.share({
					title: 'Únete a mi hogar en Splitmate',
					text: `Te invito a "${data.hogar.nombre}" en Splitmate. Código: ${codigoMostrado}`,
					url: linkMostrado
				});
			} else {
				await copiar(codigoMostrado, (v) => (copiadoCodigo = v));
			}
		} catch {
			/* cancelado */
		}
	}

	// Compartir el QR como imagen; si no se puede, lo descarga.
	async function compartirQR() {
		if (!linkMostrado) return;
		try {
			const { default: QRCode } = await import('qrcode');
			const dataUrl = await QRCode.toDataURL(linkMostrado, {
				margin: 1,
				width: 512,
				color: { dark: '#16201e', light: '#ffffff' }
			});
			const blob = await (await fetch(dataUrl)).blob();
			const file = new File([blob], 'invitacion-splitmate.png', { type: 'image/png' });
			if (navigator.canShare?.({ files: [file] })) {
				await navigator.share({ files: [file], title: 'Invitación a Splitmate' });
			} else {
				const a = document.createElement('a');
				a.href = dataUrl;
				a.download = 'invitacion-splitmate.png';
				a.click();
			}
		} catch {
			/* cancelado */
		}
	}
</script>

<div class="flex flex-col px-5 py-6 md:px-8 lg:h-full lg:w-full lg:flex-1">
	<header>
		<h1 class="text-2xl font-bold text-text">Hogar</h1>
		<p class="mt-1 text-sm text-muted">Gestiona tu hogar, su moneda y quién forma parte.</p>
	</header>

	<div class={'mt-5 grid gap-5 lg:min-h-0 lg:flex-1 ' + (data.hogar.esAdmin ? 'lg:grid-cols-2' : '')}>
		<!-- ===================== COLUMNA IZQUIERDA ===================== -->
		<div class="flex flex-col gap-5 lg:min-h-0">
			<!-- Datos del hogar -->
			<section>
				<h2 class="px-1 text-xs font-semibold tracking-wide text-muted uppercase">Datos del hogar</h2>
				<div class="mt-2 rounded-card bg-surface p-5 shadow-card">
					{#if data.hogar.esAdmin}
						<!-- Se guarda solo: el nombre al salir del campo, la moneda al elegirla. -->
						<form
							method="POST"
							action="?/guardar"
							bind:this={formHogar}
							use:enhance={() => async ({ update }) => {
								await update({ reset: false });
							}}
							class="space-y-3"
						>
							<div class="space-y-1.5">
								<label for="nombre" class="block text-sm font-medium text-text">Nombre del hogar</label
								>
								<input
									id="nombre"
									name="nombre"
									type="text"
									bind:value={nombre}
									onblur={guardarHogarNombre}
									class={inputClass}
								/>
							</div>
							<div class="space-y-1.5">
								<label for="moneda" class="block text-sm font-medium text-text">Moneda</label>
								<Select
									id="moneda"
									name="moneda"
									bind:value={moneda}
									options={monedas}
									onChange={() => formHogar?.requestSubmit()}
								/>
							</div>

							{#if form?.seccion === 'datos' && form?.error}
								<p class="rounded-input bg-money-contra-bg px-3 py-2 text-sm text-money-contra">
									{form.error}
								</p>
							{/if}
						</form>
					{:else}
						<dl class="divide-y divide-border">
							<div class="flex items-center justify-between py-2">
								<dt class="text-sm text-muted">Nombre</dt>
								<dd class="font-medium text-text">{data.hogar.nombre}</dd>
							</div>
							<div class="flex items-center justify-between py-2">
								<dt class="text-sm text-muted">Moneda</dt>
								<dd class="font-medium text-text">{nombreMoneda}</dd>
							</div>
						</dl>
						<p class="mt-3 text-xs text-muted">Solo el administrador puede editar estos datos.</p>
					{/if}
				</div>
			</section>

			<!-- Miembros (crece para llenar la columna) -->
			<section class="flex flex-col lg:min-h-0 lg:flex-1">
				<h2 class="px-1 text-xs font-semibold tracking-wide text-muted uppercase">
					Miembros · {data.miembros.length}
				</h2>
				<ul
					class="mt-2 overflow-hidden rounded-card bg-surface shadow-card lg:flex-1 lg:overflow-y-auto"
				>
					{#each data.miembros as m, i (m.userId)}
						<li
							class="flex items-center gap-3 px-4 py-3"
							class:border-t={i > 0}
							class:border-border={i > 0}
						>
							{#if m.avatar}
								<img
									src={m.avatar}
									alt=""
									referrerpolicy="no-referrer"
									class="size-10 shrink-0 rounded-full object-cover"
								/>
							{:else}
								<span
									class="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700"
								>
									{(m.nombre.trim()[0] || '?').toUpperCase()}
								</span>
							{/if}
							<span class="min-w-0 flex-1">
								<span class="block truncate text-sm font-medium text-text">
									{m.nombre}{#if m.soyYo}<span class="text-muted"> · Tú</span>{/if}
								</span>
							</span>
							{#if m.rol === 'admin'}
								<span
									class="flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700"
								>
									<Crown size={13} /> Administrador
								</span>
							{:else}
								<span class="rounded-full bg-bg px-2.5 py-1 text-xs font-medium text-muted">Miembro</span
								>
							{/if}
						</li>
					{/each}
				</ul>
			</section>
		</div>

		<!-- ===================== COLUMNA DERECHA (invitación: solo el admin) ===================== -->
		{#if data.hogar.esAdmin}
			<div class="flex flex-col gap-5 lg:min-h-0">
				<section class="flex flex-col lg:min-h-0 lg:flex-1">
					<h2 class="px-1 text-xs font-semibold tracking-wide text-muted uppercase">Invitación</h2>
				<div
					class="mt-2 rounded-card bg-surface p-4 shadow-card lg:flex lg:min-h-0 lg:flex-1 lg:flex-col"
				>
					{#if data.invitacion}
						<!-- Aceptar nuevos miembros: fila tipo radio, instantánea -->
						<button
							type="button"
							onclick={toggleActiva}
							role="switch"
							aria-checked={activa}
							class={'flex w-full items-center gap-3 rounded-card px-4 py-3 text-left transition-colors duration-200 ' +
								(activa ? 'bg-brand-50' : 'hover:bg-brand-50/60')}
						>
							<span
								class={'flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200 ' +
									(activa ? 'border-brand-500' : 'border-muted/40')}
							>
								<span
									class={'size-2.5 rounded-full bg-brand-500 transition-transform duration-200 ' +
										(activa ? 'scale-100' : 'scale-0')}
								></span>
							</span>
							<span class="flex-1">
								<span class="block text-sm font-semibold text-text">Aceptar nuevos miembros</span>
								<span class="mt-0.5 block text-xs text-muted">
									{activa ? 'Cualquiera con el código puede unirse.' : 'Apagado: nadie puede unirse.'}
								</span>
							</span>
						</button>

						<!-- Código / Enlace / QR: siempre visibles; si está apagado, datos falsos y griseados -->
						<div
							class={'flex flex-col transition-opacity duration-200 lg:min-h-0 lg:flex-1 ' +
								(activa ? '' : 'opacity-50')}
						>
							<!-- 1) Código -->
							<div class="mt-4">
							<p class="text-xs font-semibold tracking-wide text-muted uppercase">Código</p>
							<div class="mt-1.5 flex items-center gap-2">
								<span
									class="tabular flex-1 rounded-input bg-brand-50 px-4 py-2 text-center text-xl font-bold tracking-[0.3em] text-brand-700"
								>
									{codigoMostrado}
								</span>
								<button
									type="button"
									onclick={() => copiar(codigoMostrado, (v) => (copiadoCodigo = v))}
									class="flex size-10 shrink-0 items-center justify-center rounded-input bg-brand-50 text-brand-700 transition-colors hover:bg-brand-200"
									aria-label="Copiar código"
								>
									{#if copiadoCodigo}
										<Check size={18} class="text-money-favor" />
									{:else}
										<Copy size={18} />
									{/if}
								</button>
								<button
									type="button"
									onclick={compartirCodigo}
									class="flex size-10 shrink-0 items-center justify-center rounded-input bg-brand-500 text-white transition-colors hover:bg-brand-700"
									aria-label="Compartir código"
								>
									<Share2 size={18} />
								</button>
							</div>
						</div>

						<!-- 2) Enlace -->
						<div class="mt-3">
							<p class="text-xs font-semibold tracking-wide text-muted uppercase">Enlace</p>
							<div class="mt-1.5 flex items-center gap-2">
								<input
									type="text"
									readonly
									value={linkMostrado}
									class="w-full truncate rounded-input border border-transparent bg-brand-50 px-3 py-2 text-sm text-text outline-none"
								/>
								<button
									type="button"
									onclick={() => copiar(linkMostrado, (v) => (copiadoLink = v))}
									class="flex size-10 shrink-0 items-center justify-center rounded-input bg-brand-50 text-brand-700 transition-colors hover:bg-brand-200"
									aria-label="Copiar enlace"
								>
									{#if copiadoLink}
										<Check size={18} class="text-money-favor" />
									{:else}
										<Copy size={18} />
									{/if}
								</button>
								<button
									type="button"
									onclick={compartir}
									class="flex size-10 shrink-0 items-center justify-center rounded-input bg-brand-500 text-white transition-colors hover:bg-brand-700"
									aria-label="Compartir enlace"
								>
									<Share2 size={18} />
								</button>
							</div>
						</div>

						<!-- 3) QR (escala con el alto disponible y se centra) -->
						<div class="mt-3 flex flex-col lg:min-h-0 lg:flex-1">
							<div class="flex items-center justify-between">
								<p class="text-xs font-semibold tracking-wide text-muted uppercase">Código QR</p>
								<button
									type="button"
									onclick={compartirQR}
									class="flex items-center gap-1.5 rounded-input px-2 py-1 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-50"
								>
									<Share2 size={14} /> Compartir
								</button>
							</div>
							<div
								class="mt-1.5 flex items-center justify-center rounded-card bg-brand-50 p-3 lg:min-h-0 lg:flex-1"
							>
								{#if qrSvg}
									<div
										class="size-36 rounded-lg bg-white p-2.5 shadow-card lg:aspect-square lg:h-[min(18vh,9rem)] lg:max-h-full lg:w-auto [&>svg]:size-full"
									>
										<!-- eslint-disable-next-line svelte/no-at-html-tags -->
										{@html qrSvg}
									</div>
								{:else}
									<div
										class="size-36 animate-pulse rounded-lg bg-white lg:aspect-square lg:h-[min(18vh,9rem)] lg:max-h-full lg:w-auto"
									></div>
								{/if}
							</div>
						</div>

						</div>

						<div class="mt-3 flex items-center justify-between gap-3">
							<p class="text-xs text-muted">Vence el {fmtFecha(data.invitacion.expira)}.</p>
							{#if data.hogar.esAdmin}
								<form
									method="POST"
									action="?/regenerar"
									use:enhance={enhanceFlag((v) => (regenerando = v))}
								>
									<button
										type="submit"
										disabled={regenerando}
										class="flex items-center gap-1.5 rounded-input px-2 py-1 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-50 disabled:opacity-60"
									>
										<RefreshCw size={14} class={regenerando ? 'animate-spin' : ''} />
										{regenerando ? 'Generando…' : 'Generar nueva'}
									</button>
								</form>
							{/if}
						</div>
						{#if form?.seccion === 'invitacion' && form?.error}
							<p class="mt-2 rounded-input bg-money-contra-bg px-3 py-2 text-sm text-money-contra">
								{form.error}
							</p>
						{/if}
					{:else}
						<p class="text-sm text-muted">Este hogar no tiene una invitación activa.</p>
						{#if data.hogar.esAdmin}
							<form
								method="POST"
								action="?/regenerar"
								use:enhance={enhanceFlag((v) => (regenerando = v))}
							>
								<button
									type="submit"
									disabled={regenerando}
									class="mt-3 flex w-full items-center justify-center gap-2 rounded-input bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
								>
									<RefreshCw size={16} class={regenerando ? 'animate-spin' : ''} />
									Crear invitación
								</button>
							</form>
						{/if}
					{/if}
				</div>
			</section>
			</div>
		{/if}
	</div>

	<!-- ===================== SALIR DEL HOGAR ===================== -->
	<section class="mt-5 shrink-0">
		{#if confirmarSalir}
			<div class="rounded-card border border-money-contra/30 bg-money-contra-bg p-4">
				<p class="text-sm font-medium text-text">¿Salir de este hogar?</p>
				<p class="mt-1 text-sm text-muted">
					Dejarás de ver sus gastos y balances. Podrás volver a unirte con un código.
				</p>
				<div class="mt-3 flex gap-2">
					<form method="POST" action="?/salir" class="flex-1" use:enhance>
						<button
							type="submit"
							class="w-full rounded-input bg-money-contra px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
						>
							Sí, salir
						</button>
					</form>
					<button
						type="button"
						onclick={() => (confirmarSalir = false)}
						class="flex-1 rounded-input bg-surface px-4 py-2.5 text-sm font-medium text-text transition-colors hover:bg-bg"
					>
						Cancelar
					</button>
				</div>
			</div>
		{:else}
			<button
				type="button"
				onclick={() => (confirmarSalir = true)}
				class="flex w-full items-center justify-center gap-2 rounded-input px-4 py-2.5 text-sm font-semibold text-money-contra transition-colors hover:bg-money-contra-bg"
			>
				<LogOut size={16} />
				Salir del hogar
			</button>
		{/if}
	</section>
</div>
