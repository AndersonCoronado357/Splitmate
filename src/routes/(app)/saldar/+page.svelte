<script lang="ts">
	import { fade, slide } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { enhance } from '$app/forms';
	import { invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import Scale from '@lucide/svelte/icons/scale';
	import Check from '@lucide/svelte/icons/check';
	import Clock from '@lucide/svelte/icons/clock';
	import Receipt from '@lucide/svelte/icons/receipt';
	import HandCoins from '@lucide/svelte/icons/hand-coins';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Zap from '@lucide/svelte/icons/zap';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function iniciales(nombre: string) {
		return (
			nombre
				.trim()
				.split(/\s+/)
				.map((w) => w[0])
				.slice(0, 2)
				.join('') || '?'
		).toUpperCase();
	}

	// Detalle expandido por userId. Por defecto colapsado.
	let expandidos = $state<Set<string>>(new Set());
	function toggleDetalle(userId: string) {
		const nuevo = new Set(expandidos);
		if (nuevo.has(userId)) nuevo.delete(userId);
		else nuevo.add(userId);
		expandidos = nuevo;
	}

	let procesando = $state<string | null>(null);
	function onEnhanceAccion(id: string) {
		return ({ cancel }: { cancel: () => void }) => {
			if (procesando) {
				cancel();
				return;
			}
			procesando = id;
			return async ({
				result,
				update
			}: {
				result: { type: string };
				update: (opts?: { invalidateAll?: boolean }) => Promise<void>;
			}) => {
				try {
					if (result.type === 'success') {
						await update({ invalidateAll: false });
						await invalidate('app:saldar');
					}
				} finally {
					procesando = null;
				}
			};
		};
	}
</script>

<div class="flex flex-col px-5 py-6 md:px-8 lg:h-full lg:w-full lg:min-h-0 lg:gap-4">
	<header class="shrink-0">
		<h1 class="flex items-center gap-2 text-2xl font-bold tracking-tight text-text">
			<Scale size={22} class="text-brand-500" />
			Saldar
		</h1>
		<p class="mt-0.5 text-xs text-muted">
			Cuánto te debe y le debes a cada miembro del hogar, sumando todo.
		</p>
	</header>

	<!-- Cadenas de simplificación: solo aparece si tengo creditor + deudor -->
	{#if data.saldos.cadenas.length > 0}
		<section
			in:fade={{ duration: 180 }}
			class="mt-4 shrink-0 rounded-card border border-border bg-brand-50/40 p-4 shadow-card lg:mt-0"
		>
			<div class="flex items-center gap-2">
				<Zap size={14} class="text-brand-500" />
				<p class="text-[11px] font-semibold uppercase tracking-wide text-brand-700">
					Atajos para ahorrarte movimientos
				</p>
			</div>
			<p class="mt-1 text-xs text-muted">
				En vez de cobrar y luego pagar, pide a una persona que le pague directo a otra. Te ahorras pasos.
			</p>
			<ul class="mt-3 flex flex-col gap-2">
				{#each data.saldos.cadenas as c (c.id)}
					<li class="flex flex-col gap-2 rounded-input border border-border bg-surface p-3 lg:flex-row lg:items-center lg:gap-3">
						<div class="flex min-w-0 flex-1 items-center gap-2">
							{#if c.acreedor.avatar}
								<img
									src={c.acreedor.avatar}
									alt=""
									referrerpolicy="no-referrer"
									class="size-7 shrink-0 rounded-full object-cover"
								/>
							{:else}
								<span class="grid size-7 shrink-0 place-items-center rounded-full bg-brand-50 text-[10px] font-bold text-brand-700">
									{iniciales(c.acreedor.nombre)}
								</span>
							{/if}
							<span class="truncate text-xs font-semibold text-text">{c.acreedor.nombre}</span>
							<ArrowRight size={12} class="shrink-0 text-brand-500" />
							{#if c.deudor.avatar}
								<img
									src={c.deudor.avatar}
									alt=""
									referrerpolicy="no-referrer"
									class="size-7 shrink-0 rounded-full object-cover"
								/>
							{:else}
								<span class="grid size-7 shrink-0 place-items-center rounded-full bg-brand-50 text-[10px] font-bold text-brand-700">
									{iniciales(c.deudor.nombre)}
								</span>
							{/if}
							<span class="truncate text-xs font-semibold text-text">{c.deudor.nombre}</span>
						</div>

						<div class="flex shrink-0 items-center justify-between gap-3 lg:justify-end">
							<span class="tabular text-sm font-bold text-text">{c.montoTexto}</span>
							<form
								method="POST"
								action="?/marcarCadena"
								use:enhance={onEnhanceAccion(`cad-${c.id}`)}
							>
								<input type="hidden" name="acreedor_id" value={c.acreedor.userId} />
								<input type="hidden" name="deudor_id" value={c.deudor.userId} />
								<input type="hidden" name="monto" value={c.monto} />
								<button
									type="submit"
									disabled={procesando === `cad-${c.id}`}
									title="Ya hablaste con ellos y se hizo este pago directo"
									class="rounded-input bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-200 hover:bg-brand-700 disabled:opacity-60"
								>
									{procesando === `cad-${c.id}` ? '…' : 'Ya se hizo'}
								</button>
							</form>
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if data.saldos.yaEnCero}
		<div
			class="mt-4 flex flex-1 flex-col items-center justify-center rounded-card border border-dashed border-border bg-surface p-8 text-center lg:mt-0 lg:min-h-0"
		>
			<span class="grid size-14 place-items-center rounded-full bg-money-favor-bg text-money-favor">
				<Check size={28} strokeWidth={2.5} />
			</span>
			<p class="mt-3 text-base font-bold text-text">Estás al día con todos</p>
			<p class="mt-1 text-xs text-muted">
				Cuando alguien quede con saldo a tu favor o en contra, aparecerá acá.
			</p>
		</div>
	{:else}
		<ul class="mt-4 flex flex-1 flex-col gap-3 overflow-y-auto lg:mt-0 lg:min-h-0">
			{#each data.saldos.personas as p (p.userId)}
				{@const aFavor = p.es === 'a_favor'}
				{@const tienePagoEnCamino = p.pagoPendienteId !== null}
				{@const expandido = expandidos.has(p.userId)}
				<li
					in:fade={{ duration: 180 }}
					out:fade={{ duration: 200 }}
					animate:flip={{ duration: 280 }}
					class={'flex flex-col rounded-card border border-border shadow-card transition-colors duration-200 ' +
						(tienePagoEnCamino ? 'bg-bg opacity-70' : 'bg-surface')}
				>
				<div class="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:gap-4">
					<!-- Avatar + nombre + saldo -->
					<div class="flex min-w-0 flex-1 items-center gap-3">
						{#if p.avatar}
							<img
								src={p.avatar}
								alt=""
								referrerpolicy="no-referrer"
								class="size-12 shrink-0 rounded-full object-cover"
							/>
						{:else}
							<span class="grid size-12 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">
								{iniciales(p.nombre)}
							</span>
						{/if}
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-semibold text-text">{p.nombre}</p>
							<p
								class={'tabular mt-0.5 text-2xl font-bold ' +
									(aFavor ? 'text-money-favor' : 'text-money-contra')}
							>
								{aFavor ? '+' : '−'} {p.saldoTexto}
							</p>
							<p class="mt-1 text-[11px] font-medium text-muted">
								{aFavor
									? `${p.nombre} te debe esto en total`
									: `Le debes esto a ${p.nombre} en total`}
								{#if p.gastosCount > 0 || p.prestamosActivos > 0}
									<span class="ml-1">·</span>
									{#if p.gastosCount > 0}
										<Receipt size={11} class="inline align-text-bottom text-muted" />
										{p.gastosCount} {p.gastosCount === 1 ? 'gasto' : 'gastos'}
									{/if}
									{#if p.gastosCount > 0 && p.prestamosActivos > 0}<span class="mx-0.5">·</span>{/if}
									{#if p.prestamosActivos > 0}
										<HandCoins size={11} class="inline align-text-bottom text-muted" />
										{p.prestamosActivos} préstamo{p.prestamosActivos === 1 ? '' : 's'}
									{/if}
								{/if}
							</p>
						</div>
					</div>

					<!-- Acción a la derecha (ancho estable) -->
					<div class="flex shrink-0 flex-col gap-1.5 lg:items-end" style="min-width: 180px;">
						{#if tienePagoEnCamino && p.pagoPendienteId}
							<p class="flex items-center gap-1 text-[11px] font-semibold text-muted">
								<Clock size={11} class="text-brand-500" />
								{p.pagoPendienteEsMio
									? `Esperando que ${p.nombre} confirme`
									: `${p.nombre} dice que ya te pagó`}
							</p>
							{#if p.pagoPendienteEsMio}
								<form
									method="POST"
									action="?/cancelarPago"
									use:enhance={onEnhanceAccion(`cancel-${p.pagoPendienteId}`)}
								>
									<input type="hidden" name="id" value={p.pagoPendienteId} />
									<button
										type="submit"
										disabled={procesando === `cancel-${p.pagoPendienteId}`}
										class="rounded-input border border-border bg-surface px-4 py-2 text-xs font-semibold text-muted transition-colors duration-200 hover:bg-bg hover:text-text disabled:opacity-60"
									>
										{procesando === `cancel-${p.pagoPendienteId}` ? '…' : 'Cancelar pago'}
									</button>
								</form>
							{:else}
								<div class="flex gap-1.5">
									<form
										method="POST"
										action="?/rechazarPago"
										use:enhance={onEnhanceAccion(`rechazar-${p.pagoPendienteId}`)}
									>
										<input type="hidden" name="id" value={p.pagoPendienteId} />
										<button
											type="submit"
											disabled={procesando === `rechazar-${p.pagoPendienteId}`}
											class="rounded-input border border-border bg-surface px-3 py-2 text-xs font-semibold text-muted transition-colors duration-200 hover:bg-money-contra-bg hover:text-money-contra disabled:opacity-60"
										>
											Rechazar
										</button>
									</form>
									<form
										method="POST"
										action="?/confirmarPago"
										use:enhance={onEnhanceAccion(`confirmar-${p.pagoPendienteId}`)}
									>
										<input type="hidden" name="id" value={p.pagoPendienteId} />
										<button
											type="submit"
											disabled={procesando === `confirmar-${p.pagoPendienteId}`}
											class="rounded-input bg-brand-500 px-3 py-2 text-xs font-semibold text-white transition-colors duration-200 hover:bg-brand-700 disabled:opacity-60"
										>
											Confirmar
										</button>
									</form>
								</div>
							{/if}
						{:else if aFavor}
							<form
								method="POST"
								action="?/marcarRecibido"
								use:enhance={onEnhanceAccion(`r-${p.userId}`)}
							>
								<input type="hidden" name="pagador_id" value={p.userId} />
								<input type="hidden" name="monto" value={p.saldo} />
								<button
									type="submit"
									disabled={procesando === `r-${p.userId}`}
									class="w-full rounded-input bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition-colors duration-200 hover:bg-brand-700 disabled:opacity-60 lg:w-auto"
								>
									{procesando === `r-${p.userId}` ? '…' : 'Ya me llegó'}
								</button>
							</form>
							<p class="text-right text-[10px] text-muted">
								Al marcarlo, queda saldado con {p.nombre}.
							</p>
						{:else}
							<form
								method="POST"
								action="?/pagar"
								use:enhance={onEnhanceAccion(`p-${p.userId}`)}
							>
								<input type="hidden" name="receptor_id" value={p.userId} />
								<input type="hidden" name="monto" value={-p.saldo} />
								<button
									type="submit"
									disabled={procesando === `p-${p.userId}`}
									class="w-full rounded-input bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition-colors duration-200 hover:bg-brand-700 disabled:opacity-60 lg:w-auto"
								>
									{procesando === `p-${p.userId}` ? '…' : 'Ya pagué'}
								</button>
							</form>
							<p class="text-right text-[10px] text-muted">
								Queda pendiente hasta que {p.nombre} confirme.
							</p>
						{/if}
					</div>
				</div>

				<!-- Toggle del desglose -->
				{#if p.detalles.length > 0}
					<button
						type="button"
						onclick={() => toggleDetalle(p.userId)}
						class="flex w-full items-center gap-1.5 border-t border-border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted transition-colors duration-200 hover:bg-bg hover:text-text"
					>
						{#if expandido}
							<ChevronDown size={12} />
						{:else}
							<ChevronRight size={12} />
						{/if}
						{p.detalles.length}
						{p.detalles.length === 1 ? 'movimiento' : 'movimientos'} que componen este saldo
					</button>

					{#if expandido}
						<ul transition:slide={{ duration: 200 }} class="flex flex-col gap-1 border-t border-border bg-bg px-4 py-3">
							{#each p.detalles as d (d.id + d.tipo)}
								{@const Ico = d.tipo === 'gasto' ? Receipt : HandCoins}
								{@const dAFavor = d.contribucion === 'a_favor'}
								<li>
									<a
										href={d.url}
										class="flex items-center gap-2 rounded-input px-2 py-1.5 transition-colors duration-200 hover:bg-surface"
									>
										<span
											class={'tabular shrink-0 text-xs font-bold ' +
												(dAFavor ? 'text-money-favor' : 'text-money-contra')}
											style="min-width: 90px;"
										>
											{dAFavor ? '+' : '−'} {d.montoTexto}
										</span>
										<Ico size={13} class="shrink-0 text-muted" />
										<span class="min-w-0 flex-1 truncate text-xs text-text">{d.titulo}</span>
										<span class="shrink-0 text-[10px] uppercase tracking-wide text-muted">
											{d.tipo === 'gasto' ? 'Gasto' : 'Préstamo'}
										</span>
									</a>
								</li>
							{/each}
							<li class="mt-2 flex items-center justify-between border-t border-border pt-2">
								<span class="text-[10px] font-semibold uppercase tracking-wide text-muted">
									Neto con {p.nombre}
								</span>
								<span
									class={'tabular text-sm font-bold ' +
										(aFavor ? 'text-money-favor' : 'text-money-contra')}
								>
									{aFavor ? '+' : '−'} {p.saldoTexto}
								</span>
							</li>
						</ul>
					{/if}
				{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>
