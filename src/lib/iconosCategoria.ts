import type { Component } from 'svelte';
import ShoppingCart from '@lucide/svelte/icons/shopping-cart';
import Bike from '@lucide/svelte/icons/bike';
import Utensils from '@lucide/svelte/icons/utensils';
import Car from '@lucide/svelte/icons/car';
import House from '@lucide/svelte/icons/house';
import HeartPulse from '@lucide/svelte/icons/heart-pulse';
import Tag from '@lucide/svelte/icons/tag';
import Gift from '@lucide/svelte/icons/gift';
import Coffee from '@lucide/svelte/icons/coffee';
import Plane from '@lucide/svelte/icons/plane';
import PiggyBank from '@lucide/svelte/icons/piggy-bank';
import Dumbbell from '@lucide/svelte/icons/dumbbell';
import Music from '@lucide/svelte/icons/music';
import Baby from '@lucide/svelte/icons/baby';
import Popcorn from '@lucide/svelte/icons/popcorn';
import PawPrint from '@lucide/svelte/icons/paw-print';
import Sparkles from '@lucide/svelte/icons/sparkles';
import Wallet from '@lucide/svelte/icons/wallet';
import Wrench from '@lucide/svelte/icons/wrench';
import GraduationCap from '@lucide/svelte/icons/graduation-cap';

// Catálogo de íconos elegibles para una categoría. El value es el slug lucide
// (lo que se guarda en la BD); el Componente es el lucide-svelte ya importado.
export const ICONOS_DISPONIBLES: Array<{ value: string; Icono: Component }> = [
	{ value: 'shopping-cart', Icono: ShoppingCart },
	{ value: 'bike', Icono: Bike },
	{ value: 'utensils', Icono: Utensils },
	{ value: 'car', Icono: Car },
	{ value: 'house', Icono: House },
	{ value: 'heart-pulse', Icono: HeartPulse },
	{ value: 'coffee', Icono: Coffee },
	{ value: 'plane', Icono: Plane },
	{ value: 'gift', Icono: Gift },
	{ value: 'piggy-bank', Icono: PiggyBank },
	{ value: 'wallet', Icono: Wallet },
	{ value: 'dumbbell', Icono: Dumbbell },
	{ value: 'music', Icono: Music },
	{ value: 'popcorn', Icono: Popcorn },
	{ value: 'baby', Icono: Baby },
	{ value: 'paw-print', Icono: PawPrint },
	{ value: 'graduation-cap', Icono: GraduationCap },
	{ value: 'wrench', Icono: Wrench },
	{ value: 'sparkles', Icono: Sparkles },
	{ value: 'tag', Icono: Tag }
];

const MAPA: Record<string, Component> = Object.fromEntries(
	ICONOS_DISPONIBLES.map((i) => [i.value, i.Icono])
);

export function iconoCategoria(nombre: string | null | undefined): Component {
	if (!nombre) return Tag;
	return MAPA[nombre] ?? Tag;
}
