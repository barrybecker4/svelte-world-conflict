import type { StorybookConfig } from '@storybook/svelte-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx|svelte)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-links',
    '@chromatic-com/storybook',
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
    // Prevent pre-bundling of @storybook/svelte to avoid module loading issues
    config.optimizeDeps = config.optimizeDeps || {};
    config.optimizeDeps.exclude = [...(config.optimizeDeps.exclude || []), '@storybook/svelte'];
    return config;
  },
  typescript: {
    check: false,
  },
};

export default config;

