// THROWAWAY WALK SCRIPT (organiser shell V2), NOT in the test:e2e gate list: 390x844 light + dark of each tab, against the
// route-mocked organiser fake. Run (flags at dev-server start): see MANUAL in scripts/check-e2e-spec-coverage.mjs.
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { PHONE, openOrganiser, expectNoHorizontalScroll } from './helpers/organiserFake';

test.use({ viewport: PHONE });
const OUT = 'docs/design/organiser-v1-shell/shots';
mkdirSync(OUT, { recursive: true });
for (const scheme of ['light', 'dark'] as const) {
  test.describe(scheme, () => {
    test.use({ colorScheme: scheme });
    for (const tab of ['events', 'tickets', 'guests', 'raffle']) {
      test(tab, async ({ page }) => {
        await openOrganiser(page, `/account/p3/${tab}`);
        await expect(page.getByTestId('v2-shell')).toBeVisible();
        await page.waitForTimeout(1500);
        await expectNoHorizontalScroll(page);
        const back = await page.getByTestId('v2-back').boundingBox();
        expect(back!.height).toBeGreaterThanOrEqual(44);
        for (const t of await page.locator('.p3-tab').all()) expect((await t.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await page.screenshot({ path: `${OUT}/${tab}-${scheme}.png` });
      });
    }
  });
}
test('switch then refresh keeps the event', async ({ page }) => {
  await openOrganiser(page, '/account/p3/tickets');
  const sel = page.getByTestId('v2-event-switch');
  await expect(sel).toBeVisible();
  const opts = await sel.locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
  console.log('options', opts.length, 'default', await sel.inputValue());
  const pick = opts[opts.length - 1];
  await sel.selectOption(pick);
  await expect(page).toHaveURL(new RegExp(`e=${pick}`));
  await page.reload();
  await expect(page.getByTestId('v2-event-switch')).toHaveValue(pick);
  await page.getByTestId('v2-event-switch').click({ trial: true });
  await page.locator('.p3-tab[data-tab="raffle"]').click();
  await expect(page.getByTestId('v2-event-switch')).toHaveValue(pick);
});
test('45 events, a 53-char name, no coming dates', async ({ page }) => {
  await openOrganiser(page, '/account/p3/guests', {}, (fake) => {
    const org = fake.organisers[0];
    for (let i = 0; i < 45; i++) fake.addSeries(org, { id: `d${String(i).padStart(7, '0')}-0000-4000-8000-000000000001`, name: i === 0 ? 'A very long Bachata Sensual social night name here 53' : `Night series ${i + 1}`, default_start_date: '2026-01-12', recurrence_rule: { mode: 'weekly', weekdays: [1], end: { kind: 'until_date', date: '2026-02-01' } } });
  });
  const sel = page.getByTestId('v2-event-switch');
  await expect(sel).toBeVisible();
  await sel.selectOption('d0000000-0000-4000-8000-000000000001');
  await page.waitForTimeout(800);
  await expectNoHorizontalScroll(page);
  expect((await sel.boundingBox())!.x + (await sel.boundingBox())!.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: `${OUT}/guests-huge-light.png` });
});
