/* Service worker de Web Push real. Recibe los `push` del servidor y muestra la
   notificacion (funciona con el navegador cerrado/segundo plano). Persistente:
   NO se desregistra (el push lo necesita vivo). */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
	let d = { title: 'Splitmate', body: 'Notificacion' };
	try {
		if (event.data) d = event.data.json();
	} catch (e) {
		/* payload no-JSON: usar defaults */
	}
	event.waitUntil(
		self.registration.showNotification(d.title || 'Splitmate', {
			body: d.body || '',
			icon: d.icon || '/apple-touch-icon.png',
			badge: '/apple-touch-icon.png',
			tag: d.tag || 'splitmate-push',
			renotify: true,
			data: { url: d.url || '/' }
		})
	);
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const url = (event.notification.data && event.notification.data.url) || '/';
	event.waitUntil(
		(async () => {
			const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
			for (const c of all) {
				if ('focus' in c) return c.focus();
			}
			return self.clients.openWindow(url);
		})()
	);
});
