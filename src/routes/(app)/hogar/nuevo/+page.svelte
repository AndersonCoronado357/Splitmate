<script lang="ts">
	import { enhance } from '$app/forms';
	import Select from '$lib/components/Select.svelte';
	import { monedas } from '$lib/monedas';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import House from '@lucide/svelte/icons/house';
	import Users from '@lucide/svelte/icons/users';
	import Receipt from '@lucide/svelte/icons/receipt';
	import Check from '@lucide/svelte/icons/check';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import DollarSign from '@lucide/svelte/icons/dollar-sign';
	import Shield from '@lucide/svelte/icons/shield';
	import HandCoins from '@lucide/svelte/icons/hand-coins';
	import QrCode from '@lucide/svelte/icons/qr-code';
	import Wallet from '@lucide/svelte/icons/wallet';
	import Link2 from '@lucide/svelte/icons/link-2';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	let tab = $state<'crear' | 'unir'>('crear');
	let moneda = $state('COP');
	let cargando = $state(false);
	let nombreInput = $state('');
	let codigoInput = $state('');

	const monedaLabel = $derived(monedas.find((m) => m.value === moneda)?.label ?? moneda);

	const inputClass =
		'w-full rounded-input border border-transparent bg-brand-50 px-3 py-2.5 text-text outline-none placeholder:text-muted/70';

	function onEnhance() {
		cargando = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			cargando = false;
		};
	}

	const pasos = [
		{ icon: House, titulo: 'Crea o únete', texto: 'Un hogar nuevo, o entra a uno con su código.' },
		{
			icon: Users,
			titulo: 'Invita a los tuyos',
			texto: 'Comparte el código y suma a quienes comparten gastos.'
		},
		{
			icon: Receipt,
			titulo: 'Lleven las cuentas',
			texto: 'Splitmate netea quién le debe a quién, al instante.'
		}
	];

	const incluido = [
		{ icon: Wallet, texto: 'Personaliza el nombre y la moneda' },
		{ icon: Link2, texto: 'Comparte la invitación por código, link o QR' },
		{ icon: Sparkles, texto: 'Cambia entre tus hogares al instante' },
		{ icon: Shield, texto: 'Solo el administrador edita los datos' }
	];

	const insignias = [
		{ icon: DollarSign, texto: 'Múltiples monedas' },
		{ icon: Shield, texto: 'Privado' },
		{ icon: Sparkles, texto: 'Sin tarjetas' }
	];
</script>

<!-- Listado de pasos -->
{#snippet listaPasos()}
	<ul class="space-y-5">
		{#each pasos as paso (paso.titulo)}
			<li class="flex gap-3.5">
				<span
					class="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface text-brand-700 shadow-card"
				>
					<paso.icon size={20} />
				</span>
				<div class="min-w-0">
					<p class="font-semibold text-text">{paso.titulo}</p>
					<p class="text-sm text-muted">{paso.texto}</p>
				</div>
			</li>
		{/each}
	</ul>
{/snippet}

<!-- Pestañas + tarjeta con el formulario -->
{#snippet formulario()}
	<div class="grid shrink-0 grid-cols-2 gap-1 rounded-input bg-surface p-1 shadow-card">
		<button
			type="button"
			onclick={() => (tab = 'crear')}
			class={'flex items-center justify-center gap-2 rounded-[10px] px-3 py-2 text-sm font-medium transition-colors ' +
				(tab === 'crear' ? 'bg-brand-500 text-white' : 'text-muted hover:text-text')}
		>
			<House size={16} />
			Crear hogar
		</button>
		<button
			type="button"
			onclick={() => (tab = 'unir')}
			class={'flex items-center justify-center gap-2 rounded-[10px] px-3 py-2 text-sm font-medium transition-colors ' +
				(tab === 'unir' ? 'bg-brand-500 text-white' : 'text-muted hover:text-text')}
		>
			<Users size={16} />
			Unirme
		</button>
	</div>

	<div class="mt-5 rounded-card border border-border bg-surface p-5 shadow-card">
		{#if tab === 'crear'}
			<form method="POST" action="?/crear" use:enhance={onEnhance} class="space-y-4">
				<div class="space-y-1.5">
					<label for="nombre-{tab}" class="block text-sm font-medium text-text">Nombre del hogar</label>
					<input
						id="nombre-{tab}"
						name="nombre"
						type="text"
						required
						bind:value={nombreInput}
						placeholder="Casa, Apto 301, Roomies…"
						class={inputClass}
					/>
				</div>
				<div class="space-y-1.5">
					<label for="moneda-{tab}" class="block text-sm font-medium text-text">Moneda</label>
					<Select id="moneda-{tab}" name="moneda" bind:value={moneda} options={monedas} />
					<p class="text-xs text-muted">
						Es la moneda en la que verán todos los montos del hogar.
					</p>
				</div>

				{#if form?.error && form?.modo === 'crear'}
					<p class="rounded-input bg-money-contra-bg px-3 py-2.5 text-sm text-money-contra">
						{form.error}
					</p>
				{/if}

				<button
					type="submit"
					disabled={cargando}
					class="h-11 w-full rounded-input bg-brand-500 font-semibold text-white transition-transform hover:bg-brand-700 active:scale-[0.99] disabled:opacity-60"
				>
					{cargando ? 'Creando…' : 'Crear hogar'}
				</button>
			</form>
		{:else}
			<form method="POST" action="?/unir" use:enhance={onEnhance} class="space-y-4">
				<div class="space-y-1.5">
					<label for="codigo-{tab}" class="block text-sm font-medium text-text">
						Código de invitación
					</label>
					<input
						id="codigo-{tab}"
						name="codigo"
						type="text"
						required
						bind:value={codigoInput}
						placeholder="Ej. A3F9C2"
						autocapitalize="characters"
						class={inputClass + ' uppercase tracking-[0.2em]'}
					/>
					<p class="text-xs text-muted">Te lo comparte alguien que ya está en el hogar.</p>
				</div>

				{#if form?.error && form?.modo === 'unir'}
					<p class="rounded-input bg-money-contra-bg px-3 py-2.5 text-sm text-money-contra">
						{form.error}
					</p>
				{/if}

				<button
					type="submit"
					disabled={cargando}
					class="h-11 w-full rounded-input bg-brand-500 font-semibold text-white transition-transform hover:bg-brand-700 active:scale-[0.99] disabled:opacity-60"
				>
					{cargando ? 'Uniéndote…' : 'Unirme al hogar'}
				</button>
			</form>
		{/if}
	</div>
{/snippet}

<!-- Chips de ventajas (una sola fila en móvil; más holgados en escritorio). -->
{#snippet badges()}
	<div class="flex flex-nowrap items-center justify-center gap-1.5">
		{#each insignias as ins (ins.texto)}
			<span
				class="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] font-medium text-muted shadow-card sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-xs"
			>
				<ins.icon size={11} class="shrink-0 text-brand-500" />
				{ins.texto}
			</span>
		{/each}
	</div>
{/snippet}

<!-- Vista previa LIVE del hogar (refleja lo que escribes) -->
{#snippet vistaPrevia()}
	<div class="rounded-card border border-border bg-surface p-4 shadow-card">
		<p class="text-xs font-semibold tracking-wide text-muted uppercase">
			{tab === 'crear' ? 'Vista previa' : 'Te unirás como'}
		</p>
		<div class="mt-3 flex items-center gap-3">
			<span
				class="grid size-12 shrink-0 place-items-center rounded-card bg-brand-500 text-white shadow-card"
			>
				<House size={22} />
			</span>
			<div class="min-w-0 flex-1">
				<p class="truncate font-semibold text-text">
					{tab === 'crear'
						? nombreInput.trim() || 'Tu hogar nuevo'
						: codigoInput.trim()
							? `Hogar ${codigoInput.toUpperCase()}`
							: 'Hogar al que te invitaron'}
				</p>
				<p class="truncate text-xs text-muted">
					{tab === 'crear' ? `${monedaLabel} · Tú como admin` : 'Entrarás como miembro'}
				</p>
			</div>
		</div>
	</div>
{/snippet}

<!-- Tarjeta de tip -->
{#snippet tip()}
	<div class="flex items-start gap-3 rounded-card border border-border bg-surface p-4 shadow-card">
		<span
			class="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700"
		>
			<Sparkles size={18} />
		</span>
		<div class="min-w-0">
			<p class="text-sm font-semibold text-text">¿Sabías?</p>
			<p class="text-sm text-muted">
				Puedes pertenecer a varios hogares a la vez y cambiar entre ellos desde el botón de la
				esquina.
			</p>
		</div>
	</div>
{/snippet}

<!-- Tarjeta "Después de crear" -->
{#snippet despuesDeCrear()}
	<div class="rounded-card border border-border bg-surface p-4 shadow-card">
		<p class="text-xs font-semibold tracking-wide text-muted uppercase">
			{tab === 'crear' ? 'Después de crear' : 'Al unirte'}
		</p>
		<ul class="mt-2.5 space-y-1.5 text-sm text-muted">
			{#if tab === 'crear'}
				<li class="flex gap-2"><Check size={14} class="mt-0.5 shrink-0 text-brand-500" />Recibes el código y el link al instante</li>
				<li class="flex gap-2"><Check size={14} class="mt-0.5 shrink-0 text-brand-500" />Invitas por WhatsApp, link o QR</li>
				<li class="flex gap-2"><Check size={14} class="mt-0.5 shrink-0 text-brand-500" />Empiezan a registrar gastos del grupo</li>
			{:else}
				<li class="flex gap-2"><Check size={14} class="mt-0.5 shrink-0 text-brand-500" />Ves los gastos del hogar al instante</li>
				<li class="flex gap-2"><Check size={14} class="mt-0.5 shrink-0 text-brand-500" />Sumas los tuyos y se netean automáticamente</li>
				<li class="flex gap-2"><Check size={14} class="mt-0.5 shrink-0 text-brand-500" />Cambias de hogar cuando quieras</li>
			{/if}
		</ul>
	</div>
{/snippet}

<div class="flex flex-col px-5 py-6 md:px-8 lg:h-full lg:w-full lg:flex-1">
	<a
		href="/hogar"
		class="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-text"
	>
		<ArrowLeft size={16} />
		Volver
	</a>

	<!-- ================= MÓVIL ================= -->
	<div class="mt-4 flex flex-1 flex-col lg:hidden">
		<h1 class="text-2xl font-bold tracking-tight text-text">Nuevo hogar</h1>
		<p class="mt-1.5 text-sm text-muted">
			Crea otro hogar o únete con un código. Cambias entre ellos cuando quieras.
		</p>

		<div class="mt-4">{@render vistaPrevia()}</div>
		<div class="mt-4">{@render badges()}</div>
		<div class="mt-5">{@render formulario()}</div>
		<div class="mt-5">{@render tip()}</div>
		<div class="mt-5">{@render despuesDeCrear()}</div>

		<div class="mt-5 rounded-card bg-brand-50 p-5">
			<p class="text-xs font-semibold tracking-wide text-brand-700 uppercase">Cómo funciona</p>
			<div class="mt-4">{@render listaPasos()}</div>
			<div class="mt-5 border-t border-brand-200/50 pt-4">
				<ul class="space-y-2.5">
					{#each incluido as item (item.texto)}
						<li class="flex items-start gap-2 text-sm text-text">
							<item.icon size={16} class="mt-0.5 shrink-0 text-brand-500" />
							{item.texto}
						</li>
					{/each}
				</ul>
			</div>
		</div>
	</div>

	<!-- ================= ESCRITORIO ================= -->
	<div class="mt-4 hidden min-h-0 flex-1 gap-8 lg:flex lg:items-stretch">
		<!-- Panel izquierdo: contenido + densa decoración de íconos -->
		<div
			class="relative flex flex-1 flex-col justify-center overflow-hidden rounded-card bg-brand-50 p-8 lg:p-10"
		>
			<!-- Decoración de fondo: íconos densos en bordes y franjas superior/inferior
			     (zonas sin texto). La máscara radial garantiza que nada caiga al centro. -->
			<div class="decor-icons-mask pointer-events-none absolute inset-0">
				<!-- Esquinas -->
				<House size={30} class="absolute top-2 left-2 text-brand-200" />
				<QrCode size={32} class="absolute top-2 right-2 text-brand-200" />
				<Receipt size={30} class="absolute bottom-2 left-2 text-brand-200" />
				<Sparkles size={26} class="absolute bottom-2 right-2 text-brand-200" />
				<!-- Franja superior (sobre el título) -->
				<Check size={22} class="absolute top-[2%] left-[28%] text-brand-200" />
				<DollarSign size={22} class="absolute top-[2%] right-[28%] text-brand-200" />
				<Wallet size={20} class="absolute top-[8%] left-[45%] text-brand-200" />
				<!-- Bordes laterales -->
				<Users size={24} class="absolute top-[22%] left-[1%] text-brand-200" />
				<Wallet size={22} class="absolute top-[22%] right-[1%] text-brand-200" />
				<HandCoins size={24} class="absolute top-[42%] left-[1%] text-brand-200" />
				<DollarSign size={22} class="absolute top-[42%] right-[1%] text-brand-200" />
				<Link2 size={22} class="absolute top-[62%] left-[1%] text-brand-200" />
				<Shield size={22} class="absolute top-[62%] right-[1%] text-brand-200" />
				<House size={20} class="absolute top-[82%] left-[1%] text-brand-200" />
				<Receipt size={20} class="absolute top-[82%] right-[1%] text-brand-200" />
				<!-- Franja inferior (debajo del bloque "Lo que incluye") -->
				<Sparkles size={22} class="absolute bottom-[2%] left-[32%] text-brand-200" />
				<HandCoins size={22} class="absolute bottom-[2%] right-[32%] text-brand-200" />
				<QrCode size={20} class="absolute bottom-[8%] left-[48%] text-brand-200" />
			</div>

			<!-- Contenido en un solo bloque (junto, sin separaciones forzadas). -->
			<div class="relative">
				<h1 class="text-3xl font-bold tracking-tight text-text">Nuevo hogar</h1>
				<p class="mt-3 text-muted">
					Cada hogar tiene su propio nombre, moneda y miembros. Crea otro para llevar tus cuentas
					con un grupo distinto —pareja, familia, viaje, roomies—, y cambia entre ellos al instante.
				</p>

				<div class="mt-8">{@render listaPasos()}</div>

				<div class="mt-8 border-t border-brand-200/50 pt-6">
					<p class="text-xs font-semibold tracking-wide text-brand-700 uppercase">Lo que incluye</p>
					<ul class="mt-3 space-y-2.5">
						{#each incluido as item (item.texto)}
							<li class="flex items-start gap-2 text-sm text-text">
								<item.icon size={16} class="mt-0.5 shrink-0 text-brand-500" />
								{item.texto}
							</li>
						{/each}
					</ul>
				</div>
			</div>
		</div>

		<!-- Panel derecho: ancho amplio (max-w-xl) y contenido distribuido top/medio/
		     bottom para que ocupe todo el alto. Decoración de íconos al fondo. -->
		<div class="relative flex flex-1 flex-col justify-between gap-5 overflow-hidden py-2">
			<!-- Decoración: solo en bordes laterales (el formulario va al centro
			     y los íconos no quedan debajo del texto). -->
			<div class="decor-icons-mask pointer-events-none absolute inset-0">
				<House size={28} class="absolute top-2 left-2 text-brand-200/70" />
				<QrCode size={26} class="absolute top-2 right-2 text-brand-200/70" />
				<Users size={22} class="absolute top-[24%] left-[1%] text-brand-200/70" />
				<Wallet size={22} class="absolute top-[24%] right-[1%] text-brand-200/70" />
				<HandCoins size={22} class="absolute top-[50%] left-[1%] text-brand-200/70" />
				<DollarSign size={20} class="absolute top-[50%] right-[1%] text-brand-200/70" />
				<Link2 size={20} class="absolute top-[76%] left-[1%] text-brand-200/70" />
				<Shield size={20} class="absolute top-[76%] right-[1%] text-brand-200/70" />
				<Receipt size={26} class="absolute bottom-2 left-2 text-brand-200/70" />
				<Sparkles size={22} class="absolute bottom-2 right-2 text-brand-200/70" />
			</div>

			<!-- Arriba: vista previa + chips -->
			<div class="relative mx-auto w-full max-w-xl space-y-4">
				{@render vistaPrevia()}
				{@render badges()}
			</div>

			<!-- Medio: formulario -->
			<div class="relative mx-auto w-full max-w-xl">
				{@render formulario()}
			</div>

			<!-- Abajo: tip + después de crear -->
			<div class="relative mx-auto w-full max-w-xl space-y-4">
				{@render tip()}
				{@render despuesDeCrear()}
			</div>
		</div>
	</div>
</div>
