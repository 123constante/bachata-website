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
  // typing is never dropped silently: the Events tab asks first
  await page.locator('.r4-tab[data-tab="events"]').click();
  await expect(page.getByTestId('r4-edit-keep')).toBeVisible();
  await page.getByTestId('r4-edit-keep').click();
  await expect(page.getByTestId('r4-edit-name')).toHaveValue('Friday Bachata Social');
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

// cont4: boards R4Tickets, R4Refund, R4EmptyTickets. Ticket reads mocked in prod shape A (one-off, 4 batches cap 5,
// one paused, paid + part-refunded orders); nothing is written (the refund and status RPCs are counted, never sent on).
async function tickets(page: import('@playwright/test').Page, opts: { types?: unknown[]; fail?: boolean; series?: string } = {}) {
  const { FRIDAY, ORG, ORG_NAME, json } = await import('./helpers/organiserFake');
  const t = (id: string, name: string, status: string) => ({ tickets_sold: name === 'Early bird' ? 3 : 0, orders_paid: name === 'Early bird' ? 2 : 0, gross_pence: name === 'Early bird' ? 3600 : 0, refunded_pence: name === 'Early bird' ? 600 : 0, id, event_series_id: opts.series ?? FRIDAY, occurrence_id: null, name, price_pence: 1200, capacity: 5, reserved_count: 1, sales_open_at: null, sales_close_at: null, status, manual_sold_out: false, created_at: '2026-10-01T10:00:00Z' });
  const types = opts.types ?? [t('c0000000-0000-4000-8000-000000000c01', 'Early bird', 'on_sale'), t('c0000000-0000-4000-8000-000000000c02', 'Standard', 'on_sale'), t('c0000000-0000-4000-8000-000000000c03', 'Late', 'paused'), t('c0000000-0000-4000-8000-000000000c04', 'Door', 'on_sale')];
  const orders = [
    { id: 'd0000000-0000-4000-8000-0000000a7c21', ticket_type_id: 'c0000000-0000-4000-8000-000000000c01', buyer_name: 'Maya Cole', quantity: 2, subtotal_pence: 2400, booking_fee_pence: 0, total_pence: 2400, refunded_pence: 0, status: 'paid', paid_at: '2026-10-05T10:00:00Z' },
    { id: 'd0000000-0000-4000-8000-000000000002', ticket_type_id: 'c0000000-0000-4000-8000-000000000c01', buyer_name: null, quantity: 1, subtotal_pence: 1200, booking_fee_pence: 0, total_pence: 1200, refunded_pence: 600, status: 'paid', paid_at: '2026-10-06T10:00:00Z' },
  ];
  let wrote = 0;
  await page.route('**/rest/v1/rpc/organiser_onboarding_status_v1*', (r) => json(r, { v: 1, gate_on: false, is_admin: false, complete: true, person: { complete: true, missing: [] }, organisers: [{ id: ORG, name: ORG_NAME, role: 'owner', lifecycle: 'live', complete: true, missing: [], about: { done: true, skipped: false } }] }));
  await page.route('**/rest/v1/organiser_stripe_accounts*', (r) => { const row = { charges_enabled: true, payouts_enabled: true, details_submitted: true }; return json(r, (r.request().headers()['accept'] ?? '').includes('vnd.pgrst.object') ? row : [row]); });
  await page.route('**/rest/v1/rpc/ticket_sales_summary_v1*', (r) => (opts.fail ? json(r, { message: 'boom' }, 500) : json(r, { ok: true, ticket_types: types, money_visible: true })));
  await page.route('**/rest/v1/rpc/ticket_door_list_v3*', (r) => json(r, { result: 'ok', rows: [], in_count: 0, total_count: 3 }));
  await page.route('**/rest/v1/rpc/ticket_promo_list_v1*', (r) => json(r, { ok: true, rows: [] }));
  await page.route('**/rest/v1/ticket_types*', (r) => (opts.fail ? json(r, { message: 'boom' }, 500) : json(r, types)));
  await page.route('**/rest/v1/ticket_orders*', (r) => json(r, orders));
  await page.route('**/rest/v1/rpc/ticket_orders_for_organiser_v1*', (r) => json(r, { ok: true, orders }));
  await page.route('**/functions/v1/ticket-refund*', (r) => { wrote++; return r.abort(); });
  await page.route('**/rest/v1/rpc/ticket_type_set_status_v1*', (r) => { wrote++; return r.abort(); });
  return { wrote: () => wrote, FRIDAY };
}

test('tickets night', async ({ page }) => {
  const fake = new (await import('./helpers/organiserFake')).OrganiserFake({});
  fake.addSeries(fake.organisers[0], { id: ONE_OFF, name: 'Halloween Social', format: 'one_off', category: 'party', default_start_date: '2026-10-31' });
  await fake.install(page);
  // prod shape A is a one-off: the only shape where places are one night's, so "of N" and the bar show
  const s = await tickets(page, { series: ONE_OFF });
  await page.goto(`/account/p3/tickets?e=${ONE_OFF}`);
  await expect(page.getByTestId('r4-tix')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  await expectNoHorizontalScroll(page);
  await expect(page.locator('.r4-tab[data-tab="tickets"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('r4-tix-message')).toBeDisabled();
  for (const id of ['r4-tix-batches', 'r4-tix-who', 'r4-tix-money']) expect((await page.getByTestId(id).boundingBox())!.height).toBeGreaterThanOrEqual(48);
  console.log('big:', (await page.getByTestId('r4-tix-big').innerText()).replace(/\n/g, ' | '));
  await page.screenshot({ path: `${OUT}/tickets.png`, fullPage: true });
  expect(s.wrote()).toBe(0);
});

test('tickets refund', async ({ page }) => {
  const fake = new (await import('./helpers/organiserFake')).OrganiserFake({});
  await fake.install(page);
  const s = await tickets(page);
  await page.goto(`/account/p3/tickets?e=${s.FRIDAY}`);
  await page.getByTestId('r4-tix-who').click({ timeout: 30_000 });
  await page.getByTestId('tix-refund').first().click({ timeout: 15_000 });
  await expect(page.getByTestId('r4-refund')).toBeVisible();
  await page.waitForTimeout(600);
  await expectNoHorizontalScroll(page);
  for (const id of ['tix-refund-confirm', 'tix-refund-cancel']) expect((await page.getByTestId(id).boundingBox())!.height).toBeGreaterThanOrEqual(42);
  console.log('refund:', (await page.getByTestId('tix-refund-sheet').innerText()).replace(/\n/g, ' | '));
  await page.screenshot({ path: `${OUT}/tickets-refund.png` });
  await page.getByTestId('tix-refund-cancel').click();
  expect(s.wrote()).toBe(0);
});

test('tickets empty and error', async ({ page }) => {
  const fake = new (await import('./helpers/organiserFake')).OrganiserFake({});
  await fake.install(page);
  const s = await tickets(page, { types: [] });
  await page.goto(`/account/p3/tickets?e=${s.FRIDAY}`);
  await expect(page.getByTestId('r4-tix-empty')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1000);
  await expectNoHorizontalScroll(page);
  expect((await page.getByTestId('r4-tix-pick').boundingBox())!.height).toBeGreaterThanOrEqual(56);
  await page.screenshot({ path: `${OUT}/tickets-empty.png` });
});

test('tickets error', async ({ page }) => {
  const fake = new (await import('./helpers/organiserFake')).OrganiserFake({});
  await fake.install(page);
  const s = await tickets(page, { fail: true });
  await page.goto(`/account/p3/tickets?e=${s.FRIDAY}`);
  await expect(page.getByTestId('r4-tix-error')).toBeVisible({ timeout: 45_000 });
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${OUT}/tickets-error.png` });
});
