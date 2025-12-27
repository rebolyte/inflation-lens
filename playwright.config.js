import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
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
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
});
