import { chromium } from 'playwright';

const browser = await chromium.launch();

async function medir(page) {
	return page.evaluate(() => {
		const q = (s) => {
			const el = document.querySelector(s);
			if (!el) return null;
			const r = el.getBoundingClientRect();
			return {
				w: Math.round(r.width),
				h: Math.round(r.height),
				x: Math.round(r.x),
				y: Math.round(r.y)
			};
		};
		return {
			win: { w: window.innerWidth, h: window.innerHeight },
			main: q('.app-main'),
			content: q('.app-content')
		};
	});
}

// Desktop
const ctxD = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const pageD = await ctxD.newPage();
await pageD.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
console.log('DESKTOP', JSON.stringify(await medir(pageD)));
await pageD.screenshot({ path: 'scripts/shot-desktop.png' });

// Móvil (cerrado)
const ctxM = await browser.newContext({ viewport: { width: 390, height: 844 } });
const pageM = await ctxM.newPage();
await pageM.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
console.log('MOBILE', JSON.stringify(await medir(pageM)));
await pageM.screenshot({ path: 'scripts/shot-mobile.png' });

// Móvil (drawer abierto)
await pageM.click('button[aria-label="Abrir menú"]');
await pageM.waitForTimeout(300);
await pageM.screenshot({ path: 'scripts/shot-mobile-drawer.png' });

await browser.close();
console.log('screenshots ok');
