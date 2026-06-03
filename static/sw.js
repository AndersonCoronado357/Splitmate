/* Tombstone — el Service Worker viejo de la Fase 10 (Web Push) ya no
   existe, pero los navegadores que lo registraron alguna vez siguen
   pidiendo este archivo. Este reemplazo se auto-desregistra al
   activarse y recarga las ventanas para que el navegador olvide el
   registro. Tras eso ya no vuelve a pedir /sw.js. */

self.addEventListener('install', () => {
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			try {
				await self.registration.unregister();
			} catch (e) {
				/* si no se puede desregistrar igual seguimos */
			}
			const clientes = await self.clients.matchAll({ type: 'window' });
			for (const c of clientes) {
				try {
					c.navigate(c.url);
				} catch {
					/* navegador puede no permitir navigate cross-origin/internal */
				}
			}
		})()
	);
});

// Sin handlers de push ni fetch — nada más que hacer.
