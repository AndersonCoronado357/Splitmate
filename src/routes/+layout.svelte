<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { goto, invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { supabaseBrowser } from '$lib/supabase-browser';
	import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

	let { data, children } = $props();
	const session = $derived(data.session);

	onMount(() => {
		const supabase = supabaseBrowser();
		const { data: sub } = supabase.auth.onAuthStateChange(
			(event: AuthChangeEvent, newSession: Session | null) => {
			// IGNORAMOS `INITIAL_SESSION`: Supabase dispara este evento al suscribirse
			// con la sesión que YA leyó de cookies/localStorage. En el reload, ese
			// expires_at suele diferir por unos milisegundos del que vino del SSR,
			// y eso disparaba `invalidate('supabase:auth')` → re-render de TODA la
			// app justo después de hidratar = el segundo parpadeo. Solo nos
			// importan los cambios reales (sign-in, sign-out, refresh explícito).
				if (event === 'INITIAL_SESSION') return;
				if (newSession?.expires_at !== session?.expires_at) {
					invalidate('supabase:auth');
				}
			}
		);

		// Enlace de correo inválido/expirado: Supabase manda el error en el hash
		// de la URL (lado cliente). Lo detectamos y mostramos una vista amable.
		const raw = window.location.hash.replace(/^#/, '') || window.location.search.replace(/^\?/, '');
		const params = new URLSearchParams(raw);
		if (params.get('error_code') === 'otp_expired' || params.get('error') === 'access_denied') {
			history.replaceState(null, '', window.location.pathname);
			goto('/enlace-invalido', { replaceState: true });
		}

		return () => sub.subscription.unsubscribe();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
