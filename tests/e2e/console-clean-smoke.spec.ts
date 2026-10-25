import { expect, test } from '@playwright/test';

/**
 * Console-clean smoke. Loads a few routes and fails on ANY uncaught page error
 * or console.error that is not on the allowlist below.
 *
 * Why it exists: the #746 preview was reported to log `TypeError: le is not a
 * function` (vendor-ui-modal -> vendor-ui) on every page and no automated check
 * noticed, because every existing spec asserts on DOM, not on the console.
 *
 * Point it at a PRODUCTION build (minified chunks are where that class of bug
 * lives) with a deployed preview or a local `react-router build` + server:
 *   PLAYWRIGHT_BASE_URL=https://<preview> npx playwright test tests/e2e/console-clean-smoke.spec.ts --project=chromium
 * Against the default dev server it still catches thrown errors, just not
 * minification-only ones. NOT in `test:e2e` (explicit spec list) on purpose.
 *
 * Allowlist (keep it short; every entry needs a reason):
 *  - vercel.live: the Vercel preview toolbar is blocked by our CSP and logs a
 *    CSP violation; it is not our code.
 *  - "Failed to load resource": a network status line (404 icon, placeholder
 *    Supabase key in CI). Chrome logs it as console.error but it is not a
 *    script error; real script failures arrive as pageerror and stay covered.
 */
const ALLOWED = [/vercel\.live/i, /^Failed to load resource/i];

// Optional override so the same spec can drive a deployed preview.
if (process.env.PLAYWRIGHT_BASE_URL) test.use({ baseURL: process.env.PLAYWRIGHT_BASE_URL });

const ROUTES = ['/auth', '/faq', '/parties', '/classes'];

for (const route of ROUTES) {
  test(`no uncaught errors or console.error on ${route}`, async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const text = m.text();
      if (ALLOWED.some((re) => re.test(text))) return;
      problems.push(`console.error: ${text.slice(0, 300)}`);
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    expect(problems, problems.join('\n')).toEqual([]);
  });
}
