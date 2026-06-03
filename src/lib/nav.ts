import type { Component } from 'svelte';
import Wallet from '@lucide/svelte/icons/wallet';
import Receipt from '@lucide/svelte/icons/receipt';
import HandCoins from '@lucide/svelte/icons/hand-coins';
import Repeat from '@lucide/svelte/icons/repeat';
import Scale from '@lucide/svelte/icons/scale';
import ChartColumn from '@lucide/svelte/icons/chart-column';
import House from '@lucide/svelte/icons/house';
import Settings from '@lucide/svelte/icons/settings';

export type NavTab = { href: string; label: string; icon: Component };

export const navTabs: NavTab[] = [
	{ href: '/', label: 'Inicio', icon: Wallet },
	{ href: '/gastos', label: 'Gastos', icon: Receipt },
	{ href: '/prestamos', label: 'Préstamos', icon: HandCoins },
	{ href: '/fijos', label: 'Fijos', icon: Repeat },
	{ href: '/saldar', label: 'Saldar', icon: Scale },
	{ href: '/resumen', label: 'Resumen', icon: ChartColumn },
	{ href: '/hogar', label: 'Hogar', icon: House },
	{ href: '/ajustes', label: 'Ajustes', icon: Settings }
];

// Rutas "hijas" que no aparecen en el sidebar pero pertenecen a un módulo
// principal. Cuando el usuario está en una de estas, queremos que el item de
// nav del módulo padre quede resaltado (ej.: /categorias resalta "Gastos").
const SUBRUTAS_DE: Record<string, string> = {
	'/categorias': '/gastos'
};

export function navActivo(pathname: string, href: string): boolean {
	if (href === '/') return pathname === '/';
	// Sub-ruta declarada → cuenta como su padre.
	for (const [sub, padre] of Object.entries(SUBRUTAS_DE)) {
		if ((pathname === sub || pathname.startsWith(sub + '/')) && href === padre) return true;
	}
	return pathname.startsWith(href);
}
