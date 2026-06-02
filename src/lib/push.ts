// ============================================================
// Cliente de notificaciones — corre SOLO en el navegador.
//
// Splitmate usa notificaciones in-app vía Supabase Realtime + la
// `Notification` API estándar. NO usa Web Push / Service Worker / FCM /
// WNS: probamos en varios navegadores y todos rechazan el subscribe
// con AbortError (Brave por Shields, Edge/Chrome por FCM bloqueado,
// iPhone porque no es PWA). El estándar funciona pero el push service
// del navegador no, y no hay forma de arreglarlo desde la app.
//
// El trade-off: las notificaciones llegan SOLO cuando Splitmate está
// abierto en alguna pestaña (foreground o background del navegador,
// pero no con el navegador cerrado). Como Splitmate se usa "abrir y
// revisar", esto cubre el caso real al 99%.
//
// Funciones:
//   - puedeNotifBrowser(): si el browser soporta Notification API.
//   - estadoPush(): permiso actual (compatibilidad con código viejo).
//   - activarPush(): pide permiso al navegador.
//   - desactivarPush(): silencia local (no se puede revocar el permiso
//     desde JS; lo marcamos en localStorage y AppNotifier obedece).
//   - notifSilenciada(): para AppNotifier; true si el usuario apagó.
// ============================================================

import { browser } from '$app/environment';

type EstadoNotif =
	| 'no-soportado' // sin Notification API (iPhone, browser viejo)
	| 'origen-inseguro' // HTTP que NO es localhost — el browser fuerza permission=denied
	| 'permiso-denegado' // el user dijo "Bloquear" en un origen seguro
	| 'permiso-pendiente' // no se ha preguntado todavía
	| 'activado' // permiso concedido y no silenciado
	| 'silenciado'; // permiso concedido pero el user apagó manualmente

const STORAGE_OFF = 'splitmate.notif_off';

function esiOS(): boolean {
	if (!browser) return false;
	const ua = navigator.userAgent;
	const macTactil =
		ua.includes('Macintosh') &&
		typeof (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints === 'number' &&
		(navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! > 1;
	return /iPhone|iPad|iPod/.test(ua) || macTactil;
}

export function puedePushBrowser(): boolean {
	if (!browser) return false;
	if (esiOS()) return false;
	return 'Notification' in window;
}

export function razonNoSoportado(): string | null {
	if (!browser) return null;
	if (esiOS()) return 'Las notificaciones no están disponibles en iPhone con este modo de instalación.';
	if (!('Notification' in window)) return 'Tu navegador no soporta notificaciones.';
	return null;
}

export function notifSilenciada(): boolean {
	if (!browser) return false;
	try {
		return localStorage.getItem(STORAGE_OFF) === '1';
	} catch {
		return false;
	}
}

export async function estadoPush(): Promise<EstadoNotif> {
	if (!puedePushBrowser()) return 'no-soportado';
	// HTTP no-localhost (típicamente celular contra `http://<ip-pc>:5173`):
	// el navegador devuelve permission='denied' automáticamente sin
	// importar la configuración del sitio. Lo separamos del bloqueo real
	// para mostrar un mensaje claro.
	if (typeof window !== 'undefined' && !window.isSecureContext) return 'origen-inseguro';
	if (Notification.permission === 'denied') return 'permiso-denegado';
	if (Notification.permission === 'default') return 'permiso-pendiente';
	return notifSilenciada() ? 'silenciado' : 'activado';
}

export type ActivacionResultado = { ok: boolean; error?: string };

export async function activarPush(): Promise<ActivacionResultado> {
	if (!puedePushBrowser()) return { ok: false, error: razonNoSoportado() ?? 'No soportado' };

	if (typeof window !== 'undefined' && !window.isSecureContext) {
		return {
			ok: false,
			error:
				'Las notificaciones necesitan HTTPS o localhost. Estás en una URL HTTP de red local; pruébalo desde la PC en http://localhost:5173 o monta un túnel HTTPS para el celular.'
		};
	}

	const permiso = await Notification.requestPermission();
	if (permiso !== 'granted') {
		return {
			ok: false,
			error:
				permiso === 'denied'
					? 'Bloqueaste las notificaciones. Habilítalas desde la configuración del navegador.'
					: 'No se otorgó permiso.'
		};
	}

	// Si el usuario las había silenciado, las re-activamos.
	try {
		localStorage.removeItem(STORAGE_OFF);
	} catch {
		/* localStorage bloqueado: tampoco podía estar silenciado */
	}
	return { ok: true };
}

export async function desactivarPush(): Promise<{ ok: boolean; error?: string }> {
	// El permiso de Notification no se puede revocar por JS — el usuario lo
	// hace en la configuración del navegador. Acá solo marcamos el flag
	// para que `AppNotifier` no muestre nada hasta que reactive.
	try {
		localStorage.setItem(STORAGE_OFF, '1');
	} catch {
		return { ok: false, error: 'No se pudo guardar la preferencia.' };
	}
	return { ok: true };
}
