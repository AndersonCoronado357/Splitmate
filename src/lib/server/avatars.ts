// Almacenamiento de avatares en disco (reemplaza Supabase Storage). Se guardan
// en ACMSY_DATA_DIR/avatars (un volumen persistente en el contenedor de acmsy).
import { promises as fs } from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.env.ACMSY_DATA_DIR || './data', 'avatars');
const safe = (id: string) => (/^[0-9a-fA-F-]{8,64}$/.test(id) ? id : '');

export async function saveAvatar(userId: string, bytes: Buffer, type: string): Promise<void> {
	const id = safe(userId);
	if (!id) throw new Error('id invalido');
	await fs.mkdir(DIR, { recursive: true });
	await fs.writeFile(path.join(DIR, id), bytes);
	await fs.writeFile(path.join(DIR, id + '.type'), type || 'image/jpeg');
}
export async function removeAvatar(userId: string): Promise<void> {
	const id = safe(userId);
	if (!id) return;
	await fs.rm(path.join(DIR, id), { force: true });
	await fs.rm(path.join(DIR, id + '.type'), { force: true });
}
export async function readAvatar(userId: string): Promise<{ bytes: Buffer; type: string } | null> {
	const id = safe(userId);
	if (!id) return null;
	try {
		const bytes = await fs.readFile(path.join(DIR, id));
		let type = 'image/jpeg';
		try {
			type = (await fs.readFile(path.join(DIR, id + '.type'), 'utf8')).trim() || type;
		} catch {
			/* sin sidecar */
		}
		return { bytes, type };
	} catch {
		return null;
	}
}
