import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
    plugins: [tailwindcss(), sveltekit()],
    define: {
        '__APP_VERSION__': JSON.stringify(pkg.version)
    },
    resolve: {
        alias: {
            'multiplayer-framework/shared': resolve(__dirname, '../multiplayer-framework/dist/shared/index.js'),
            'multiplayer-framework/client': resolve(__dirname, '../multiplayer-framework/dist/client/index.js'),
            'multiplayer-framework/server': resolve(__dirname, '../multiplayer-framework/dist/server/index.js'),
            'multiplayer-framework/worker': resolve(__dirname, '../multiplayer-framework/dist/worker/index.js'),
            'shared-ui': resolve(__dirname, '../shared-ui/src/index.ts'),
        }
    },
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
