import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { PHONE, openOrganiser, expectNoHorizontalScroll } from './helpers/organiserFake';

// THROWAWAY WALK SCRIPT (P3 W0), NOT in the test:e2e gate list. The P3 shell at 390x844, light
// and dark, against the route-mocked organiser fake (signed in). Needs the flag ON in the server:
//   VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true npx playwright test tests/e2e/walk-p3-w0.spec.ts --project=chromium

test.use({ viewport: PHONE });
const OUT = process.env.P3_WALK_DIR ?? 'docs/handover/p3-w0-walk';
mkdirSync(OUT, { recursive: true });

for (const scheme of ['light', 'dark'] as const) {
  test(`P3 tabs, ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await openOrganiser(page, '/account/p3');
    for (const [tab, label] of [['home', 'Home'], ['events', 'Events'], ['stats', 'Stats'], ['you', 'You']] as const) {
      await page.locator(`.p3-tab[data-tab="${tab}"]`).click();
      await expect(page.getByTestId(`p3-placeholder-${tab}`)).toBeVisible();
      await expect(page.locator('.p3-top h1')).toHaveText(label);
      await expect(page.locator(`.p3-tab[data-tab="${tab}"]`)).toHaveAttribute('aria-current', 'page');
      const sizes = await page.locator('.p3-tab').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.width, r.height]; }));
      for (const [w, h] of sizes) { expect(w).toBeGreaterThanOrEqual(44); expect(h).toBeGreaterThanOrEqual(44); }
      const bar = await page.locator('.p3-tabs').boundingBox();
      expect(bar!.y + bar!.height).toBeLessThanOrEqual(PHONE.height + 0.5);
      // one ground: frame, top bar and page are the same colour
      const grounds = await page.evaluate(() => ['.p3-frame', '.p3-top', '.p3-main'].map((s) => getComputedStyle(document.querySelector(s)!).backgroundColor));
      expect(new Set(grounds).size).toBe(1);
      await expectNoHorizontalScroll(page);
      await page.screenshot({ path: `${OUT}/${tab}-${scheme}.png` });
    }
  });
}
