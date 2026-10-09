import { defineConfig, devices } from '@playwright/test';
// @ts-expect-error -- plain .mjs CI substrate, no type declarations by design.
import { bypassHeaders } from './scripts/lib/previewProbe.mjs';

// Live QA suite (tests/e2e/live) -- READ-ONLY against the LIVE site, at phone
// width. Kept out of playwright.config.ts on purpose: that config's testDir is
// tests/e2e and its gate (`test:e2e`) is an explicit spec list, and its
// chromium project ignores live/** so `test:e2e:all` never drives prod.
//
//   Layer 1  shape-matrix.spec.ts   real event shapes from a read-only prod
//                                   survey x every public screen
//   Layer 3  every page visit       console/hydration errors, axe serious+
//                                   critical, horizontal overflow, 44px tap
//                                   targets, plus screenshots as artifacts
//   Canary   detectors.spec.ts      proves each detector above can fail
//
// Layer 2 (signed-in organiser journeys) is NOT here: no credentials for the
// test account exist in CI or in the authoring session (see the PR body).
// Scheduled by .github/workflows/live-qa.yml (daily). Locally:
//   SUPABASE_ACCESS_TOKEN=... npm run test:e2e:live
//   LIVE_QA_BASE_URL=http://127.0.0.1:4174 npm run test:e2e:live   (a local build)
const BASE_URL = process.env.LIVE_QA_BASE_URL || 'https://www.bachatacalendar.co.uk';
const extraHTTPHeaders = bypassHeaders({ required: false }) ?? undefined;

export default defineConfig({
  testDir: './tests/e2e/live',
  globalSetup: './tests/e2e/live/global-setup.ts',
  globalTeardown: './tests/e2e/live/global-teardown.ts',
  timeout: 240_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: process.env.CI ? 3 : 4,
  // No retries: a flaky finding is still a finding, and a retry would hide a
  // hydration error that only fires on a cold cache.
  retries: 0,
  reporter: process.env.CI
    ? [['github'], ['list'], ['html', { open: 'never', outputFolder: 'playwright-report-live' }]]
    : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-live' }]],
  use: {
    baseURL: BASE_URL,
    extraHTTPHeaders,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    navigationTimeout: 45_000,
    actionTimeout: 15_000,
    timezoneId: 'Europe/London',
    locale: 'en-GB',
  },
  projects: [
    {
      name: 'mobile-390',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        // 'bot' in the UA makes the server-side view recorders skip the visit
        // (same convention as scripts/launch-critical-smoke.mjs).
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 '
          + '(KHTML, like Gecko) Mobile/15E148 bachatacalendar-live-qa-bot/1.0',
      },
    },
  ],
});
