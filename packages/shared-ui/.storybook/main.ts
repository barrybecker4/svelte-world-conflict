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
    
    // Fix for Vite 6 compatibility with Storybook virtual modules and HMR
    // Exclude Storybook's builder from optimization to prevent import analysis errors
    config.optimizeDeps = {
      ...config.optimizeDeps,
      exclude: ['@storybook/builder-vite'],
    };
    
    // Configure build to handle virtual modules in HMR
    // This helps Vite properly process Storybook's virtual module paths
    config.build = {
      ...config.build,
      commonjsOptions: {
        ...config.build?.commonjsOptions,
        include: [/node_modules/],
      },
    };
    
    return config;
  },
  typescript: {
    check: false,
  },
};

export default config;
