import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { FRIDAY, ORG, ORG_NAME, OrganiserFake, PHONE, expectNoHorizontalScroll, json } from './helpers/organiserFake';

// Tickets option A (flag organiserTicketsA) at 390x844 over the route-mocked organiser fake. Nothing is written.
//   VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true VITE_ENABLE_ORGANISER_TICKETING=true \
//   VITE_ENABLE_ORGANISER_SHELL_V2=true VITE_ENABLE_ORGANISER_TICKETS_A=true \
//     TIXA_SHOTS=test-results/tickets-a npx playwright test tests/e2e/walk-tickets-a.spec.ts --project=chromium
const OUT = process.env.TIXA_SHOTS ?? 'test-results/tickets-a';
mkdirSync(OUT, { recursive: true });
const MOUNTED = process.env.VITE_ENABLE_ORGANISER_TICKETS_A === 'true' && process.env.VITE_ENABLE_ORGANISER_P3 === 'true';
test.skip(!MOUNTED, 'organiserTicketsA is off in this server');
test.use({ viewport: PHONE });

const T1 = 'c0000000-0000-4000-8000-000000000c01';
const T2 = 'c0000000-0000-4000-8000-000000000c02';
const type = (id: string, name: string, price: number, capacity: number, reserved: number, status: string) => ({
  id, event_series_id: FRIDAY, occurrence_id: null, name, price_pence: price, capacity, reserved_count: reserved,
  sales_open_at: null, sales_close_at: null, status, manual_sold_out: false, created_at: '2026-10-01T10:00:00Z',
});
const types = [type(T1, 'Early bird', 800, 20, 20, 'on_sale'), type(T2, 'Standard', 1200, 40, 0, 'draft')];
const orders = Array.from({ length: 20 }, (_, i) => ({
  id: `d0000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, ticket_type_id: T1, buyer_name: `Guest ${i + 1}`, quantity: 1,
  subtotal_pence: 800, booking_fee_pence: 0, total_pence: 800, refunded_pence: 0, status: 'paid', paid_at: '2026-10-05T10:00:00Z',
}));

async function open(page: Page, role = 'owner') {
  const fake = new OrganiserFake({});
  await fake.install(page);
  (fake.organisers[0] as { role: string }).role = role;
  await page.route('**/rest/v1/rpc/organiser_onboarding_status_v1*', (r) =>
    json(r, { v: 1, gate_on: false, is_admin: false, complete: true, person: { complete: true, missing: [] },
      organisers: [{ id: ORG, name: ORG_NAME, role, lifecycle: 'live', complete: true, missing: [], about: { done: true, skipped: false } }] }));
  await page.route('**/rest/v1/organiser_stripe_accounts*', (r) => {
    const row = { charges_enabled: true, payouts_enabled: true, details_submitted: true };
    return json(r, (r.request().headers()['accept'] ?? '').includes('vnd.pgrst.object') ? row : [row]);
  });
  await page.route('**/rest/v1/rpc/ticket_sales_summary_v1*', (r) => json(r, { ok: true, ticket_types: types, money_visible: role === 'owner' }));
  await page.route('**/rest/v1/rpc/ticket_door_list_v1*', (r) => json(r, { result: 'ok', rows: [], in_count: 14, total_count: 20 }));
  await page.route('**/rest/v1/rpc/ticket_promo_list_v1*', (r) => json(r, { ok: true, rows: [] }));
  await page.route('**/rest/v1/ticket_types*', (r) => json(r, types));
  await page.route('**/rest/v1/ticket_orders*', (r) => json(r, orders));
  let wrote = 0;
  await page.route('**/rest/v1/rpc/ticket_type_set_status_v1*', (r) => { wrote++; return json(r, { ok: true }); });
  await page.goto(`/account/p3/tickets?o=${ORG}`);
  await expect(page.getByTestId('tixa')).toBeVisible({ timeout: 45_000 });
  return { wrote: () => wrote };
}

async function geometry(page: Page, scope: string) {
  await expectNoHorizontalScroll(page);
  const boxes = await page.locator(`${scope} :is(a, button, select)`).evaluateAll((els) =>
    els.filter((e) => (e as HTMLElement).offsetParent && !(e as HTMLButtonElement).disabled).map((e) => { const r = e.getBoundingClientRect(); return { t: (e.textContent ?? '').slice(0, 30), h: r.height, l: r.left, r: r.right }; }));
  for (const b of boxes) {
    expect(b.h, b.t).toBeGreaterThanOrEqual(44);
    expect(b.l, b.t).toBeGreaterThanOrEqual(0);
    expect(b.r, b.t).toBeLessThanOrEqual(390);
  }
}

test('chrome heights, no page scroll, A1 before-night face', async ({ page }) => {
  await open(page);
  await page.waitForTimeout(1200);
  const h = async (sel: string) => (await page.locator(sel).first().boundingBox())!.height;
  console.log('exit', await h('[data-testid="v2-exit"]'), 'top', await h('[data-testid="v2-top"]'), 'tabs', await h('.p3-tabs'));
  console.log('big', (await page.getByTestId('tixa-big').innerText()).replace(/\n/g, ' | '));
  await geometry(page, '[data-testid="v2-shell"]');
  const sc = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: innerHeight }));
  console.log('scroll', JSON.stringify(sc));
  await page.screenshot({ path: `${OUT}/a1-before.png` });
});

for (const [id, label] of [['tixa-open-money', 'money'], ['tixa-open-who', 'who'], ['tixa-open-batches', 'batches']] as const) {
  test(`sheet ${label}`, async ({ page }) => {
    await open(page);
    await page.getByTestId(id).click();
    await expect(page.getByTestId(`tixa-sheet-${label}`)).toBeVisible();
    await page.waitForTimeout(500);
    await geometry(page, `[data-testid="tixa-sheet-${label}"]`);
    await page.screenshot({ path: `${OUT}/sheet-${label}.png` });
  });
}

test('batches: Open now calls the status RPC once', async ({ page }) => {
  const s = await open(page);
  await page.getByTestId('tixa-open-batches').click();
  await page.getByTestId('tixa-open-now').click();
  await page.waitForTimeout(800);
  expect(s.wrote()).toBe(1);
  await page.screenshot({ path: `${OUT}/sheet-batches-opened.png` });
});

test('door face (clock at the night)', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-09T19:30:00Z') });
  await open(page);
  await page.waitForTimeout(800);
  console.log('door big', (await page.getByTestId('tixa-big').innerText()).replace(/\n/g, ' | '));
  console.log('BODY', (await page.locator('body').innerText()).replace(/
/g, ' | ').slice(0, 700));
  await expect(page.getByTestId('tixa-sell')).toBeVisible();
  await geometry(page, '[data-testid="v2-shell"]');
  await page.screenshot({ path: `${OUT}/a2-door.png` });
  await page.getByTestId('tixa-sell').click();
  await expect(page.getByTestId('tixa-sheet-sell')).toBeVisible();
  await page.screenshot({ path: `${OUT}/sheet-sell.png` });
});

test('after face', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-10T12:00:00Z') });
  await open(page);
  await page.waitForTimeout(800);
  console.log('after big', (await page.getByTestId('tixa-big').innerText()).replace(/\n/g, ' | '));
  await geometry(page, '[data-testid="v2-shell"]');
  await page.screenshot({ path: `${OUT}/a3-after.png` });
});

test('contributor seat: no money', async ({ page }) => {
  await open(page, 'contributor');
  await page.waitForTimeout(800);
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${OUT}/contributor.png` });
});
