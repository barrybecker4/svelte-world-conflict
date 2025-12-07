import { readFileSync } from 'fs';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
    plugins: [tailwindcss(), sveltekit()],
    define: {
        '__APP_VERSION__': JSON.stringify(pkg.version)
    },
    build: {
        rollupOptions: {
            external: ['node:async_hooks']
        }
    },
    test: {
        include: ['src/**/*.{test,spec}.{js,ts}'],
        environment: 'node',
        globals: true,
    }
});

