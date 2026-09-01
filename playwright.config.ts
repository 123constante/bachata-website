import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: true,
  // CI-only retries so transient lazy-chunk warmup misses don't fail the gate.
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Generous nav timeout — first lazy chunk on a cold Vite dev server can be
    // slow on the GitHub runner.
    navigationTimeout: 30_000,
    actionTimeout: 15_000,
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    // Probe /auth, NOT '/'. `npm run dev` is react-router dev (real SSR), and '/'
    // 307s to /city/:slug, whose loader deliberately uses fetchQuery (not
    // prefetchQuery) so a bad RPC THROWS -> 500 rather than caching an empty
    // ItemList. Playwright's readiness probe follows redirects and treats a 500 as
    // "not ready", so with the placeholder Supabase key this polled for the full
    // 120s and aborted the run before a single test started. /auth is a
    // client-only route with no server data fetch, so it renders 200 regardless.
    //
    // SCOPE, so nobody "repairs" this back to '/': with a placeholder key every SSR
    // route 500s BY DESIGN, so this suite structurally cannot cover them — and it does
    // not try to. Its specs only visit client-only routes (/auth, /profile), where the
    // page.route() mocks actually apply (mocks patch the BROWSER's network stack and
    // can never intercept a server loader's fetch).
    //
    // A broken SSR root is covered ELSEWHERE, against the real site with real creds:
    //   - prod-smoke.yml           — runs on deployment_status, i.e. after every deploy
    //   - synthetic-ssr-monitor.yml — loads /city/london-gb every 6h
    // That is the right split. Do not add secrets here to "cover" SSR: this workflow
    // also runs on pull_request, and Dependabot PRs get NO repo secrets, so an empty
    // URL would make createClient throw at module init and 500 every route — leaving
    // every Dependabot PR permanently red.
    url: 'http://127.0.0.1:4173/auth',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // The no-JS project. Every other check this repo runs observes the HYDRATED
    // page, which is why 91 of the sitemap's URLs could be soft 404s to Google
    // while browser QA looked perfect: hydration repairs the document a moment
    // after the broken version is painted, and only a client that does not run
    // JavaScript -- i.e. Googlebot -- ever sees the broken one.
    //
    // SEPARATE testDir, NOT the smoke specs. Those specs drive auth steppers and
    // dashboards, which do not function without JavaScript, so pointing this
    // project at them would assert nothing about SSR and fail for unrelated
    // reasons. It also needs REAL Supabase credentials, which the smoke suite
    // deliberately does not have (see the webServer note above: with a
    // placeholder key every SSR route 500s by design, and the smoke specs only
    // visit client-only routes). That is why this project is NOT in the default
    // `test:e2e` run and is not wired into e2e-smoke.yml -- run it locally, with
    // .env present, via `npm run test:e2e:nojs`.
    {
      name: 'nojs',
      testDir: './tests/e2e-nojs',
      use: { ...devices['Desktop Chrome'], javaScriptEnabled: false },
    },
  ],
});
