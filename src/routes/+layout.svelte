<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { goto, invalidate } from '$app/navigation';
	import { onMount } from 'svelte';

	let { data, children } = $props();
	let { session, supabase } = $derived(data);

	onMount(() => {
		const { data: sub } = supabase.auth.onAuthStateChange((_, newSession) => {
			if (newSession?.expires_at !== session?.expires_at) {
				invalidate('supabase:auth');
			}
		});

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
