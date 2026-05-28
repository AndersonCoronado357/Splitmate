import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	ssr: {
		// @lucide/svelte exporta componentes .svelte; en SSR hay que dejar
		// que Vite los transforme en vez de que Node intente cargarlos.
		noExternal: ['@lucide/svelte']
	}
});
