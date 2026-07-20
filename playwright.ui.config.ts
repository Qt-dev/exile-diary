import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4173/test/ui/';

export default defineConfig({
  testDir: './test/ui/specs',
  outputDir: '.tmp/ui-test-results',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: [['list'], ['html', { outputFolder: '.tmp/ui-playwright-report', open: 'never' }]],
  use: {
    baseURL,
    colorScheme: 'dark',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testMatch: '**/smoke.spec.ts',
      use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'capture',
      testMatch: '**/capture.spec.ts',
      use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } },
    },
  ],
});
