import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  expect: { timeout: 5000 },
  use: {
    baseURL: 'http://localhost:3003',
    headless: true,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  webServer: {
    command: 'npx next dev --port 3003',
    port: 3003,
    reuseExistingServer: true,
    timeout: 60000,
  },
});
