// Motor de realtime. Un cliente pg dedicado escucha `LISTEN evento` (los
// disparadores de la BD hacen pg_notify en cada cambio) y reparte el evento a las
// pestañas conectadas por SSE de ese hogar, que entonces refrescan al instante.
// El PUSH NO se envía aquí: lo hacen las acciones de la app (enviarPushAUsuario(s))
// con destinatario y texto ya personalizados, para no duplicar avisos.
import pg from 'pg';
import { env } from '$env/dynamic/private';

type Evento = { hogar_id: string; tabla: string; op: string; actor?: string | null };
type Listener = (e: Evento) => void;

const porHogar = new Map<string, Set<Listener>>();
let listenClient: pg.Client | null = null;
let conectando: Promise<void> | null = null;

async function asegurarListen(): Promise<void> {
	if (listenClient) return;
	if (conectando) return conectando;
	conectando = (async () => {
		const client = new pg.Client({ connectionString: env.DATABASE_URL });
		client.on('notification', (msg) => {
			if (msg.channel !== 'evento' || !msg.payload) return;
			let e: Evento;
			try {
				e = JSON.parse(msg.payload);
			} catch {
				return;
			}
			manejar(e);
		});
		client.on('error', () => {
			try {
				client.end();
			} catch {
				/* noop */
			}
			if (listenClient === client) listenClient = null;
			conectando = null;
			if (porHogar.size > 0) setTimeout(() => asegurarListen().catch(() => {}), 2000);
		});
		await client.connect();
		await client.query('LISTEN evento');
		listenClient = client;
	})();
	try {
		await conectando;
	} finally {
		conectando = null;
	}
}

function manejar(e: Evento) {
	const set = porHogar.get(e.hogar_id);
	if (set)
		for (const fn of [...set]) {
			try {
				fn(e);
			} catch {
				/* noop */
			}
		}
}

// Suscribe una pestaña a los eventos de un hogar. Devuelve la función para cancelar.
export async function suscribir(hogarId: string, fn: Listener): Promise<() => void> {
	await asegurarListen();
	let set = porHogar.get(hogarId);
	if (!set) {
		set = new Set();
		porHogar.set(hogarId, set);
	}
	set.add(fn);
	return () => {
		const s = porHogar.get(hogarId);
		if (s) {
			s.delete(fn);
			if (s.size === 0) porHogar.delete(hogarId);
		}
	};
}
