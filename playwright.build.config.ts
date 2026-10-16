import { defineConfig, devices } from '@playwright/test';

// The PRODUCTION-BUILD smoke (2026-10-13, PR #747): the phone suite drives the
// DEV server, which serves every module unbundled -- so a bug that exists only in
// the built chunk graph (Rollup's manualChunks, vite.chunks.ts) passes it. #747's
// Vercel preview left /parties on skeletons forever (`TypeError: le is not a
// function` in vendor-ui) and the event schedule on "Loading..." with every CI job
// green. This config serves `npm run build` output the way Vercel does
// (scripts/_serve-build.mjs) with the same no-secret fake Supabase as the phone
// suite, and tests/e2e-build/ fails on any uncaught page error, a page that never
// leaves its loading state, or a route whose content never appears.
//
// The client reads the Supabase origin and the feature flags at BUILD time, so
// build exactly as CI's build-smoke job does (.github/workflows/phone-qa.yml):
//   VITE_SUPABASE_URL=https://phoneqafakenotaproject.supabase.co \
//   VITE_SUPABASE_PUBLISHABLE_KEY=<the placeholder in phone-qa.yml> \
//   VITE_ENABLE_ORGANISER_DETAIL=true VITE_ENABLE_ORGANISERS_DIRECTORY=true \
//   NODE_OPTIONS='--import ./tests/e2e-phone/fakeSupabasePreload.mjs' npm run build
//   npx playwright test --config playwright.build.config.ts
// (FAKE_ORIGIN in tests/e2e-phone/fakeSupabase.mjs is that origin; without the
// organiser flag /organisers/<slug> is a "coming soon" gate and its case fails.)
//
// 2026-10-15 (PR #764): this config now OWNS that build, so local runs and CI
// cannot drift. The workflow's own build step sets neither the self-serve flag
// (the /account/o claim screen is behind it) nor, in the test step, the
// VITE_SUPABASE_URL the specs derive the stored-session key from
// (sb-<ref>-auth-token); every signed-in build spec then bounced to /auth.
// The webServer below rebuilds with FAKE_BUILD_ENV before serving, and the test
// runner's own VITE_SUPABASE_URL is pinned to the same fake origin.
// BUILD_QA_SKIP_BUILD=1 serves the existing build/ as-is (local iteration only).
const PORT = Number(process.env.BUILD_QA_PORT || 4186);

const FAKE_ORIGIN = 'https://phoneqafakenotaproject.supabase.co';
const FAKE_BUILD_ENV = {
  VITE_SUPABASE_URL: FAKE_ORIGIN,
  VITE_SUPABASE_PUBLISHABLE_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIn0.e2e-test-placeholder-not-a-real-key',
  VITE_ENABLE_ORGANISER_DETAIL: 'true',
  VITE_ENABLE_ORGANISERS_DIRECTORY: 'true',
  VITE_ENABLE_ORGANISER_SELF_SERVE: 'true',
};
// Read by the specs (projectRefFromUrl) in this process and its workers. It is
// overridden, not defaulted: a real URL in a developer's shell would key the
// fake session to a project the build does not read.
process.env.VITE_SUPABASE_URL = FAKE_ORIGIN;
const BUILD = process.env.BUILD_QA_SKIP_BUILD === '1' ? '' : 'npm run build && ';

// Playwright starts the server with process.env MERGED UNDER this object, so a
// credential is removed only by overriding it: a developer's shell may hold real
// Supabase keys (even a service-role key, which SSR routes read at runtime).
const BLANKED = Object.fromEntries(
  Object.keys(process.env).filter((k) => /SUPABASE|SERVICE_ROLE/i.test(k)).map((k) => [k, '']),
);

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
    // The preload answers the SSR server's own fetches to the fake origin.
    command: `${BUILD}node --conditions=production --import ./tests/e2e-phone/fakeSupabasePreload.mjs scripts/_serve-build.mjs --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}/auth`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      ...BLANKED,
      ...FAKE_BUILD_ENV,
      NODE_OPTIONS: '--import ./tests/e2e-phone/fakeSupabasePreload.mjs',
      NODE_ENV: 'production',
    },
  },
  projects: [{ name: 'build-390x844' }],
});
