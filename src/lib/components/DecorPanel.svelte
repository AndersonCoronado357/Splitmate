<script lang="ts">
	import logoWhite from '$lib/assets/logo-white.png';
	type Modo = 'login' | 'registro' | 'bienvenida';
	let { modo }: { modo: Modo } = $props();

	const VERSION = '1.0.0';

	const copy = $derived(
		modo === 'bienvenida'
			? {
					titulo: 'Un último paso y listo.',
					texto: 'Crea tu hogar o únete con el código de quien te invitó. Después invitas a los tuyos y empiezan a llevar las cuentas juntos.'
				}
			: modo === 'registro'
				? {
						titulo: 'Únete y empieza en minutos.',
						texto: 'Crea tu hogar, invita a los tuyos y lleven juntos las cuentas, sin enredos ni discusiones.'
					}
				: {
						titulo: 'Las cuentas del hogar, claras.',
						texto: 'Gastos, préstamos y fijos en un solo lugar. Splitmate calcula quién le debe a quién, al instante y en vivo.'
					}
	);
</script>

<div
	class={'relative flex h-full w-full flex-col justify-between overflow-hidden bg-brand-500 p-10 text-white xl:p-14 ' +
		(modo === 'registro' ? 'items-end text-right' : 'items-start text-left')}
>
	<!-- Circulitos flotando -->
	<div class="pointer-events-none absolute inset-0" aria-hidden="true">
		<span class="shape shape-1"></span>
		<span class="shape shape-2"></span>
		<span class="shape shape-3"></span>
		<span class="shape shape-4"></span>
	</div>

	<div class="animate-fade-in relative flex items-center gap-3" style="animation-delay: 0ms">
		<img src={logoWhite} alt="" class="h-11 w-11" />
		<span class="text-2xl font-bold">Splitmate</span>
	</div>

	{#key modo}
		<div class="relative max-w-md">
			<h2 class="animate-fade-in text-4xl leading-tight font-bold xl:text-5xl" style="animation-delay: 90ms">
				{copy.titulo}
			</h2>
			<p class="animate-fade-in mt-4 text-lg text-white/85" style="animation-delay: 170ms">
				{copy.texto}
			</p>
		</div>
	{/key}

	<div class="animate-fade-in relative text-sm text-white/70" style="animation-delay: 250ms">
		Versión {VERSION}
	</div>
</div>

<style>
	.shape {
		position: absolute;
		border-radius: 9999px;
		will-change: transform;
	}
	.shape-1 {
		width: 280px;
		height: 280px;
		background: #ffffff;
		opacity: 0.12;
		top: -60px;
		right: -40px;
		animation: float 9s ease-in-out infinite;
	}
	.shape-2 {
		width: 190px;
		height: 190px;
		background: #075c54;
		opacity: 0.25;
		bottom: 70px;
		left: -50px;
		animation: float 12s ease-in-out infinite 0.8s;
	}
	.shape-3 {
		width: 130px;
		height: 130px;
		background: #9fe3dc;
		opacity: 0.3;
		top: 42%;
		right: 14%;
		animation: float 10s ease-in-out infinite 0.4s;
	}
	.shape-4 {
		width: 90px;
		height: 90px;
		background: #ffffff;
		opacity: 0.14;
		bottom: 20%;
		right: 32%;
		animation: float 8s ease-in-out infinite 1.2s;
	}
	@keyframes float {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-22px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.shape {
			animation: none;
		}
	}
</style>
