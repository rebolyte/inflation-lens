import { defineConfig } from '@playwright/test';

/**
 * Playwright configuration for E2E testing Chrome extensions
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: false, // Run tests sequentially for extensions
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Only 1 worker since we're using persistent context
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  timeout: 60000, // 60 seconds for each test
  expect: {
    timeout: 10000, // 10 seconds for expect assertions
  },
});
