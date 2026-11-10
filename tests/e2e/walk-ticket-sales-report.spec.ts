import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { FRIDAY, NOW, ORG, ORG_NAME, OrganiserFake, PHONE, expectNoHorizontalScroll, json } from './helpers/organiserFake';

// The Sales report card (Tickets > See all) at 390x844 over the route-mocked organiser fake. The
// card mounts only in the Tickets sheet orders view, and prod has no order the walk account can
// see, so the ticket types and orders reads are answered in their LIVE shapes (ticketsApi.ts
// TYPE_COLS / fetchOrders) and nothing is written. Every scenario asserts the visible numbers
// against its fixture, so a wrong sum fails. Needs both flags (skips itself otherwise):
//   VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true VITE_ENABLE_ORGANISER_TICKETING=true \
//     SALES_SHOTS=test-results/ticket-sales-report npx playwright test tests/e2e/walk-ticket-sales-report.spec.ts --project=chromium

const OUT = process.env.SALES_SHOTS ?? 'test-results/ticket-sales-report';
mkdirSync(OUT, { recursive: true });
const MOUNTED = process.env.VITE_ENABLE_ORGANISER_P3 === 'true' && process.env.VITE_ENABLE_ORGANISER_TICKETING === 'true';
test.skip(!MOUNTED, 'organiserP3 / organiserTicketing is off in this server: the Tickets sheet is not mounted');
test.use({ viewport: PHONE });

const T_STD = 'c0000000-0000-4000-8000-000000000c01';
const T_FREE = 'c0000000-0000-4000-8000-000000000c02';
const type = (id: string, name: string, price: number, capacity: number, reserved: number) => ({
  id, event_series_id: FRIDAY, occurrence_id: null, name, price_pence: price, capacity, reserved_count: reserved,
  sales_open_at: null, sales_close_at: null, status: 'on_sale', manual_sold_out: false, created_at: '2026-10-01T10:00:00Z',
});
let seq = 0;
const order = (typeId: string, status: string, o: { qty?: number; subtotal: number; fee?: number; refunded?: number }) => {
  const n = ++seq;
  const fee = o.fee ?? 0;
  const paid = status === 'paid' || status === 'refunded' || status === 'disputed';
  return {
    id: `d0000000-0000-4000-8000-${String(n).padStart(12, '0')}`, ticket_type_id: typeId, buyer_name: `Guest ${n}`, quantity: o.qty ?? 1,
    subtotal_pence: o.subtotal, booking_fee_pence: fee, total_pence: o.subtotal + fee, refunded_pence: o.refunded ?? 0, status,
    paid_at: paid ? `2026-10-0${1 + (n % 7)}T1${n % 10}:00:00Z` : null,
  };
};

type Fixture = { types: unknown[]; orders: unknown[] };
const fixtures = (): Record<string, Fixture> => {
  seq = 0;
  const a: Fixture = {
    types: [type(T_STD, 'Standard', 1000, 60, 3), type(T_FREE, 'Free guestlist', 0, 20, 0)],
    orders: [
      order(T_STD, 'paid', { subtotal: 1000 }),
      order(T_STD, 'paid', { qty: 2, subtotal: 2000, fee: 100 }),
      ...[1, 2, 3].map(() => order(T_STD, 'refunded', { subtotal: 1000, fee: 100, refunded: 1100 })),
      order(T_STD, 'expired', { subtotal: 1000 }),
      order(T_FREE, 'expired', { subtotal: 0 }),
      order(T_FREE, 'expired', { subtotal: 0 }),
    ],
  };
  const b: Fixture = {
    types: [type(T_STD, 'Standard', 1500, 30, 30), type(T_FREE, 'Late entry', 1000, 50, 10)],
    orders: [
      ...Array.from({ length: 30 }, () => order(T_STD, 'paid', { subtotal: 1500 })),
      ...Array.from({ length: 10 }, () => order(T_FREE, 'paid', { subtotal: 1000 })),
    ],
  };
  const c: Fixture = {
    types: [type(T_STD, 'Standard', 1000, 60, 4)],
    orders: [order(T_STD, 'paid', { subtotal: 1000 }), order(T_STD, 'paid', { subtotal: 1000 }), order(T_STD, 'paid', { qty: 2, subtotal: 2000, refunded: 500 })],
  };
  const d: Fixture = { types: [type(T_STD, 'Standard', 400, 60, 3)], orders: [1, 2, 3].map(() => order(T_STD, 'paid', { subtotal: 400 })) };
  const e: Fixture = { types: [type(T_STD, 'Standard', 1000, 60, 3)], orders: [1, 2, 3].map(() => order(T_STD, 'paid', { subtotal: 1000 })) };
  return { a, b, c, d, e };
};

async function open(page: Page, fx: Fixture, role?: string) {
  const state = { current: fx };
  const fake = new OrganiserFake({});
  await fake.install(page);
  if (role) (fake.organisers[0] as { role: string }).role = role;
  await page.route('**/rest/v1/rpc/organiser_onboarding_status_v1*', (r) =>
    json(r, {
      v: 1, gate_on: false, is_admin: false, complete: true, person: { complete: true, missing: [] },
      organisers: [{ id: ORG, name: ORG_NAME, role: role ?? 'owner', lifecycle: 'live', complete: true, missing: [], about: { done: true, skipped: false } }],
    }));
  await page.route('**/rest/v1/organiser_stripe_accounts*', (r) => {
    const row = { charges_enabled: true, payouts_enabled: true, details_submitted: true };
    return json(r, (r.request().headers()['accept'] ?? '').includes('vnd.pgrst.object') ? row : [row]);
  });
  await page.route('**/rest/v1/rpc/ticket_sales_summary_v1*', (r) => json(r, { ok: true, ticket_types: [] }));
  await page.route('**/rest/v1/rpc/ticket_door_list_v1*', (r) => json(r, { result: 'not_allowed', rows: [], in_count: null, total_count: null }));
  await page.route('**/rest/v1/rpc/ticket_promo_list_v1*', (r) => json(r, { ok: true, rows: [] }));
  await page.route('**/rest/v1/ticket_types*', (r) => json(r, state.current.types));
  await page.route('**/rest/v1/ticket_orders*', (r) => json(r, state.current.orders));
  await page.goto(`/account/p3/events/${FRIDAY}?o=${ORG}`);
  await expect(page.getByTestId('tix-row')).toBeVisible({ timeout: 45_000 });
  await page.getByTestId('tix-row').click();
  return state;
}

async function toReport(page: Page) {
  const see = page.getByTestId('tix-see-all');
  await expect(see).toBeVisible({ timeout: 20_000 });
  await see.click();
  const card = page.getByTestId('tix-report');
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.scrollIntoViewIfNeeded();
  return card;
}

/** Every visible control on the card is a >= 44 px tap and sits inside 0..390; no sideways scroll. */
async function geometry(page: Page) {
  await expectNoHorizontalScroll(page);
  const boxes = await page.locator('[data-testid="tix-report"] :is(a, button, input)').evaluateAll((els) =>
    els.filter((e) => (e as HTMLElement).offsetParent).map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent || e.getAttribute('data-testid'), h: r.height, l: r.left, r: r.right }; }));
  expect(boxes.length).toBeGreaterThan(0);
  for (const b of boxes) {
    expect(b.h, String(b.t)).toBeGreaterThanOrEqual(44);
    expect(b.l, String(b.t)).toBeGreaterThanOrEqual(0);
    expect(b.r, String(b.t)).toBeLessThanOrEqual(PHONE.width);
  }
}

const text = (page: Page, id: string) => page.getByTestId(id);

test('a: prod shape today (2 paid, 3 refunded with fee, 3 expired)', async ({ page }) => {
  await open(page, fixtures().a);
  const card = await toReport(page);
  const std = card.getByTestId(`tix-report-row-${T_STD}`);
  await expect(std.getByTestId('tix-report-counts')).toHaveText('3 sold · 3 refunded · 57 left of 60');
  await expect(std.getByTestId('tix-report-money')).toHaveText('Taken £64.00 · Refunded £33.00 · Net £31.00');
  await expect(card.getByTestId(`tix-report-row-${T_FREE}`).getByTestId('tix-report-counts')).toHaveText('0 sold · 0 refunded · 20 left of 20');
  await expect(text(page, 'tix-report-total-counts')).toHaveText('3 sold · 3 refunded');
  await expect(text(page, 'tix-report-total-money')).toHaveText('Taken £64.00 · Refunded £33.00 · Net £31.00');
  await expect(text(page, 'tix-report-notpaid')).toHaveText('3 orders not paid, left out.');
  await expect(text(page, 'tix-report-download')).toBeEnabled();
  await geometry(page);
  await page.screenshot({ path: `${OUT}/a-prod-shape.png` });

  // CSV: counted orders only (paid + refunded = 5), BOM, CRLF, no email, no Stripe id
  const [dl] = await Promise.all([page.waitForEvent('download'), text(page, 'tix-report-download').click()]);
  const file = `${OUT}/guest-list.csv`;
  await dl.saveAs(file);
  const bytes = readFileSync(file);
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const csv = bytes.subarray(3).toString('utf8');
  expect(csv.endsWith('\r\n')).toBe(true);
  expect(csv.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  const lines = csv.split('\r\n').filter(Boolean);
  expect(lines[0]).toBe('Order,Buyer name,Ticket type,Quantity,Status,Paid at,Refunded (pence)');
  expect(lines).toHaveLength(1 + 5);
  expect(csv).not.toContain('@');
  expect(csv).not.toMatch(/\b(pi|cs|ch)_/);
  expect(dl.suggestedFilename()).toMatch(/^guests-friday-bachata-2026-10-08\.csv$/);
});

test('b: 40 paid orders, two types, one sold out', async ({ page }) => {
  await open(page, fixtures().b);
  const card = await toReport(page);
  await expect(card.getByTestId(`tix-report-row-${T_STD}`).getByTestId('tix-report-counts')).toHaveText('30 sold · 0 refunded · 0 left of 30');
  await expect(card.getByTestId(`tix-report-row-${T_FREE}`).getByTestId('tix-report-counts')).toHaveText('10 sold · 0 refunded · 40 left of 50');
  await expect(text(page, 'tix-report-total-counts')).toHaveText('40 sold · 0 refunded');
  await expect(text(page, 'tix-report-total-money')).toHaveText('Taken £550.00 · Refunded £0.00 · Net £550.00');
  await geometry(page);
  await page.screenshot({ path: `${OUT}/b-forty-paid.png` });
});

test('c: part-refunded paid order', async ({ page }) => {
  await open(page, fixtures().c);
  await toReport(page);
  await expect(text(page, 'tix-report-total-counts')).toHaveText('4 sold · 0 refunded');
  await expect(text(page, 'tix-report-total-money')).toHaveText('Taken £40.00 · Refunded £5.00 · Net £35.00');
  await geometry(page);
  await page.screenshot({ path: `${OUT}/c-part-refunded.png` });
});

/** The orders view is reached with 3+ shown orders; then the read answers the shape under test. */
async function swapOrders(page: Page, state: { current: Fixture }, next: Fixture) {
  state.current = next;
  // the app's queries stay fresh for 60 s: move the frozen clock past that, then refocus the tab
  await page.clock.setFixedTime(new Date(NOW.getTime() + 120_000));
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); window.dispatchEvent(new Event("visibilitychange")); });
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); window.dispatchEvent(new Event("visibilitychange")); });
}

test('d: lost dispute (fixture only): Disputed line, Net 0.00 for a 12 pound order', async ({ page }) => {
  seq = 100;
  const state = await open(page, fixtures().d);
  await toReport(page);
  await swapOrders(page, state, { types: [type(T_STD, 'Standard', 1200, 60, 1)], orders: [order(T_STD, 'disputed', { subtotal: 1200 })] });
  await expect(text(page, `tix-report-row-${T_STD}`).getByTestId('tix-report-disputed')).toHaveText('Disputed 1 ticket · £12.00 not counted in Net', { timeout: 20_000 });
  await expect(text(page, 'tix-report-total-counts')).toHaveText('0 sold · 0 refunded · 1 disputed (£12.00)');
  await expect(text(page, 'tix-report-total-money')).toHaveText('Taken £12.00 · Refunded £0.00 · Net £0.00');
  await text(page, 'tix-report').scrollIntoViewIfNeeded();
  await geometry(page);
  await page.screenshot({ path: `${OUT}/fixture-dispute.png` });
});

test('e: nothing paid (pending and expired only): empty state, download disabled with a reason', async ({ page }) => {
  seq = 200;
  const state = await open(page, fixtures().e);
  await toReport(page);
  await swapOrders(page, state, { types: [type(T_STD, 'Standard', 1000, 60, 0)], orders: [order(T_STD, 'pending', { subtotal: 1000 }), order(T_STD, 'expired', { subtotal: 1000 })] });
  await expect(text(page, 'tix-report-empty')).toHaveText('No sales to report yet. Share the event so people can buy.', { timeout: 20_000 });
  await expect(text(page, 'tix-report-notpaid')).toHaveText('2 orders not paid, left out.');
  await expect(text(page, 'tix-report-download')).toBeDisabled();
  await expect(text(page, 'tix-report-why')).toHaveText('No paid orders yet. The guest list fills as people buy.');
  await text(page, 'tix-report').scrollIntoViewIfNeeded();
  await geometry(page);
  await page.screenshot({ path: `${OUT}/e-nothing-paid.png` });
});

test('f: contributor (not a manager): report shows, no refund control', async ({ page }) => {
  await open(page, fixtures().c, 'contributor');
  const card = await toReport(page);
  await expect(text(page, 'tix-report-total-money')).toHaveText('Taken £40.00 · Refunded £5.00 · Net £35.00');
  await expect(card.getByTestId('tix-refund')).toHaveCount(0);
  await expect(page.getByTestId('tix-refund')).toHaveCount(0);
  await geometry(page);
  await page.screenshot({ path: `${OUT}/f-contributor.png` });
});
