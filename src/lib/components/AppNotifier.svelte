<script lang="ts">
	// Notificaciones in-app vía Supabase Realtime broadcast.
	//
	// PROBLEMA QUE RESUELVE: Web Push (con SW + VAPID) depende de FCM en
	// Chrome. Cuando FCM rechaza (AbortError) no hay forma de notificar
	// con la app cerrada. Este componente cubre el caso "app abierta":
	// escucha un canal Realtime exclusivo del usuario y muestra una
	// `Notification` cada vez que el server hace broadcast.
	//
	// CÓMO SE INTEGRA: el server, además de mandar Web Push, hace un
	// broadcast a `user:<id>`. Aquí lo escuchamos y mostramos la notif.
	// Si Web Push también funciona, ambas llegan pero comparten `tag` →
	// el navegador colapsa el duplicado.
	//
	// LÍMITES:
	//  - Solo cuando la pestaña esté abierta (foreground o background del
	//    navegador, pero NO cerrado).
	//  - Necesita permiso de Notification (lo pedimos en `/ajustes`).
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { supabaseBrowser } from '$lib/supabase-browser';
	import { goto } from '$app/navigation';
	import { notifSilenciada } from '$lib/push';

	type Payload = {
		title: string;
		body?: string;
		url?: string;
		tag?: string;
	};

	const userId = $derived((page.data.user as { id?: string } | undefined)?.id ?? '');

	onMount(() => {
		if (typeof window === 'undefined') return;
		if (!('Notification' in window)) return;
		if (!userId) return;

		const supabase = supabaseBrowser();
		const sesion = page.data.session as { access_token?: string } | undefined;
		if (sesion?.access_token) supabase.realtime.setAuth(sesion.access_token);

		// Canal privado por usuario. El server hace broadcast acá con
		// `enviarPushAUsuario(...)`, que también inserta el broadcast.
		const canal = supabase
			.channel(`user-notif:${userId}`, {
				config: { broadcast: { ack: false } }
			})
			.on('broadcast', { event: 'notif' }, (msg: { payload?: unknown }) => {
				const p = msg.payload as Payload;
				if (p && p.title) mostrar(p);
			})
			.subscribe();

		function mostrar(p: Payload) {
			// Si el usuario no dio permiso o las silenció en /ajustes, no
			// mostramos nada (el broadcast llegó, pero respetamos la
			// preferencia local).
			if (Notification.permission !== 'granted') return;
			if (notifSilenciada()) return;

			try {
				const n = new Notification(p.title, {
					body: p.body || '',
					tag: p.tag || undefined,
					icon: '/icon.svg',
					badge: '/icon.svg'
				});
				n.onclick = () => {
					window.focus();
					if (p.url) goto(p.url);
					n.close();
				};
			} catch (e) {
				console.warn('[notif] no se pudo mostrar', e);
			}
		}

		return () => {
			supabase.removeChannel(canal);
		};
	});
</script>
