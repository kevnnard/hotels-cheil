import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env['BASE_URL'] ?? 'http://127.0.0.1:4200';
const credentialedSpec = /admin\.spec\.ts$/;
const phoneOnlyTag = /@mobile/;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: { mode: 'only-on-failure', fullPage: true },
  },
  projects: [
    {
      name: 'desktop',
      grepInvert: phoneOnlyTag,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'tablet',
      testIgnore: credentialedSpec,
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'mobile-360',
      testIgnore: credentialedSpec,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 360, height: 740 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'mobile-390',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: 'pnpm start --host 127.0.0.1',
    url: baseURL,
    reuseExistingServer: !process.env['CI'],
  },
});
