// THROWAWAY WALK SCRIPT (organiser Round 4), NOT in the test:e2e gate list: 390x844 of each R4 tab and Home, against the
// route-mocked organiser fake. Run (flags at dev-server start): see MANUAL in scripts/check-e2e-spec-coverage.mjs.
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { PHONE, openOrganiser, expectNoHorizontalScroll } from './helpers/organiserFake';

test.use({ viewport: PHONE, colorScheme: 'dark' });
const OUT = 'docs/design/organiser-round4/shots';
mkdirSync(OUT, { recursive: true });
for (const [tab, path] of [['home', '/account/p3'], ['events', '/account/p3/events'], ['tickets', '/account/p3/tickets'], ['team', '/account/p3/you/team']] as const) {
  test(tab, async ({ page }) => {
    await openOrganiser(page, path);
    await expect(page.getByTestId('r4-shell')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1500);
    await expectNoHorizontalScroll(page);
    // white even when the phone is in dark mode
    expect(await page.getByTestId('r4-shell').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(253, 253, 253)');
    const back = await page.getByTestId('r4-back').boundingBox();
    expect(back!.height).toBeGreaterThanOrEqual(44);
    await expect(page.getByTestId('r4-back')).toHaveText('Back to bachatacalendar.co.uk');
    for (const t of await page.locator('.r4-tab').all()) expect((await t.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    await expect(page.locator(`.r4-tab[data-tab="${tab}"]`)).toHaveAttribute('aria-current', 'page');
    if (tab === 'home') {
      await expect(page.getByTestId('r4-home')).toBeVisible();
      const btn = await page.getByTestId('r4-home-primary').boundingBox();
      expect(btn!.height).toBeGreaterThanOrEqual(48);
      expect(btn!.width).toBeGreaterThan(PHONE.width - 40);
    }
    if (tab === 'events') {
      await expect(page.getByTestId('r4-events')).toBeVisible();
      expect((await page.getByTestId('r4-events-add').boundingBox())!.height).toBeGreaterThanOrEqual(48);
      for (const r of await page.getByTestId('r4-event-row').all()) expect((await r.boundingBox())!.height).toBeGreaterThanOrEqual(52);
      const past = page.getByTestId('r4-events-past-toggle');
      if (await past.count()) { await past.click(); await expect(page.getByTestId('r4-events-past')).toBeVisible(); await expectNoHorizontalScroll(page); }
    }
    await page.screenshot({ path: `${OUT}/${tab}.png` });
  });
}
