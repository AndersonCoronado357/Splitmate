// Arranca Vite en un puerto temporal, captura las pantallas de auth en
// desktop y móvil, y apaga Vite. Todo en primer plano: termina solo.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = 5199;
const NODE = 'C:\\Program Files\\nodejs\\node.exe';

const vite = spawn(NODE, ['node_modules/vite/bin/vite.js', 'dev', '--port', String(PORT)], {
	stdio: 'ignore'
});

async function waitReady(url, timeoutMs = 25000) {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		try {
			const r = await fetch(url);
			if (r.ok) return true;
		} catch {
			/* aún no levanta */
		}
		await new Promise((res) => setTimeout(res, 400));
	}
	throw new Error('Vite no levantó a tiempo');
}

async function shot(browser, path, ruta, viewport) {
	const ctx = await browser.newContext({ viewport });
	const p = await ctx.newPage();
	await p.goto(`http://localhost:${PORT}${ruta}`, { waitUntil: 'networkidle' });
	await p.waitForTimeout(700);
	await p.screenshot({ path });
	await ctx.close();
}

try {
	await waitReady(`http://localhost:${PORT}/login`);
	const browser = await chromium.launch();
	const desktop = { width: 1440, height: 900 };

	await shot(browser, 'scripts/shot-login-desktop.png', '/login', desktop);
	await shot(browser, 'scripts/shot-registro-desktop.png', '/registro', desktop);
	await shot(browser, 'scripts/shot-recuperar-desktop.png', '/recuperar', desktop);
	await shot(browser, 'scripts/shot-login-mobile.png', '/login', { width: 390, height: 844 });

	await browser.close();
	console.log('screenshots ok');
} finally {
	vite.kill('SIGKILL');
}
process.exit(0);
