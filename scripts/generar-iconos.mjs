// Genera los PNG de iconos a partir de static/icon.svg.
// Uso: node scripts/generar-iconos.mjs
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(__dirname, '..');
const svg = readFileSync(resolve(raiz, 'static/icon.svg'));

const tamanos = [{ archivo: 'static/apple-touch-icon.png', size: 180 }];

for (const { archivo, size } of tamanos) {
	await sharp(svg, { density: 384 })
		.resize(size, size)
		.png()
		.toFile(resolve(raiz, archivo));
	console.log('generado', archivo, `${size}x${size}`);
}
