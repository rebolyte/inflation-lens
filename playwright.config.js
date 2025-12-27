import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    baseURL: 'http://localhost:3000',
  },
  webServer: {
    command: 'node e2e/fixtures/server.js',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
  timeout: 10000,
  expect: {
    timeout: 3000,
  },
});
