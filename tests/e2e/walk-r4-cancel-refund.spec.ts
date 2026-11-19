// THROWAWAY WALK SCRIPT (R4 cancel refund, slice C), NOT in the test:e2e gate list: 390x844 of a cancelled night with
// organiser_night_refund_summary_v1 answered in prod's order shapes (2026-11-19 survey: multi-ticket, part-refunded,
// no buyer name, refunded) and ticket-refund-night / ticket-refund MOCKED (never the real refund endpoint).
// Run (flags at dev-server start): see MANUAL in scripts/check-e2e-spec-coverage.mjs.
import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { FRIDAY, OrganiserFake, PHONE, expectNoHorizontalScroll } from './helpers/organiserFake';

test.use({ viewport: PHONE });
const OUT = 'docs/design/organiser-round4/shots';
mkdirSync(OUT, { recursive: true });
const NEXT = '2026-10-09';
const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const ORDERS = [
  { order_id: 'd0000000-0000-4000-8000-000000000001', first_name: 'Ana', tickets: 2, remaining_pence: 2400, refunded: false, mixed_nights: false },
  { order_id: 'd0000000-0000-4000-8000-000000000002', first_name: 'Ben', tickets: 3, remaining_pence: 2100, refunded: false, mixed_nights: false },
  { order_id: 'd0000000-0000-4000-8000-000000000003', first_name: null, tickets: 1, remaining_pence: 1200, refunded: false, mixed_nights: false },
  { order_id: 'd0000000-0000-4000-8000-000000000004', first_name: 'Cara', tickets: 1, remaining_pence: 1500, refunded: false, mixed_nights: true },
  { order_id: 'd0000000-0000-4000-8000-000000000005', first_name: 'Dee', tickets: 1, remaining_pence: 0, refunded: true, mixed_nights: false },
];
const summary = (allowed: boolean) => allowed
  ? { ok: true, night_cancelled: true, orders_to_refund: 3, pence_to_refund: 5700, free_orders_to_end: 2, orders: ORDERS }
  : { ok: false, reason: 'not_allowed' };

async function open(page: Page, { cancelled = true, allowed = true } = {}) {
  const fake = new OrganiserFake();
  if (cancelled) fake.series.get(FRIDAY)!.cancelled[NEXT] = 'Venue issue';
  await fake.install(page);
  const sent: unknown[] = [];
  await page.route('**/rest/v1/rpc/organiser_night_refund_summary_v1', (r) => r.fulfill(json(summary(allowed))));
  await page.route('**/functions/v1/ticket-refund-night', (r) => {
    sent.push(r.request().postDataJSON());
    return r.fulfill(json({ ok: true, refunded_count: 2, failed_count: 1, free_ended: 2, free_failed: false,
      results: [{ order_id: ORDERS[0].order_id, ok: true }, { order_id: ORDERS[1].order_id, ok: false, reason: 'stripe_error' }, { order_id: ORDERS[2].order_id, ok: true }] }));
  });
  await page.route('**/rest/v1/rpc/ticket_door_list_v3', (r) => r.fulfill(json({ result: 'ok', rows: [], in_count: 0, total_count: 0, truncated: false })));
  await page.goto(`/account/p3/events/${FRIDAY}`);
  await expect(page.getByTestId('r4-night')).toBeVisible({ timeout: 20_000 });
  return sent;
}

test('owner, cancelled night: refund block, sheet, partial result', async ({ page }) => {
  const sent = await open(page);
  await expect(page.getByTestId('r4-refund-line')).toHaveText('3 orders to refund, \u00a357', { timeout: 10_000 });
  await expect(page.getByTestId('r4-refund-title')).toHaveText(/^Refunds, cancelled Friday 9 October$/);
  await expect(page.getByTestId('r4-guests')).toHaveCount(0);
  await expect(page.getByTestId('r4-refund-row')).toHaveCount(5);
  for (const b of await page.locator('[data-testid=r4-refund-all], [data-testid=r4-refund-one]').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(42);
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${OUT}/refund-night.png`, fullPage: true });
  await page.getByTestId('r4-refund-all').click();
  await expect(page.getByRole('dialog')).toContainText('Refund 3 orders, \u00a357?');
  await page.screenshot({ path: `${OUT}/refund-sheet.png` });
  await page.getByTestId('r4-refund-go').click();
  await expect(page.getByTestId('r4-refund-said')).toContainText('Not refunded yet: Ben.');
  expect(sent).toEqual([{ series: FRIDAY, occurrence: expect.any(String), expected_pence: 5700, expected_orders: 3 }]);
  await expect(page.getByTestId('r4-refund-all')).toBeVisible();
  await page.screenshot({ path: `${OUT}/refund-partial.png`, fullPage: true });
});

test('manager / door seat: server says not_allowed, no money and no buttons', async ({ page }) => {
  await open(page, { allowed: false });
  await page.waitForTimeout(1500);
  await expect(page.getByTestId('r4-refund')).toHaveCount(0);
  await page.screenshot({ path: `${OUT}/refund-manager.png`, fullPage: true });
});

test('night not cancelled: no refund block, no read', async ({ page }) => {
  let reads = 0;
  page.on('request', (r) => { if (r.url().includes('organiser_night_refund_summary_v1')) reads += 1; });
  await open(page, { cancelled: false });
  await page.waitForTimeout(1500);
  await expect(page.getByTestId('r4-refund')).toHaveCount(0);
  expect(reads).toBe(0);
  await page.screenshot({ path: `${OUT}/refund-not-cancelled.png`, fullPage: true });
});
