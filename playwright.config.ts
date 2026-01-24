import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3099',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npx serve tests/fixtures/dist -p 3099',
    url: 'http://localhost:3099',
    reuseExistingServer: !process.env.CI,
  },
});
