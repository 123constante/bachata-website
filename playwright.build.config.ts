import { defineConfig, devices } from '@playwright/test';
import { FAKE_ORIGIN } from './tests/e2e-phone/fakeSupabase.mjs';

// The PRODUCTION-BUILD smoke (2026-10-13, PR #747): the phone suite drives the
// DEV server, which serves every module unbundled -- so a bug that exists only in
// the built chunk graph (Rollup's manualChunks, vite.config.ts) passes it. #747's
// Vercel preview left /parties on skeletons forever (`TypeError: le is not a
// function` in vendor-ui) and the event schedule on "Loading..." with every CI job
// green. This config serves `npm run build` output the way Vercel does
// (scripts/_serve-build.mjs) with the same no-secret fake Supabase as the phone
// suite, and tests/e2e-build/ fails on any uncaught page error or a page that
// never leaves its loading state.
//
// The build MUST be made with the fake origin baked in (the client reads
// VITE_SUPABASE_URL at build time):
//   VITE_SUPABASE_URL=https://phoneqafakenotaproject.supabase.co \
//   VITE_SUPABASE_PUBLISHABLE_KEY=<placeholder> npm run build
//   npx playwright test --config playwright.build.config.ts
// CI: the build-smoke job in .github/workflows/phone-qa.yml.
const PORT = Number(process.env.BUILD_QA_PORT || 4186);

export default defineConfig({
  testDir: './tests/e2e-build',
  outputDir: 'test-results/build-qa',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  retries: 0,
  use: {
    ...devices['Pixel 7'],
    viewport: { width: 390, height: 844 },
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `node --conditions=production --import ./tests/e2e-phone/fakeSupabasePreload.mjs scripts/_serve-build.mjs --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}/auth`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...(Object.fromEntries(Object.entries(process.env).filter(([k]) => !/SUPABASE|SERVICE_ROLE/i.test(k))) as Record<string, string>),
      NODE_ENV: 'production',
      VITE_SUPABASE_URL: FAKE_ORIGIN,
    },
  },
  projects: [{ name: 'build-390x844' }],
});
