import { test, expect } from '@playwright/test';
import { ORG, OrganiserFake, PHONE } from './helpers/organiserFake';

// P3-LANDING (brief p3-landing-r2 item 2; owner decision 1 (c)): with P3 live, the OLD organiser area's URLs
// open the P3 screen that does the same job, and `?legacy=1` keeps the old area (and sticks for the tab) until
// LEGACY_UNTIL (7 Nov 2026, London). 390x844, signed in on the route-mocked organiser fake, a FLOWING clock
// inside the legacy window. Runs in the test:e2e:p3 gate step, where e2e-smoke.yml sets the P3 flags:
//   VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true npx playwright test tests/e2e/p3-landing-redirect.spec.ts --project=chromium
// The unit-level proof (mounted OrganiserRoutes, signed-out ordering, flag OFF) is
// src/modules/organiser/shell/__tests__/p3Redirect.mount.test.tsx.

const P3_ON = process.env.VITE_ENABLE_ORGANISER_P3 === 'true' && process.env.VITE_ENABLE_ORGANISER_SELF_SERVE !== 'false';
const IN_WINDOW = new Date('2026-11-01T18:30:00Z');
const EVENT = 'ev-p3-landing-1';

test.describe('old organiser URLs while P3 is live (390x844)', () => {
  test.use({ viewport: PHONE });
  test.skip(!P3_ON, 'VITE_ENABLE_ORGANISER_P3 is off in this server: /account/p3 is not mounted');

  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: IN_WINDOW });
    await new OrganiserFake().install(page);
  });

  test('/account/o/events/:id lands on /account/p3/events/:id (replace: Back does not bounce)', async ({ page }) => {
    await page.goto('/auth');
    await page.goto(`/account/o/events/${EVENT}?o=${ORG}`);
    await expect(page).toHaveURL(new RegExp(`/account/p3/events/${EVENT}\\?o=${ORG}$`), { timeout: 30_000 });
    // replace: the R1 URL is not left in history, so Back goes to the page before it, not into a redirect loop.
    await page.goBack();
    await expect(page).toHaveURL(/\/auth$/);
  });

  test('/account/o lands on P3 Home', async ({ page }) => {
    await page.goto('/account/o');
    await expect(page).toHaveURL(/\/account\/p3$/, { timeout: 30_000 });
  });

  test('?legacy=1 keeps the old area, and a later old-area link in the same tab stays too', async ({ page }) => {
    await page.goto(`/account/o?legacy=1&o=${ORG}`);
    // The old area renders (stays on /account/o) instead of redirecting.
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/account\/o\?/);
    await expect.poll(() => page.evaluate(() => window.sessionStorage.getItem('organiser.legacyArea'))).toBe('1');
    await page.goto(`/account/o/events?o=${ORG}`);
    await page.waitForLoadState('networkidle');
    expect(new URL(page.url()).pathname).toMatch(/^\/account\/o\/events/);
    // No sideways scroll on the old area at phone width.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
