// THROWAWAY WALK SCRIPT (organiser shell V2), NOT in the test:e2e gate list: 390x844 light + dark of each tab, against the
// route-mocked organiser fake. Run (flags at dev-server start): see MANUAL in scripts/check-e2e-spec-coverage.mjs.
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { PHONE, OrganiserFake, openOrganiser, expectNoHorizontalScroll, json } from './helpers/organiserFake';

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

// V3: Guest list + Raffle with a live night, the raffle confirm sheet, a contributor seat. Needs VITE_ENABLE_ORGANISER_GUEST_LIST_LIVE
// and VITE_ENABLE_ORGANISER_RAFFLE_LIVE too. The two raffle/guest RPCs are answered here; organiser_raffle_night_set_v1 is NEVER sent (it fails the walk).
const DAYS = Array.from({ length: 60 }, (_, i) => new Date(Date.UTC(2026, 9, 8 + i)).toISOString().slice(0, 10));
async function openLive(page: Page, path: string, seat: 'owner' | 'contributor') {
  const fake = new OrganiserFake({});
  await fake.install(page); // routes added after the fake's win
  const sent = await mockLive(page, seat);
  await page.goto(path);
  return sent;
}
async function mockLive(page: Page, seat: 'owner' | 'contributor') {
  let setCalled = false;
  await page.route('**/rest/v1/rpc/organiser_raffle_night_set_v1*', (route) => { setCalled = true; return json(route, { ok: false, reason: 'not_authorised' }); });
  await page.route('**/rest/v1/rpc/organiser_raffle_nights_v1*', (route) => json(route, {
    ok: true, series_id: 's', can_edit: seat === 'owner', view_only_reason: seat === 'owner' ? null : 'ask an owner',
    nights: DAYS.map((date) => ({ occurrence_id: `o-${date}`, date, start_local: '20:00', chip: 'closed', raffle_on: false, entries_count: 0, locked: false, winner: null, can_set: seat === 'owner', refuse_reason: seat === 'owner' ? null : 'view_only' })),
  }));
  await page.route('**/rest/v1/rpc/organiser_guest_list_night_v1*', (route) => json(route, {
    ok: true, role: seat, can_edit: seat === 'owner', can_check_in: true, read_only_reason: null,
    night: { occurrence_id: 'o', enabled: true, capacity_max: 80, cutoff_time: null, closed: false, full: false, past: false, cancelled: false },
    counts: { names: 3, in: 1, places_left: 77 }, total: 3,
    entries: [{ id: 'e1', first_name: 'Ana', status: 'confirmed', is_permanent: false, added_via: 'organiser', checked_in_at: null }, { id: 'e2', first_name: 'Ben', status: 'confirmed', is_permanent: true, added_via: 'organiser', checked_in_at: '2026-10-08T10:00:00Z' }, { id: 'e3', first_name: 'Chloe', status: 'confirmed', is_permanent: false, added_via: 'organiser', checked_in_at: null }],
  }));
  return () => setCalled;
}
for (const scheme of ['light', 'dark'] as const) {
  test.describe(`v3 ${scheme}`, () => {
    test.use({ colorScheme: scheme });
    test('guest list: live night sheet and the Door link', async ({ page }) => {
      await openLive(page, '/account/p3/guests', 'owner');
      await expect(page.getByTestId('v2-guests-tab')).toBeVisible();
      const door = page.getByTestId('v2-guests-door');
      await expect(door).toBeVisible();
      expect((await door.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await expectNoHorizontalScroll(page);
      await page.screenshot({ path: `${OUT}/v3-guests-${scheme}.png` });
      await page.locator('[data-testid="gl-open"]').first().click();
      await page.waitForTimeout(800);
      await expectNoHorizontalScroll(page);
      await page.screenshot({ path: `${OUT}/v3-guests-sheet-${scheme}.png` });
    });
    test('raffle: live night, confirm sheet, never sent', async ({ page }) => {
      const sent = await openLive(page, '/account/p3/raffle', 'owner');
      await expect(page.getByTestId('v2-raffle-tab')).toBeVisible();
      await expectNoHorizontalScroll(page);
      await page.screenshot({ path: `${OUT}/v3-raffle-${scheme}.png` });
      await page.locator('[data-testid="raffle-row"]').first().click();
      await expect(page.getByTestId('raffle-sheet')).toBeVisible();
      await page.screenshot({ path: `${OUT}/v3-raffle-sheet-${scheme}.png` });
      await page.locator('[data-testid="raffle-sheet"] button.p3-btn').first().click();
      await expect(page.getByTestId('raffle-confirm')).toBeVisible();
      await page.screenshot({ path: `${OUT}/v3-raffle-confirm-${scheme}.png` });
      await page.getByTestId('raffle-confirm-keep').click();
      expect(sent()).toBe(false);
    });
    test('raffle: a contributor seat sees the owner-only message', async ({ page }) => {
      await openLive(page, '/account/p3/raffle', 'contributor');
      await expect(page.getByTestId('v2-raffle-tab')).toBeVisible();
      await page.locator('[data-testid="raffle-row"]').first().click();
      await expect(page.getByTestId('raffle-sheet')).toBeVisible();
      await page.screenshot({ path: `${OUT}/v3-raffle-contributor-${scheme}.png` });
    });
  });
}
