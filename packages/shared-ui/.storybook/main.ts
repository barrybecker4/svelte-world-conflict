import type { StorybookConfig } from '@storybook/svelte-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx|svelte)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-links',
  ],
  framework: {
    name: '@storybook/svelte-vite',
    options: {
      builder: {
        viteConfigPath: undefined,
      },
    },
  },
  docs: {
    autodocs: 'tag',
  },
  async viteFinal(config) {
    // Prevent pre-bundling of @storybook/svelte and ensure proper module resolution
    config.optimizeDeps = {
      ...config.optimizeDeps,
      exclude: [...(config.optimizeDeps?.exclude || []), '@storybook/svelte'],
    };
    
    // Ensure proper module resolution in monorepo
    config.resolve = {
      ...config.resolve,
      dedupe: [...(config.resolve?.dedupe || []), '@storybook/svelte', 'svelte'],
    };
    
    // Allow file system access for monorepo
    config.server = {
      ...config.server,
      fs: {
        ...config.server?.fs,
        allow: ['..', '../..'],
      },
    };
    
    return config;
  },
  typescript: {
    check: false,
  },
};

export default config;

