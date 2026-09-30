import { defineConfig, devices } from '@playwright/test';

// PW_PORT lets several suites run side by side, each against its own server and build.
const PORT = Number(process.env.PW_PORT) || 3210;

/**
 * Desktop and phone are equal targets. The phone project is WebKit on purpose: Safari is
 * where the sandbox iframe, IndexedDB and the service worker are most likely to differ.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    // Suites check the settled page. tests/e2e/motion.spec.ts turns motion back on.
    reducedMotion: 'reduce',
  },
  webServer: {
    command: `pnpm start --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 15'] } },
  ],
});
