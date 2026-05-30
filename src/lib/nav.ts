import type { Component } from 'svelte';
import Wallet from '@lucide/svelte/icons/wallet';
import Receipt from '@lucide/svelte/icons/receipt';
import HandCoins from '@lucide/svelte/icons/hand-coins';
import Repeat from '@lucide/svelte/icons/repeat';
import House from '@lucide/svelte/icons/house';
import Settings from '@lucide/svelte/icons/settings';

export type NavTab = { href: string; label: string; icon: Component };

export const navTabs: NavTab[] = [
	{ href: '/', label: 'Inicio', icon: Wallet },
	{ href: '/gastos', label: 'Gastos', icon: Receipt },
	{ href: '/prestamos', label: 'Préstamos', icon: HandCoins },
	{ href: '/fijos', label: 'Fijos', icon: Repeat },
	{ href: '/hogar', label: 'Hogar', icon: House },
	{ href: '/ajustes', label: 'Ajustes', icon: Settings }
];

export function navActivo(pathname: string, href: string): boolean {
	if (href === '/') return pathname === '/';
	return pathname.startsWith(href);
}
