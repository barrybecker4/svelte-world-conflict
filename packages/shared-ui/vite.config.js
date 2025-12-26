import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    svelte({
      // Use dynamicCompileOptions to conditionally enable runes mode
      // This allows @storybook/svelte components (Svelte 4) to work alongside our Svelte 5 components
      dynamicCompileOptions({ filename }) {
        // Only enable runes for our own components, not node_modules
        if (filename.includes('node_modules')) {
          return { runes: false };
        }
        return { runes: true };
      },
    }),
  ],
});
