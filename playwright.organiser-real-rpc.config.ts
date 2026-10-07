import { defineConfig, devices } from '@playwright/test';

// The organiser editor against the REAL E2E Supabase project (no mocks): see the header of
// tests/e2e/organiser-real-rpc.spec.ts. NOT part of `npm run test:e2e` / e2e-smoke.yml: it needs
// E2E credentials and writes to the E2E database. Run: npm run test:e2e:organiser-real-rpc.
//
// The spec reads this marker and skips itself under any other config (test:e2e:all collects
// tests/e2e too, with a placeholder key and no organiser login).
process.env.ORGANISER_REAL_RPC_CONFIG = '1';

const PORT = Number(process.env.ORGANISER_REAL_RPC_PORT || 4191);

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /organiser-real-rpc\.spec\.ts$/,
  outputDir: 'test-results/organiser-real-rpc-artifacts',
  timeout: 180_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    navigationTimeout: 60_000,
    actionTimeout: 20_000,
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}/auth`,
    // Never reuse: a server started with other env (prod keys, flag off) must not be driven.
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      ...(process.env as Record<string, string>),
      VITE_SUPABASE_URL: process.env.E2E_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
      VITE_SUPABASE_PUBLISHABLE_KEY: process.env.E2E_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
      VITE_ENABLE_ORGANISER_SELF_SERVE: 'true',
    },
  },
  projects: [
    {
      name: 'chromium-390',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        // A pinned Chromium (e.g. a cloud image whose browsers predate this Playwright version).
        ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } } : {}),
      },
    },
  ],
});
