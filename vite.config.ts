import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		// Precompila las rutas al arrancar el server de dev (en vez de compilar
		// cada una la primera vez que la visitas). Así abrir un módulo por primera
		// vez ya no tarda. Solo afecta a dev; en producción no existe compilación.
		warmup: {
			clientFiles: ['./src/routes/**/+page.svelte', './src/routes/**/+layout.svelte'],
			ssrFiles: [
				'./src/routes/**/+page.svelte',
				'./src/routes/**/+layout.svelte',
				'./src/routes/**/+page.server.ts',
				'./src/routes/**/+layout.server.ts'
			]
		}
	},
	ssr: {
		// @lucide/svelte exporta componentes .svelte; en SSR hay que dejar
		// que Vite los transforme en vez de que Node intente cargarlos.
		noExternal: ['@lucide/svelte']
	},
	optimizeDeps: {
		// No pre-empaquetar lucide: cada ícono es un módulo pequeño y, al
		// agregar íconos nuevos, Vite re-optimizaba y soltaba 504 "Outdated
		// Optimize Dep". Excluyéndolo se sirven directos y deja de pasar.
		exclude: ['@lucide/svelte']
	}
});
