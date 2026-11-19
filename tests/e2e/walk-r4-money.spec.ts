// THROWAWAY WALK SCRIPT (organiser R4 slice b, money per night), NOT in the test:e2e gate list: 390x844 of One night,
// Home and Compare with ticket_sales_by_night_v1 answered in prod's shape (route-mocked on top of the organiser fake).
// Run (flags at dev-server start): see MANUAL in scripts/check-e2e-spec-coverage.mjs.
import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { FRIDAY, OrganiserFake, PHONE, expectNoHorizontalScroll } from './helpers/organiserFake';

test.use({ viewport: PHONE });
const OUT = 'docs/design/organiser-round4/shots';
mkdirSync(OUT, { recursive: true });

// Past Fridays before the fake's TODAY (2026-10-08), plus the next one (2026-10-09).
const PAST = ['2026-09-11', '2026-09-18', '2026-09-25', '2026-10-02'];
const occ = (d: string) => `e0000000-0000-4000-8000-${d.replace(/-/g, '')}0000`;
const zero = { gross_pence: 0, booking_fees_pence: 0, refunded_pence: 0, net_pence: 0, orders_paid: 0, orders_refunded: 0, orders_disputed: 0, tickets_sold: 0 };
const MONEY: Record<string, Partial<typeof zero>> = {
  '2026-09-11': { gross_pence: 4800, refunded_pence: 1200, net_pence: 3600, orders_paid: 3, tickets_sold: 4 },
  '2026-09-18': {},
  '2026-09-25': { orders_disputed: 1 },
  '2026-10-02': { gross_pence: 6000, net_pence: 6000, booking_fees_pence: 300, orders_paid: 5, tickets_sold: 5 },
  '2026-10-09': { gross_pence: 2400, net_pence: 2400, orders_paid: 2, tickets_sold: 2 },
};
const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

async function open(page: Page, path: string, moneyFails = false) {
  const fake = new OrganiserFake();
  await fake.install(page);
  let moneyCalls = 0;
  await page.route('**/rest/v1/rpc/ticket_sales_by_night_v1', (r) => {
    moneyCalls += 1;
    const sid = (r.request().postDataJSON() as { p_event_series_id: string }).p_event_series_id;
    if (sid !== FRIDAY) return r.fulfill(json({ ok: false, reason: 'not_authorised' }));
    if (moneyFails) return r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'boom' }) });
    return r.fulfill(json({
      ok: true, event_series_id: sid, truncated: false,
      nights: Object.entries(MONEY).map(([d, m]) => ({ occurrence_id: d === '2026-10-09' ? 'next-night' : occ(d), occurrence_date: d, ...zero, ...m })),
      no_night: { ...zero, gross_pence: 1500, net_pence: 1500, orders_paid: 1, tickets_sold: 1 },
    }));
  });
  await page.route('**/rest/v1/rpc/organiser_raffle_nights_v1', (r) => {
    const sid = (r.request().postDataJSON() as { p_series_id: string }).p_series_id;
    if (sid !== FRIDAY) return r.fulfill(json({ ok: true, series_id: sid, can_edit: true, nights: [] }));
    return r.fulfill(json({ ok: true, series_id: sid, can_edit: true, nights: PAST.map((d) => ({ occurrence_id: occ(d), date: d, chip: 'closed', raffle_on: false, entries_count: 0, can_set: false })) }));
  });
  await page.route('**/rest/v1/rpc/ticket_door_list_v3', (r) => r.fulfill(json({ result: 'ok', rows: [], in_count: 30, total_count: 40, truncated: false })));
  await page.goto(path);
  return { fake, calls: () => moneyCalls };
}

test('one night: money tile with its quiet line', async ({ page }) => {
  await open(page, `/account/p3/events/${FRIDAY}`);
  await expect(page.getByTestId('r4-night')).toBeVisible({ timeout: 20_000 });
  const tile = page.getByTestId('r4-night-tile-money');
  await expect(tile).toBeVisible({ timeout: 10_000 });
  await expect(tile).toContainText('Money in');
  await expect(tile).toContainText('\u00a324');
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${OUT}/money-night.png` });
});

test('one night: money read fails, plain words and retry', async ({ page }) => {
  await open(page, `/account/p3/events/${FRIDAY}`, true);
  await expect(page.getByTestId('r4-night-money-error')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('r4-night-money-error')).toContainText('Try again');
  await expect(page.getByTestId('r4-night-tile-money')).toHaveCount(0);
  await page.screenshot({ path: `${OUT}/money-night-error.png` });
});

test('home: the night in focus carries its money', async ({ page }) => {
  await open(page, '/account/p3');
  await expect(page.getByTestId('r4-home')).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1500);
  const face = await page.getByTestId('r4-home').getAttribute('data-face');
  console.log('home face:', face, 'title:', await page.getByTestId('r4-home-title').textContent());
  const tile = page.getByTestId('r4-tile-money');
  if (await tile.count()) console.log('home money tile:', await tile.textContent());
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${OUT}/money-home.png`, fullPage: true });
});

test('compare: People / Money switch ranks by net', async ({ page }) => {
  await open(page, `/account/p3/compare?e=${FRIDAY}`);
  await expect(page.getByTestId('r4-compare')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('r4-compare-switch')).toBeVisible({ timeout: 10_000 });
  for (const id of ['r4-compare-by-people', 'r4-compare-by-money']) expect((await page.getByTestId(id).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: `${OUT}/money-compare-people.png`, fullPage: true });
  await page.getByTestId('r4-compare-by-money').click();
  await expect(page.getByTestId('r4-compare-by-money')).toHaveAttribute('aria-pressed', 'true');
  const rows = page.getByTestId('r4-compare-row');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText('\u00a360 in, 5 tickets');
  await expect(rows.nth(0)).toContainText('\u00a33 booking fees kept apart.');
  await expect(rows.nth(1)).toContainText('\u00a336 in, 4 tickets');
  await expect(rows.nth(1)).toContainText('\u00a312 refunded.');
  await expect(rows.nth(2)).toContainText('1 order in dispute.');
  await expect(page.getByTestId('r4-compare-foot')).toContainText('\u00a315 from tickets not tied to one night');
  for (const r of await page.getByTestId('r4-compare-who').all()) expect((await r.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${OUT}/money-compare.png`, fullPage: true });
});
