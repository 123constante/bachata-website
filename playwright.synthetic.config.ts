import { defineConfig, devices } from '@playwright/test';

// Synthetic monitor config — runs against the LIVE production site (read-only
// GETs), NOT a local dev server. Emulates the exact conditions that first
// surfaced the /city/london-gb failures: a crawler User-Agent and a NON-London
// browser timezone (UTC), which is what produced the client-side
// "RangeError: Invalid time value" and the hydration cascade. Kept separate
// from playwright.config.ts so the normal e2e gate (local, London default) is
// untouched.
const BASE_URL = process.env.SYNTHETIC_BASE_URL || 'https://www.bachatacalendar.co.uk';

export default defineConfig({
  testDir: './tests/synthetic',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    navigationTimeout: 30_000,
    // The conditions under which the bugs first appeared.
    timezoneId: 'UTC',
    userAgent:
      'Mozilla/5.0 (compatible; BachataSyntheticMonitor/1.0; +https://www.bachatacalendar.co.uk) Googlebot/2.1',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
