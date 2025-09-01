import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [tailwindcss(), sveltekit()],
    build: {
        rollupOptions: {
            external: ['node:async_hooks']
        }
    },
    test: {
        include: ['src/**/*.{test,spec}.{js,ts}'],
        environment: 'node',
        globals: true, // Enable global test functions like describe, it, expect
    }
});
