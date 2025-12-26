import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for testing against deployed production environment.
 * 
 * This config is specifically for running tests against the deployed Cloudflare
 * Pages app instead of a local dev server.
 * 
 * Usage:
 *   npx playwright test --config=playwright.config.production.ts
 * 
 * See: https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Run tests sequentially in local dev for easier debugging/observation */
  workers: 1,  // Always run one at a time (use --workers=N to override)
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [['html', { open: 'always' }]],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.BASE_URL || 'https://svelte-world-conflict.pages.dev',
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    /* Screenshot on failure */
    screenshot: 'only-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* No webServer configuration - tests run against deployed app */
  // The deployed app uses:
  // - App: https://svelte-world-conflict.pages.dev
  // - WebSocket Worker: https://multiplayer-games-websocket.barrybecker4.workers.dev
});
