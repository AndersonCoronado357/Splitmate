<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import { iconoCategoria, ICONOS_DISPONIBLES } from '$lib/iconosCategoria';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Plus from '@lucide/svelte/icons/plus';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Check from '@lucide/svelte/icons/check';
	import X from '@lucide/svelte/icons/x';
	import Tag from '@lucide/svelte/icons/tag';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const esAdmin = $derived(
		(page.data.hogarActivo as { rol?: string } | undefined)?.rol === 'admin'
	);
	const nombreHogar = $derived(
		(page.data.hogarActivo as { nombre?: string } | undefined)?.nombre || 'tu hogar'
	);

	// === Form unificado: crear o editar. Reutiliza el mismo bloque visual. ===
	let modo = $state<'crear' | 'editar'>('crear');
	let editandoId = $state<string | null>(null);
	let formNombre = $state('');
	let formIcono = $state('tag');
	let errorCategoria = $state<string | null>(null);

	function comenzarEditar(c: { id: string; nombre: string; icono: string | null }) {
		modo = 'editar';
		editandoId = c.id;
		formNombre = c.nombre;
		formIcono = c.icono || 'tag';
		confirmandoBorrarId = null;
	}
	function cancelarEditar() {
		modo = 'crear';
		editandoId = null;
		formNombre = '';
		formIcono = 'tag';
	}

	// === Optimistic UI =========================================================
	// nuevasPend: categorías que ACABO de crear (con id temporal). Aparecen al
	// instante en la grilla.
	// editsLocales: ediciones locales sobre categorías ya existentes
	// (id real → nombre/icono nuevos), aplicadas al instante en la vista.
	// borradosIds: categorías que ACABO de borrar; se ocultan al instante.
	// CADA optimista se limpia ÉL solo cuando SU propia acción confirmó
	// (ver enhance handlers) — así no se mezclan cuando hay varias acciones
	// rápidas en vuelo.
	type CategoriaPend = { tempId: string; nombre: string; icono: string };
	let nuevasPend = $state<CategoriaPend[]>([]);
	let editsLocales = $state(new Map<string, { nombre: string; icono: string }>());
	let borradosIds = $state(new Set<string>());

	// Lista efectiva = (server filtradas - borrados) + (server con edit aplicada) + (nuevas pendientes)
	const categoriasEfectivas = $derived.by(() => {
		const base = data.categorias
			.filter((c) => !borradosIds.has(c.id))
			.map((c) => {
				const e = editsLocales.get(c.id);
				return e ? { ...c, nombre: e.nombre, icono: e.icono } : c;
			});
		const nuevas = nuevasPend.map((n) => ({
			id: n.tempId,
			nombre: n.nombre,
			icono: n.icono,
			orden: 999
		}));
		return [...base, ...nuevas];
	});

	function onEnhanceForm({ formData, cancel }: { formData: FormData; cancel: () => void }) {
		const nombre = String(formData.get('nombre') ?? '').trim();
		const icono = String(formData.get('icono') ?? 'tag') || 'tag';
		if (!nombre) {
			cancel();
			return;
		}

		errorCategoria = null;
		// Capturamos el modo y el id que SE ESTÁ enviando ahora, así el rollback
		// y la limpieza apuntan exactamente a esta acción aunque el usuario
		// cambie el modo del form mientras tanto.
		const modoEnvio = modo;
		const idEnvio = editandoId;
		const tempId = modoEnvio === 'crear' ? `tmp-${crypto.randomUUID()}` : null;

		if (modoEnvio === 'crear' && tempId) {
			nuevasPend = [...nuevasPend, { tempId, nombre, icono }];
		} else if (modoEnvio === 'editar' && idEnvio) {
			const next = new Map(editsLocales);
			next.set(idEnvio, { nombre, icono });
			editsLocales = next;
		}
		cancelarEditar();

		return async ({
			result,
			update
		}: {
			result: { type: string; data?: { error?: string } };
			update: (opts?: { reset?: boolean; invalidateAll?: boolean }) => Promise<void>;
		}) => {
			if (result.type === 'success') {
				await update({ invalidateAll: false });
				await invalidate('app:categorias');
				// Limpiamos SOLO el optimista de ESTA acción.
				if (modoEnvio === 'crear' && tempId) {
					nuevasPend = nuevasPend.filter((p) => p.tempId !== tempId);
				} else if (modoEnvio === 'editar' && idEnvio) {
					const next = new Map(editsLocales);
					next.delete(idEnvio);
					editsLocales = next;
				}
			} else {
				if (modoEnvio === 'crear' && tempId) {
					nuevasPend = nuevasPend.filter((p) => p.tempId !== tempId);
				} else if (modoEnvio === 'editar' && idEnvio) {
					const next = new Map(editsLocales);
					next.delete(idEnvio);
					editsLocales = next;
				}
				errorCategoria = result.data?.error || 'No se pudo guardar la categoría.';
			}
		};
	}

	// === Borrar ===
	let confirmandoBorrarId = $state<string | null>(null);
	function onEnhanceBorrar(id: string) {
		// Optimistic: ocultar al instante; rollback si falla.
		borradosIds = new Set([...borradosIds, id]);
		confirmandoBorrarId = null;
		errorCategoria = null;
		return async ({
			result,
			update
		}: {
			result: { type: string; data?: { error?: string } };
			update: (opts?: { reset?: boolean; invalidateAll?: boolean }) => Promise<void>;
		}) => {
			if (result.type === 'success') {
				await update({ invalidateAll: false });
				await invalidate('app:categorias');
				// Limpiamos SOLO el id que borramos en esta acción.
				const next = new Set(borradosIds);
				next.delete(id);
				borradosIds = next;
			} else {
				const next = new Set(borradosIds);
				next.delete(id);
				borradosIds = next;
				errorCategoria = result.data?.error || 'No se pudo borrar la categoría.';
			}
		};
	}
</script>

{#snippet iconPicker(seleccionado: string, onPick: (v: string) => void)}
	<div class="flex flex-wrap gap-1.5">
		{#each ICONOS_DISPONIBLES as it (it.value)}
			{@const sel = seleccionado === it.value}
			<button
				type="button"
				onclick={() => onPick(it.value)}
				class={'grid size-10 shrink-0 place-items-center rounded-input border-2 transition-colors ' +
					(sel
						? 'border-brand-500 bg-brand-500 text-white'
						: 'border-transparent bg-brand-50 text-brand-700 hover:bg-brand-200')}
				aria-label={it.value}
				aria-pressed={sel}
			>
				<it.Icono size={18} />
			</button>
		{/each}
	</div>
{/snippet}

<div class="flex flex-col px-5 py-6 md:px-8 lg:h-full lg:w-full lg:flex-1 lg:min-h-0">
	<a
		href="/gastos"
		class="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-text"
	>
		<ArrowLeft size={16} />
		Volver
	</a>

	<header class="mt-4 flex items-end justify-between gap-3">
		<div>
			<h1 class="text-2xl font-bold text-text">Categorías</h1>
			<p class="mt-1 text-sm text-muted">
				Las categorías son de <span class="font-medium text-text">{nombreHogar}</span>.
				{#if !esAdmin}
					Solo el administrador puede crearlas o modificarlas.
				{/if}
			</p>
		</div>
		<span
			class="tabular shrink-0 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700"
		>
			{categoriasEfectivas.length}
			{categoriasEfectivas.length === 1 ? 'cat.' : 'cats.'}
		</span>
	</header>

	<!-- Form unificado (crear / editar). Misma posición; cambia título, acción y CTA. -->
	{#if esAdmin}
		<section class="mt-5">
			<p class="px-1 text-xs font-semibold tracking-wide text-muted uppercase">
				{#if modo === 'crear'}
					Nueva categoría
				{:else}
					Editando categoría
				{/if}
			</p>
			<form
				method="POST"
				action={modo === 'crear' ? '?/crear' : '?/editar'}
				use:enhance={onEnhanceForm}
				class={'mt-2 rounded-card border border-border bg-surface p-4 shadow-card transition-colors ' +
					(modo === 'editar' ? 'bg-brand-50/40' : '')}
			>
				<input type="hidden" name="icono" value={formIcono} />
				{#if modo === 'editar' && editandoId}
					<input type="hidden" name="id" value={editandoId} />
				{/if}

				<div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-5">
					<!-- Nombre -->
					<div class="space-y-1.5 lg:w-96 lg:shrink-0">
						<label for="form-nombre" class="block text-sm font-medium text-text">Nombre</label>
						<input
							id="form-nombre"
							name="nombre"
							type="text"
							required
							autocomplete="off"
							maxlength="40"
							bind:value={formNombre}
							placeholder="Ej. Mascota, Suscripciones…"
							class="w-full rounded-input border border-transparent bg-brand-50 px-3 py-2.5 text-text outline-none placeholder:text-muted/70"
						/>
					</div>

					<!-- Iconos -->
					<div class="min-w-0 flex-1 space-y-1.5">
						<p class="block text-sm font-medium text-text">Ícono</p>
						{@render iconPicker(formIcono, (v) => (formIcono = v))}
					</div>

					<!-- Acciones -->
					<div class="flex shrink-0 gap-2">
						{#if modo === 'editar'}
							<button
								type="button"
								onclick={cancelarEditar}
								class="flex h-11 items-center justify-center rounded-input border border-border bg-surface px-4 text-sm font-semibold text-text transition-colors hover:bg-bg"
							>
								Cancelar
							</button>
						{/if}
						<button
							type="submit"
							disabled={!formNombre.trim()}
							class="flex h-11 items-center justify-center gap-2 rounded-input bg-brand-500 px-5 font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
						>
							{#if modo === 'crear'}
								<Plus size={16} />
								Crear categoría
							{:else}
								<Check size={16} />
								Guardar cambios
							{/if}
						</button>
					</div>
				</div>

				{#if errorCategoria}
					<p class="mt-3 rounded-input bg-money-contra-bg px-3 py-2 text-sm text-money-contra">
						{errorCategoria}
					</p>
				{/if}
			</form>
		</section>
	{:else}
		<div
			class="mt-5 rounded-card border border-dashed border-border bg-surface px-5 py-3 text-center text-sm text-muted"
		>
			Solo el administrador del hogar puede crear, renombrar o borrar categorías.
		</div>
	{/if}

	<!-- Grilla de categorías a todo el ancho. Scrollea internamente si hay muchas. -->
	<section class="mt-5 flex flex-col lg:min-h-0 lg:flex-1">
		<p class="px-1 text-xs font-semibold tracking-wide text-muted uppercase">
			Categorías del hogar
		</p>

		{#if categoriasEfectivas.length === 0}
			<div
				class="mt-2 flex flex-col items-center justify-center rounded-card border border-dashed border-border bg-surface p-10 text-center lg:flex-1 lg:min-h-0"
			>
				<span
					class="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-700"
				>
					<Tag size={24} />
				</span>
				<p class="mt-3 text-sm font-medium text-text">Sin categorías todavía</p>
				<p class="mt-1 text-xs text-muted">
					{esAdmin ? 'Crea la primera con el formulario.' : 'Pídele al admin que cree alguna.'}
				</p>
			</div>
		{:else}
			<div
				class="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:flex-1 lg:min-h-0 lg:content-start lg:overflow-y-auto lg:pr-1"
			>
				{#each categoriasEfectivas as c (c.id)}
					{@const Icono = iconoCategoria(c.icono)}
					{@const confirmando = confirmandoBorrarId === c.id}
					{@const editandoEsta = editandoId === c.id}
					{@const esTemporal = c.id.startsWith('tmp-')}

					{#if confirmando}
						<!-- Confirmación de borrar -->
						<div
							class="flex flex-col items-center gap-3 rounded-card border border-border bg-money-contra-bg/40 p-4 text-center"
						>
							<span
								class="grid size-12 place-items-center rounded-full bg-surface text-money-contra"
							>
								<Trash2 size={20} />
							</span>
							<div>
								<p class="text-sm font-semibold text-text">¿Borrar "{c.nombre}"?</p>
								<p class="mt-0.5 text-xs text-muted">
									Los gastos que la usaban quedarán sin categoría.
								</p>
							</div>
							<div class="flex w-full gap-2">
								<form
									method="POST"
									action="?/borrar"
									use:enhance={() => onEnhanceBorrar(c.id)}
									class="flex-1"
								>
									<input type="hidden" name="id" value={c.id} />
									<button
										type="submit"
										class="w-full rounded-input bg-money-contra px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
									>
										Sí, borrar
									</button>
								</form>
								<button
									type="button"
									onclick={() => (confirmandoBorrarId = null)}
									class="flex-1 rounded-input bg-surface px-3 py-2 text-xs font-medium text-text transition-colors hover:bg-bg"
								>
									Cancelar
								</button>
							</div>
						</div>
					{:else}
						<!-- Tile normal. Hover y "editando" usan SOLO fondo, sin tocar el borde. -->
						<div
							class={'flex flex-col items-center gap-3 rounded-card border border-border bg-surface p-5 text-center shadow-card transition-colors ' +
								(editandoEsta ? 'bg-brand-50/40' : 'hover:bg-brand-50/20')}
						>
							<span
								class="grid size-14 place-items-center rounded-card bg-brand-50 text-brand-700"
							>
								<Icono size={26} />
							</span>
							<p class="line-clamp-2 text-sm font-semibold text-text">{c.nombre}</p>
							{#if esAdmin}
								<div class="mt-1 flex w-full gap-1 border-t border-border pt-3">
									<button
										type="button"
										onclick={() => comenzarEditar(c)}
										disabled={esTemporal}
										class="flex flex-1 items-center justify-center gap-1 rounded-input px-2 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-brand-50 hover:text-brand-700 disabled:opacity-40"
										aria-label="Editar {c.nombre}"
									>
										<Pencil size={13} />
										Editar
									</button>
									<button
										type="button"
										onclick={() => (confirmandoBorrarId = c.id)}
										disabled={esTemporal}
										class="flex flex-1 items-center justify-center gap-1 rounded-input px-2 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-money-contra-bg hover:text-money-contra disabled:opacity-40"
										aria-label="Borrar {c.nombre}"
									>
										<Trash2 size={13} />
										Borrar
									</button>
								</div>
							{/if}
						</div>
					{/if}
				{/each}
			</div>
		{/if}
	</section>
</div>
