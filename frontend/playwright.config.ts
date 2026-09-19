import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://127.0.0.1:3200',
    trace: 'retain-on-failure',
    launchOptions: {
      executablePath: process.env.E2E_CHROMIUM_PATH,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    },
  },
  webServer: {
    command: 'node dist/server.js',
    url: 'http://127.0.0.1:3200',
    env: { NODE_ENV: 'production', PORT: '3200' },
    reuseExistingServer: false,
  },
});
