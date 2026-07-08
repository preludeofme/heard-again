import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E test configuration.
 *
 * The suite runs against an already-running app instance (dev or prod build).
 * Start the stack first (`npm run dev`), then run `npm run test:e2e`.
 * Override the target with PLAYWRIGHT_BASE_URL.
 *
 * Projects:
 *   - desktop-chromium: the full suite at a desktop viewport
 *   - mobile-chromium:  the highest-value flows, tagged @mobile, at a phone viewport
 *
 * See e2e/README.md for the full run/debug/cleanup guide.
 */
export default defineConfig({
  testDir: './e2e',
  // Legacy specs superseded by the maintained suite (see e2e/README.md).
  // They target removed routes and a pre-seeded demo user. Safe to delete.
  testIgnore: ['**/full-suite.spec.ts', '**/screenshots.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // One local retry absorbs dev-server load hiccups (the dev Next server
  // compiles lazily and serves every worker); CI gets the usual two.
  retries: process.env.CI ? 2 : 1,
  // The dev server compiles routes lazily and renders on one core; higher
  // parallelism makes first hits flaky-slow. Two workers is the sweet spot.
  workers: process.env.CI ? 1 : 2,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 120_000,
  expect: { timeout: 15_000 },
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://localhost:4777',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    ignoreHTTPSErrors: true,
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
      // @mobile-only tests exercise mobile-specific UI (bottom nav etc.)
      grepInvert: /@mobile-only/,
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
      // Mobile runs only the flows explicitly tagged as mobile-relevant.
      grep: /@mobile/,
    },
  ],
})
