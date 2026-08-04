import { defineConfig, devices } from '@playwright/test';
// @ts-expect-error -- plain .mjs CI substrate, no type declarations by design.
import { bypassHeaders } from './scripts/lib/previewProbe.mjs';

// Synthetic monitor config — runs against the LIVE production site (read-only
// GETs), NOT a local dev server. Emulates the exact conditions that first
// surfaced the /city/london-gb failures: a crawler User-Agent and a NON-London
// browser timezone (UTC), which is what produced the client-side
// "RangeError: Invalid time value" and the hydration cascade. Kept separate
// from playwright.config.ts so the normal e2e gate (local, London default) is
// untouched.
const BASE_URL = process.env.SYNTHETIC_BASE_URL || 'https://www.bachatacalendar.co.uk';

// Preview PR coverage: when pointed at a protected Vercel preview, attach the
// protection-bypass header to EVERY request (document + subresources) so the
// synthetic monitor can load it; undefined against public prod (default).
//
// Shares the ONE bypassHeaders() definition rather than hand-rolling the headers.
// This was the last site still sending `x-vercel-set-bypass-cookie: 'true'` — the
// header PR #135 proved harmful: paired with a cookie-jar-less client (undici
// fetch), Vercel answers a cookie-setting redirect that is re-sent every hop until
// "redirect count exceeded", which is what made three CI checks look permanently
// walled with a perfectly VALID secret. It never broke Playwright (a browser
// context HAS a cookie jar), but it was the copy-paste source that would reinfect
// the next fetch/curl check, and it skipped bypassHeaders' .trim() (a pasted
// trailing newline makes the header get rejected before any I/O).
// required:false so a local run against public prod works without the secret.
const extraHTTPHeaders = bypassHeaders({ required: false }) ?? undefined;

export default defineConfig({
  testDir: './tests/synthetic',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: BASE_URL,
    extraHTTPHeaders,
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
