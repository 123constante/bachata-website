import { defineConfig, devices } from '@playwright/test';
import { FAKE_ORIGIN } from './tests/e2e-phone/fakeSupabase.mjs';

// The PHONE suite: layout, colour contrast and overlap checks at 390x844 and
// 360x640, on the FRAMEWORK (SSR) routes too -- which the smoke suite cannot reach
// (playwright.config.ts webServer note: with a placeholder key every SSR loader
// 500s, and page.route() cannot mock a server loader's fetch).
//
// How it renders them WITHOUT any secret: the dev server this config starts gets
// NODE_OPTIONS=--import tests/e2e-phone/fakeSupabasePreload.mjs, which answers every
// Node-side fetch to the Supabase origin from tests/e2e-phone/fakeSupabase.mjs, and
// the specs answer the browser side from the SAME module via page.route(). Nothing
// reaches any Supabase project; every write is refused.
//
// CI: .github/workflows/phone-qa.yml, on PRs that touch UI paths. Local:
//   npx playwright test --config playwright.phone.config.ts
//
// Own port, never reused: a dev server started with other env (real keys, no
// preload) must not be driven by this suite.
const PORT = Number(process.env.PHONE_QA_PORT || 4185);

// Chromium with a phone's traits. Chromium cannot emulate a safe-area inset, so
// env(safe-area-inset-bottom) is 0 here.
const phone = (width: number, height: number) => ({
  ...devices['Pixel 7'],
  viewport: { width, height },
  isMobile: true,
  hasTouch: true,
});

export default defineConfig({
  testDir: './tests/e2e-phone',
  // Loads every route until the dev server's dependency optimiser has settled;
  // see the file for the cold-cache failure it prevents.
  globalSetup: './tests/e2e-phone/warmup.ts',
  outputDir: 'test-results/phone-qa',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  // CI-only retries, as playwright.config.ts: cold lazy-chunk warmup only.
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    navigationTimeout: 45_000,
    actionTimeout: 15_000,
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${PORT}`,
    // /auth: client-only, renders without any data (see playwright.config.ts).
    url: `http://127.0.0.1:${PORT}/auth`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      // Everything but credentials: a developer's shell may hold real Supabase
      // keys (even a service-role key), and this server must never be able to use them.
      ...(Object.fromEntries(Object.entries(process.env).filter(([k]) => !/SUPABASE|SERVICE_ROLE/i.test(k))) as Record<string, string>),
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import ./tests/e2e-phone/fakeSupabasePreload.mjs`.trim(),
      VITE_SUPABASE_URL: FAKE_ORIGIN,
      VITE_SUPABASE_PUBLISHABLE_KEY:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIn0.e2e-test-placeholder-not-a-real-key',
      VITE_ENABLE_ORGANISER_DETAIL: 'true',
      VITE_ENABLE_ORGANISERS_DIRECTORY: 'true',
      VITE_ENABLE_ORGANISER_SELF_SERVE: 'true',
      // /teachers (live on prod; this flag gates only that route): the nationality-flag spec walks it.
      VITE_ENABLE_TEACHERS_DIRECTORY: 'true',
    },
  },
  projects: [
    { name: 'phone-390x844', use: phone(390, 844) },
    { name: 'phone-360x640', use: phone(360, 640) },
  ],
});
