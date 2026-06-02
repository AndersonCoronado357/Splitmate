<script lang="ts">
	// Banner discreto en la home que pide permiso de notificaciones la
	// primera vez. Si el user lo descarta, recordamos esa decisión en
	// localStorage y no lo molestamos más (puede activar luego en /ajustes).
	//
	// Se esconde solo si:
	//   - el browser no soporta push (iOS Safari, Firefox sin SW, etc.)
	//   - el user ya dio permiso (estado 'activo' o 'inactivo' con permiso)
	//   - el user ya bloqueó (mostrar el bloqueado no sirve, no hay vuelta)
	//   - el user lo descartó manualmente
	import { onMount } from 'svelte';
	import { puedePushBrowser, estadoPush, activarPush } from '$lib/push';
	import Bell from '@lucide/svelte/icons/bell';
	import X from '@lucide/svelte/icons/x';

	let visible = $state(false);
	let activando = $state(false);
	let error = $state<string | null>(null);

	const STORAGE_KEY = 'splitmate.push_dismissed';

	onMount(async () => {
		if (!puedePushBrowser()) return;
		try {
			if (localStorage.getItem(STORAGE_KEY) === '1') return;
		} catch {
			/* localStorage bloqueado: lo mostramos igual */
		}
		const e = await estadoPush();
		// Solo mostramos si el permiso está PENDIENTE. Si está activo,
		// inactivo (sin sub) o denegado, no tiene sentido el banner.
		if (e === 'permiso-pendiente') visible = true;
	});

	async function activar() {
		activando = true;
		error = null;
		const r = await activarPush();
		activando = false;
		if (r.ok) {
			// activado (push o in-app) — cerramos el banner. Si fue degradado,
			// el detalle se ve en /ajustes.
			visible = false;
		} else {
			error = r.error ?? 'No se pudo activar.';
		}
	}

	function descartar() {
		try {
			localStorage.setItem(STORAGE_KEY, '1');
		} catch {
			/* localStorage bloqueado: ok, se descarta solo para esta sesión */
		}
		visible = false;
	}
</script>

{#if visible}
	<div class="mt-5 rounded-card border border-border bg-surface p-4 shadow-card">
		<div class="flex items-start gap-3">
			<span class="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
				<Bell size={18} />
			</span>
			<div class="min-w-0 flex-1">
				<p class="text-sm font-semibold text-text">Activar notificaciones</p>
				<p class="mt-0.5 text-xs text-muted">
					Avísate cuando te incluyan en un gasto, te paguen o haya algo que confirmar.
				</p>
				{#if error}
					<p class="mt-2 rounded-input bg-money-contra-bg px-2 py-1 text-xs text-money-contra">
						{error}
					</p>
				{/if}
				<div class="mt-3 flex items-center gap-2">
					<button
						type="button"
						onclick={activar}
						disabled={activando}
						class="rounded-input bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
					>
						{activando ? 'Activando…' : 'Activar'}
					</button>
					<button
						type="button"
						onclick={descartar}
						class="rounded-input px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-bg hover:text-text"
					>
						Ahora no
					</button>
				</div>
			</div>
			<button
				type="button"
				onclick={descartar}
				class="flex size-7 shrink-0 items-center justify-center rounded-input text-muted transition-colors hover:bg-bg hover:text-text"
				aria-label="Cerrar"
			>
				<X size={14} />
			</button>
		</div>
	</div>
{/if}
