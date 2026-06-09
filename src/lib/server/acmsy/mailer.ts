// Correo por Resend (fetch, sin dependencias) + plantilla de recuperacion de
// contrasena con la marca de acmsy. Portado a ESM.

import { env } from '$env/dynamic/private';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

function getApiKey(): string {
	const k = env.RESEND_API_KEY;
	if (!k) throw new Error('Falta RESEND_API_KEY en el entorno.');
	return k;
}
function senderFor(displayName?: string): string {
	const address = env.MAIL_FROM || 'noreply@acmsy.com';
	const name = displayName || env.MAIL_FROM_NAME || 'acmsy';
	return `${name} <${address}>`;
}

export async function sendEmail(o: {
	to: string | string[];
	subject: string;
	html?: string;
	text?: string;
	displayName?: string;
	replyTo?: string;
}): Promise<{ ok: true; id: string }> {
	if (!o.to) throw new Error('Falta el destinatario.');
	const payload: Record<string, unknown> = {
		from: senderFor(o.displayName),
		to: Array.isArray(o.to) ? o.to : [o.to],
		subject: o.subject
	};
	if (o.html) payload.html = o.html;
	if (o.text) payload.text = o.text;
	if (o.replyTo) payload.reply_to = o.replyTo;

	const res = await fetch(RESEND_ENDPOINT, {
		method: 'POST',
		headers: { Authorization: `Bearer ${getApiKey()}`, 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});
	const data = await res.json().catch(() => ({}) as any);
	if (!res.ok) throw new Error(data?.message || 'Resend devolvio un error ' + res.status);
	return { ok: true, id: data.id };
}

// --- Plantilla de recuperacion de contrasena (marca acmsy, sin emojis) ---
const C = { bg: '#0B0119', card: '#1F0245', accent: '#7008F7', text: '#F1E6FE', muted: '#D7BAFD', border: '#2C0361' };
const FONT = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif';

export function passwordResetEmail({
	appName,
	url,
	minutes = 30
}: {
	appName: string;
	url: string;
	minutes?: number;
}): { subject: string; html: string; text: string } {
	const p = (t: string) =>
		`<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:${C.muted};">${t}</p>`;
	const bodyHtml =
		p('Recibimos una solicitud para restablecer la contraseña de tu cuenta.') +
		`<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;"><tr><td style="background:${C.accent};border-radius:10px;"><a href="${url}" style="display:inline-block;padding:11px 22px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;font-family:${FONT};">Crear nueva contraseña</a></td></tr></table>` +
		p(`Este enlace caduca en ${minutes} minutos y solo puede usarse una vez.`) +
		p('Si no fuiste tú, ignora este correo: tu contraseña no cambiará.') +
		`<p style="margin:14px 0 0;font-size:12px;line-height:1.55;color:${C.muted};opacity:.7;word-break:break-all;">Si el botón no funciona, copia y pega este enlace:<br>${url}</p>`;
	const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:${C.bg};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:32px 12px;"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:${C.card};border-radius:14px;border:1px solid ${C.border};font-family:${FONT};"><tr><td style="padding:24px 28px 6px;"><div style="font-size:15px;font-weight:600;letter-spacing:.02em;color:${C.text};">acmsy &middot; ${appName}</div></td></tr><tr><td style="padding:6px 28px 26px;"><h1 style="margin:0 0 14px;font-size:19px;font-weight:600;color:${C.text};">Restablecer tu contraseña</h1>${bodyHtml}</td></tr></table></td></tr></table></body></html>`;
	return {
		subject: `Restablecer tu contraseña - ${appName}`,
		html,
		text: `Restablecer tu contraseña\n\nAbre este enlace para crear una nueva contraseña (caduca en ${minutes} minutos, un solo uso):\n${url}\n\nSi no fuiste tú, ignora este correo.`
	};
}
