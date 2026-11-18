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

test('night', async ({ page }) => {
  await openOrganiser(page, '/account/p3/events');
  await expect(page.getByTestId('r4-events')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('r4-event-row').first().click();
  await expect(page.getByTestId('r4-night')).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1500);
  await expectNoHorizontalScroll(page);
  await expect(page.locator('.r4-tab[data-tab="events"]')).toHaveAttribute('aria-current', 'page');
  expect((await page.getByTestId('r4-night-back').boundingBox())!.height).toBeGreaterThanOrEqual(44);
  for (const id of ['r4-night-share', 'r4-night-cancel']) {
    const b = await page.getByTestId(id).boundingBox();
    expect(b!.height).toBeGreaterThanOrEqual(48);
  }
  for (const r of await page.locator('[data-testid="r4-night-rows"] .r4-row').all()) expect((await r.boundingBox())!.height).toBeGreaterThanOrEqual(52);
  await page.screenshot({ path: `${OUT}/night.png`, fullPage: true });
  if (await page.getByTestId('r4-night-cancel').isEnabled()) {
    await page.getByTestId('r4-night-cancel').click();
    await expect(page.getByTestId('r4-cancel-reasons')).toBeVisible();
    await page.screenshot({ path: `${OUT}/night-cancel.png` });
  } else {
    // a control that cannot work says why
    await expect(page.getByTestId('r4-night-cancel-why')).toBeVisible();
    console.log('cancel off:', await page.getByTestId('r4-night-cancel-why').textContent());
  }
});

// cont3: the three boards R4EditNight, R4Raffle, R4Cancel. Screens land next to the night shots for the board compare.
const ONE_OFF = 'a0000000-0000-4000-8000-0000000000aa';

test('edit night', async ({ page }) => {
  await openOrganiser(page, '/account/p3/events');
  await page.getByTestId('r4-event-row').first().click();
  await page.getByTestId('r4-night-edit').click();
  await expect(page.getByTestId('r4-edit')).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1500);
  await expectNoHorizontalScroll(page);
  for (const id of ['r4-edit-name', 'r4-edit-date', 'r4-edit-starts', 'r4-edit-place']) expect((await page.getByTestId(id).boundingBox())!.height).toBeGreaterThanOrEqual(42);
  expect((await page.getByTestId('r4-edit-repeat').boundingBox())!.height).toBeGreaterThanOrEqual(52);
  // untouched: Save is off and sends nothing
  await expect(page.getByTestId('r4-edit-save')).toBeDisabled();
  await page.screenshot({ path: `${OUT}/edit-night.png` });
  // the save bar sits above the tabs, never under them
  const bar = (await page.getByTestId('r4-edit-savebar').boundingBox())!;
  expect(bar.y + bar.height).toBeLessThanOrEqual(844 - 64 + 1);
  await page.getByTestId('r4-edit-name').fill('Friday Bachata Social');
  await expect(page.getByTestId('r4-edit-save')).toBeEnabled();
});

test('raffle', async ({ page }) => {
  // With ORGANISER_RAFFLE_LIVE on, the read is mocked in the board's shape (locked, 23 entered): admin #1576 is not on prod.
  await openOrganiser(page, '/account/p3/events');
  await page.route('**/rest/v1/rpc/organiser_raffle_nights_v1', (route) => route.fulfill({ json: {
    ok: true, series_id: 'x', can_edit: true, view_only_reason: null,
    nights: [{ occurrence_id: 'o1', date: '2026-10-09', start_local: '2026-10-09T21:00:00', chip: 'locked', raffle_on: true, entries_count: 23, locked: true, winner: null, can_set: false, refuse_reason: null }],
  } }));
  await page.getByTestId('r4-event-row').first().click();
  await expect(page.getByTestId('r4-night')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('raffle-row').or(page.getByTestId('raffle-soon'))).toBeVisible({ timeout: 20_000 });
  if (await page.getByTestId('raffle-soon').count()) {
    await page.goto(page.url() + '/raffle');
    await expect(page.getByTestId('r4-raffle')).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: `${OUT}/raffle-soon.png` });
    return;
  }
  await page.getByTestId('raffle-row').click();
  await expect(page.getByTestId('r4-raffle-track')).toBeVisible({ timeout: 20_000 });
  await expectNoHorizontalScroll(page);
  await expect(page.getByTestId('r4-raffle-pick')).toBeDisabled();
  await expect(page.getByTestId('r4-raffle-pick-why')).toHaveText('Available when doors close.');
  await expect(page.getByTestId('r4-raffle-locked')).toContainText('Locked: 23 people have entered');
  await page.screenshot({ path: `${OUT}/raffle.png` });
});

test('cancel a one-off night', async ({ page }) => {
  await openOrganiser(page, '/account/p3/events', {}, (fake) => {
    fake.addSeries(fake.organisers[0], { id: ONE_OFF, name: 'Halloween Social', format: 'one_off', category: 'party', default_start_date: '2026-10-31' });
  });
  await expect(page.getByTestId('r4-events')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('r4-event-row').filter({ hasText: 'Halloween Social' }).click();
  await expect(page.getByTestId('r4-night-cancel')).toBeEnabled({ timeout: 20_000 });
  await page.getByTestId('r4-night-cancel').click();
  await expect(page.getByTestId('r4-cancel-reasons')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('r4-cancel-go')).toBeDisabled();
  await expect(page.getByTestId('r4-cancel-help')).toHaveText('Pick a reason first.');
  for (const b of await page.locator('[data-testid="r4-cancel-reasons"] .r4-chip').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(34);
  await page.screenshot({ path: `${OUT}/cancel.png` });
  await page.locator('[data-testid="r4-cancel-reasons"] .r4-chip').first().click();
  await expect(page.getByTestId('r4-cancel-go')).toBeEnabled();
});
