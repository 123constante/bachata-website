import { test, expect, type Page } from '@playwright/test';
import { FRIDAY, ORG, ORG_NAME, OrganiserFake, expectNoHorizontalScroll, json } from './helpers/organiserFake';

// T3 price steps (docs/briefs/ticket-t3-price-steps-editor.md "Walk"): add, move, remove, the 4th
// disabled with its reason, the orders note and reserve_not_ready, at 390x844 and 360x640 over the
// route-mocked organiser fake (nothing is written; the step RPCs are answered by an in-page fake).
// Prod has 0 steps (survey 2026-11-12), so the stepped type is a fixture. WALK_OUT=<dir> saves shots.

const MOUNTED =
  process.env.VITE_ENABLE_ORGANISER_P3 === 'true' &&
  process.env.VITE_ENABLE_ORGANISER_TICKETING === 'true' &&
  process.env.VITE_ENABLE_TICKET_PRICE_STEPS_EDITOR === 'true';
test.skip(!MOUNTED, 'organiserP3 / organiserTicketing / ticketPriceStepsEditor is off in this server');

const T_ID = 'c0000000-0000-4000-8000-000000000c31';
const typeRow = { id: T_ID, event_series_id: FRIDAY, occurrence_id: null, name: 'Standard', price_pence: 1200, capacity: 60, reserved_count: 6,
  sales_open_at: null, sales_close_at: null, status: 'on_sale', manual_sold_out: false, created_at: '2026-10-01T10:00:00Z' };
type Step = { id: string; effective_from: string; price_pence: number; is_live: boolean };

async function open(page: Page, steps: Step[], opts: { refuse?: string } = {}) {
  const state = { steps: [...steps], sets: [] as unknown[], removes: [] as unknown[] };
  const fake = new OrganiserFake({});
  await fake.install(page);
  await page.route('**/rest/v1/rpc/organiser_onboarding_status_v1*', (r) =>
    json(r, { v: 1, gate_on: false, is_admin: false, complete: true, person: { complete: true, missing: [] },
      organisers: [{ id: ORG, name: ORG_NAME, role: 'owner', lifecycle: 'live', complete: true, missing: [], about: { done: true, skipped: false } }] }));
  await page.route('**/rest/v1/organiser_stripe_accounts*', (r) => {
    const row = { charges_enabled: true, payouts_enabled: true, details_submitted: true };
    return json(r, (r.request().headers()['accept'] ?? '').includes('vnd.pgrst.object') ? row : [row]);
  });
  await page.route('**/rest/v1/rpc/ticket_sales_summary_v1*', (r) => json(r, { ok: true, ticket_types: [] }));
  await page.route('**/rest/v1/rpc/ticket_door_list_v1*', (r) => json(r, { result: 'not_allowed', rows: [], in_count: null, total_count: null }));
  await page.route('**/rest/v1/rpc/ticket_promo_list_v1*', (r) => json(r, { ok: true, rows: [] }));
  await page.route('**/rest/v1/ticket_types*', (r) => json(r, [typeRow]));
  await page.route('**/rest/v1/ticket_orders*', (r) => json(r, [{ id: 'o1', ticket_type_id: T_ID, buyer_name: 'A B', quantity: 1, subtotal_pence: 1200, booking_fee_pence: 0, total_pence: 1200, refunded_pence: 0, status: 'paid', paid_at: '2026-11-01T10:00:00Z' }]));
  await page.route('**/rest/v1/rpc/ticket_types_manage_v1*', (r) =>
    json(r, { ok: true, ticket_types: [{ id: T_ID, base_price_pence: 1200, effective_price_pence: 1200, has_orders: true, has_price_steps: state.steps.length > 0, steps: state.steps }] }));
  await page.route('**/rest/v1/rpc/ticket_price_step_set_v1*', (r) => {
    const a = r.request().postDataJSON() as { p_step_id: string | null; p_effective_from: string; p_price_pence: number };
    state.sets.push(a);
    if (opts.refuse) return json(r, { ok: false, reason: opts.refuse });
    if (a.p_step_id) state.steps = state.steps.map((s) => (s.id === a.p_step_id ? { ...s, effective_from: a.p_effective_from, price_pence: a.p_price_pence } : s));
    else state.steps.push({ id: `s${state.steps.length + 10}`, effective_from: a.p_effective_from, price_pence: a.p_price_pence, is_live: false });
    state.steps.sort((x, y) => x.effective_from.localeCompare(y.effective_from));
    return json(r, { ok: true, step_id: 'x' });
  });
  await page.route('**/rest/v1/rpc/ticket_price_step_remove_v1*', (r) => {
    const a = r.request().postDataJSON() as { p_step_id: string };
    state.removes.push(a);
    state.steps = state.steps.filter((s) => s.id !== a.p_step_id);
    return json(r, { ok: true, step_id: a.p_step_id });
  });
  await page.goto(`/account/p3/events/${FRIDAY}?o=${ORG}`);
  await expect(page.getByTestId('tix-row')).toBeVisible({ timeout: 45_000 });
  await page.getByTestId(`tix-type-${T_ID}`).getByTestId('tix-edit').click();
  await expect(page.getByTestId('tix-steps')).toBeVisible();
  return state;
}

async function shot(page: Page, name: string) {
  const out = process.env.WALK_OUT;
  if (out) await page.getByTestId('tix-steps').screenshot({ path: `${out}/${name}.png` });
}

/** Every visible control in the block: >= 44px tall, inside the screen; no sideways scroll. */
async function geometry(page: Page, width: number) {
  await expectNoHorizontalScroll(page);
  const boxes = await page.locator('[data-testid="tix-steps"] :is(button, input)').evaluateAll((els) =>
    els.filter((e) => e.getClientRects().length > 0).map((e) => { const r = e.getBoundingClientRect(); return { t: e.getAttribute('data-testid') || e.textContent, h: r.height, l: r.left, r: r.right }; }));
  for (const b of boxes) {
    expect(b.h, String(b.t)).toBeGreaterThanOrEqual(44);
    expect(b.l, String(b.t)).toBeGreaterThanOrEqual(0);
    expect(b.r, String(b.t)).toBeLessThanOrEqual(width);
  }
}

const S = (id: string, at: string, p: number): Step => ({ id, effective_from: at, price_pence: p, is_live: false });

for (const vp of [{ width: 390, height: 844 }, { width: 360, height: 640 }]) {
  test.describe(`${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp });

    test('add, move, remove; orders note', async ({ page }) => {
      const st = await open(page, []);
      await expect(page.getByTestId('tix-steps-empty')).toBeVisible();
      await expect(page.getByTestId('tix-steps-orders')).toHaveText('Existing buyers keep the price they paid.');
      await geometry(page, vp.width);
      await shot(page, `${vp.width}-1-empty`);
      await page.getByTestId('tix-step-add').click();
      await page.getByTestId('tix-step-at').fill('2027-01-10T19:00');
      await page.getByTestId('tix-step-price').fill('15');
      await geometry(page, vp.width);
      await shot(page, `${vp.width}-2-add-form`);
      await page.getByTestId('tix-step-save').click();
      await expect(page.getByTestId('tix-step-row')).toHaveCount(1);
      expect(st.sets).toEqual([{ p_ticket_type_id: T_ID, p_step_id: null, p_effective_from: '2027-01-10T19:00:00.000Z', p_price_pence: 1500 }]);
      await expect(page.getByTestId('tix-step-applies')).toHaveText(/every night of this ticket from Sunday, 10 January 2027, 19:00 GMT\./);
      await shot(page, `${vp.width}-3-one-step`);
      await page.getByTestId('tix-step-move').click();
      await page.getByTestId('tix-step-at').fill('2027-06-01T19:00');
      await page.getByTestId('tix-step-save').click();
      await expect(page.getByTestId('tix-step-applies')).toHaveText(/1 June 2027, 19:00 BST/);
      expect(st.sets[1]).toEqual({ p_ticket_type_id: T_ID, p_step_id: 's10', p_effective_from: '2027-06-01T18:00:00.000Z', p_price_pence: 1500 });
      await page.getByTestId('tix-step-remove').click();
      await shot(page, `${vp.width}-4-remove-ask`);
      await page.getByTestId('tix-step-remove-yes').click();
      await expect(page.getByTestId('tix-steps-empty')).toBeVisible();
      expect(st.removes).toEqual([{ p_step_id: 's10' }]);
    });

    test('3 steps: the 4th is disabled with its reason', async ({ page }) => {
      await open(page, [S('a', '2027-01-10T19:00:00+00:00', 1500), S('b', '2027-02-10T19:00:00+00:00', 1000), S('c', '2027-06-01T18:00:00+00:00', 1800)]);
      await expect(page.getByTestId('tix-step-add')).toBeDisabled();
      await expect(page.getByTestId('tix-step-add-why')).toHaveText('3 price changes is the most. Remove one to add another.');
      await geometry(page, vp.width);
      await shot(page, `${vp.width}-5-three-steps`);
    });

    test('reserve_not_ready: the words, the draft kept', async ({ page }) => {
      await open(page, [], { refuse: 'reserve_not_ready' });
      await page.getByTestId('tix-step-add').click();
      await page.getByTestId('tix-step-at').fill('2027-01-10T19:00');
      await page.getByTestId('tix-step-price').fill('15');
      await page.getByTestId('tix-step-save').click();
      await expect(page.getByTestId('tix-step-error')).toHaveText('Price changes open once the new checkout is live.');
      await expect(page.getByTestId('tix-step-price')).toHaveValue('15');
      await geometry(page, vp.width);
      await shot(page, `${vp.width}-6-reserve-not-ready`);
    });
  });
}
