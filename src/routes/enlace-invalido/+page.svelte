<div class="flex h-dvh flex-col items-center justify-center overflow-y-auto bg-bg px-6 py-10 text-center">
	<div class="animate-fade-in w-full max-w-sm" style="animation-delay: 40ms">
		<div
			class="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-500"
		>
			<svg
				viewBox="0 0 24 24"
				class="size-8"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<circle cx="12" cy="12" r="10" />
				<line x1="12" x2="12" y1="8" y2="12" />
				<line x1="12" x2="12.01" y1="16" y2="16" />
			</svg>
		</div>

		<h1 class="text-2xl font-bold tracking-tight text-text">El enlace ya no es válido</h1>
		<p class="mx-auto mt-2 max-w-xs text-sm text-muted">
			El enlace para restablecer tu contraseña expira en una hora y solo se puede usar una vez. Pide
			uno nuevo para continuar.
		</p>

		<a
			href="/recuperar"
			class="mt-6 flex h-12 w-full items-center justify-center rounded-input bg-brand-500 font-semibold text-white transition-transform hover:bg-brand-700 active:scale-[0.99]"
		>
			Pedir un enlace nuevo
		</a>
		<a
			href="/login"
			class="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline"
		>
			Volver a iniciar sesión
		</a>
	</div>
</div>
