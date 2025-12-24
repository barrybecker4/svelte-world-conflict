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
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
  async viteFinal(config) {
    // Ensure proper module resolution in monorepo
    config.resolve = {
      ...config.resolve,
      dedupe: ['svelte'],
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

