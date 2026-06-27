<script lang="ts">
	// Sección de ajustes para gestionar notificaciones. Solo pide permiso
	// de la `Notification` API; las notif llegan vía Realtime cuando
	// Splitmate está abierto en alguna pestaña.
	import { onMount } from 'svelte';
	import Bell from '@lucide/svelte/icons/bell';
	import BellOff from '@lucide/svelte/icons/bell-off';
	import {
		puedePushBrowser,
		razonNoSoportado,
		estadoPush,
		activarPush,
		desactivarPush,
		asegurarSuscripcion
	} from '$lib/push';

	let estado = $state<
		| 'cargando'
		| 'no-soportado'
		| 'origen-inseguro'
		| 'permiso-denegado'
		| 'permiso-pendiente'
		| 'activado'
		| 'silenciado'
	>('cargando');
	let procesando = $state(false);
	let error = $state<string | null>(null);
	let mensajeNoSoportado = $state<string | null>(null);

	async function refrescar() {
		const e = await estadoPush();
		estado = e;
		if (e === 'no-soportado') mensajeNoSoportado = razonNoSoportado();
		// Si ya tenía permiso pero quizá nunca se guardó la suscripción (p.ej. la
		// otorgó antes), nos aseguramos de registrarla en el servidor.
		if (e === 'activado') asegurarSuscripcion().catch(() => {});
	}

	onMount(() => {
		if (!puedePushBrowser()) {
			estado = 'no-soportado';
			mensajeNoSoportado = razonNoSoportado();
			return;
		}
		refrescar();
	});

	async function onActivar() {
		procesando = true;
		error = null;
		const r = await activarPush();
		procesando = false;
		if (!r.ok) error = r.error ?? 'No se pudo activar.';
		await refrescar();
	}

	async function onDesactivar() {
		procesando = true;
		error = null;
		const r = await desactivarPush();
		procesando = false;
		if (!r.ok) error = r.error ?? 'No se pudo desactivar.';
		await refrescar();
	}
</script>

<div class="flex flex-col gap-3 border-t border-border p-4">
	{#if estado === 'cargando'}
		<p class="text-sm text-muted">Cargando…</p>
	{:else if estado === 'no-soportado'}
		<div class="flex items-start gap-3">
			<span class="grid size-9 shrink-0 place-items-center rounded-full bg-bg text-muted">
				<BellOff size={16} />
			</span>
			<div class="min-w-0 flex-1">
				<p class="text-sm font-medium text-text">No disponibles en este dispositivo</p>
				<p class="mt-0.5 text-xs text-muted">{mensajeNoSoportado ?? ''}</p>
			</div>
		</div>
	{:else if estado === 'origen-inseguro'}
		<div class="flex items-start gap-3">
			<span class="grid size-9 shrink-0 place-items-center rounded-full bg-bg text-muted">
				<BellOff size={16} />
			</span>
			<div class="min-w-0 flex-1">
				<p class="text-sm font-medium text-text">No disponibles en HTTP de red local</p>
				<p class="mt-0.5 text-xs text-muted">
					Los navegadores exigen HTTPS (o localhost) para mostrar notificaciones. En el celular contra
					la IP de tu PC no funcionan; sí van en localhost desde la PC y cuando despleguemos en
					producción.
				</p>
			</div>
		</div>
	{:else if estado === 'permiso-denegado'}
		<div class="flex items-start gap-3">
			<span
				class="grid size-9 shrink-0 place-items-center rounded-full bg-money-contra-bg text-money-contra"
			>
				<BellOff size={16} />
			</span>
			<div class="min-w-0 flex-1">
				<p class="text-sm font-medium text-text">Bloqueadas en este navegador</p>
				<p class="mt-0.5 text-xs text-muted">
					Habilita las notificaciones desde la configuración del sitio en tu navegador y recarga.
				</p>
			</div>
		</div>
	{:else}
		<div class="flex items-center justify-between gap-3">
			<div class="flex items-center gap-3">
				<span
					class={'grid size-9 shrink-0 place-items-center rounded-full ' +
						(estado === 'activado'
							? 'bg-money-favor-bg text-money-favor'
							: 'bg-brand-50 text-brand-700')}
				>
					<Bell size={16} />
				</span>
				<div class="min-w-0">
					<p class="text-sm font-medium text-text">
						{estado === 'activado' ? 'Activadas' : 'Activar notificaciones'}
					</p>
					<p class="mt-0.5 text-xs text-muted">
						Te avisamos cuando te incluyan en un gasto, te paguen o haya algo que confirmar.
					</p>
				</div>
			</div>
			{#if estado === 'activado'}
				<button
					type="button"
					onclick={onDesactivar}
					disabled={procesando}
					class="rounded-input border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-bg hover:text-text disabled:opacity-60"
				>
					{procesando ? '…' : 'Desactivar'}
				</button>
			{:else}
				<button
					type="button"
					onclick={onActivar}
					disabled={procesando}
					class="rounded-input bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
				>
					{procesando ? '…' : 'Activar'}
				</button>
			{/if}
		</div>
	{/if}

	{#if error}
		<p class="rounded-input bg-money-contra-bg px-2 py-1 text-xs text-money-contra">{error}</p>
	{/if}
</div>
