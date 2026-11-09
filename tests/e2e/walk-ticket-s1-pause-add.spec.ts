import { test, expect, type Page } from '@playwright/test';
import { FRIDAY, ORG, ORG_NAME, OrganiserFake, PHONE, expectNoHorizontalScroll, json } from './helpers/organiserFake';

// S1 "pause this price, add a new one" at 390x844 over the route-mocked organiser fake (nothing is
// written). Three shapes: a paused ticket with sales, a locked price (on sale with sales), and no
// tickets. Needs the same flags as walk-ticket-sales-report.spec.ts (skips itself otherwise).

const MOUNTED = process.env.VITE_ENABLE_ORGANISER_P3 === 'true' && process.env.VITE_ENABLE_ORGANISER_TICKETING === 'true';
test.skip(!MOUNTED, 'organiserP3 / organiserTicketing is off in this server: the Tickets sheet is not mounted');
test.use({ viewport: PHONE });

const T_ID = 'c0000000-0000-4000-8000-000000000c01';
const type = (status: string, reserved: number) => ({
  id: T_ID, event_series_id: FRIDAY, occurrence_id: null, name: 'Standard', price_pence: 1000, capacity: 60, reserved_count: reserved,
  sales_open_at: null, sales_close_at: null, status, manual_sold_out: false, created_at: '2026-10-01T10:00:00Z',
});
type Fixture = { types: unknown[]; orders: unknown[] };

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


/** Every visible button/input in `scope` is >= 44px tall and inside 0..390; no sideways scroll. */
async function geometry(page: Page, scope: string) {
  await expectNoHorizontalScroll(page);
  const boxes = await page.locator(`${scope} :is(button, input)`).evaluateAll((els) =>
    els.filter((e) => (e as HTMLElement).offsetParent).map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent || e.getAttribute('data-testid'), h: r.height, l: r.left, r: r.right }; }));
  expect(boxes.length).toBeGreaterThan(0);
  for (const b of boxes) {
    expect(b.l, String(b.t)).toBeGreaterThanOrEqual(0);
    expect(b.r, String(b.t)).toBeLessThanOrEqual(PHONE.width);
  }
  return boxes;
}

test('paused ticket with sales: says what paused means, resume is one tap', async ({ page }) => {
  await open(page, { types: [type('paused', 4)], orders: [] });
  const row = page.getByTestId(`tix-type-${T_ID}`);
  await expect(row.getByTestId('tix-paused-note')).toHaveText('Not on sale. People who already bought keep their tickets.');
  await expect(row.getByTestId('tix-switch')).toBeEnabled();
  const box = await row.getByTestId('tix-switch').boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByTestId('tix-add')).toBeVisible();
  await geometry(page, '[data-testid="tix-sheet"]');
});

test('locked price: the sheet says to pause and add a new one', async ({ page }) => {
  await open(page, { types: [type('on_sale', 3)], orders: [] });
  await page.getByTestId(`tix-type-${T_ID}`).getByTestId('tix-edit').click();
  await expect(page.getByTestId('tix-price-help')).toHaveText('Tickets have been sold at this price, so it cannot change. To use a different price, pause this ticket and add a new one.');
  await expect(page.getByTestId('tix-form-price')).toBeDisabled();
  await geometry(page, '[data-testid="tix-sheet"]');
});

test('no tickets: still says what to do', async ({ page }) => {
  await open(page, { types: [], orders: [] });
  await expect(page.getByTestId('tix-types-empty')).toContainText('Tap Add a ticket below.');
  await expect(page.getByTestId('tix-add')).toBeVisible();
  const box = await page.getByTestId('tix-add').boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(box!.x + box!.width).toBeLessThanOrEqual(PHONE.width);
  await geometry(page, '[data-testid="tix-sheet"]');
});
