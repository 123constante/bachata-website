import { test, expect, type Page } from '@playwright/test';
import { FRIDAY, ORG, ORG_NAME, OrganiserFake, expectNoHorizontalScroll, json } from './helpers/organiserFake';

// T5 course presets (docs/briefs/ticket-t5-course-presets.md "Gates"): a saved paid course offers early-bird
// presets that only fill the T3 form (no price, nothing written until Add), a free course says why none, and a
// new ticket can be "A course" with a start and end date; at 390x844 and 360x640 over the route-mocked organiser
// fake. The course start is 2099-03-01 so its presets stay in the future. WALK_OUT=<dir> saves shots.

const MOUNTED =
  process.env.VITE_ENABLE_ORGANISER_P3 === 'true' &&
  process.env.VITE_ENABLE_ORGANISER_TICKETING === 'true' &&
  process.env.VITE_ENABLE_TICKET_PRICE_STEPS_EDITOR === 'true' &&
  process.env.VITE_ENABLE_TICKET_COURSE_PRESETS === 'true';
test.skip(!MOUNTED, 'organiserP3 / organiserTicketing / ticketPriceStepsEditor / ticketCoursePresets is off in this server');

const T_ID = 'c0000000-0000-4000-8000-000000000c51';
const typeRow = { id: T_ID, event_series_id: FRIDAY, occurrence_id: null, name: 'Term 1', price_pence: 6000, capacity: 60, reserved_count: 0,
  sales_open_at: null, sales_close_at: null, status: 'on_sale', manual_sold_out: false, created_at: '2026-10-01T10:00:00Z' };
type Step = { id: string; effective_from: string; price_pence: number; is_live: boolean };

async function open(page: Page, steps: Step[], opts: { refuse?: string; price?: number; course?: boolean; create?: boolean } = {}) {
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
  const price = opts.price ?? 6000;
  await page.route('**/rest/v1/ticket_types*', (r) => {
    if (r.request().method() !== 'GET') return r.continue();
    if ((new URL(r.request().url()).searchParams.get('select') ?? '').startsWith('kind')) {
      return json(r, { kind: opts.course === false ? 'night' : 'course', valid_from: '2099-03-01', valid_to: '2099-05-10' });
    }
    return json(r, [{ ...typeRow, name: 'Term 1', price_pence: price }]);
  });
  await page.route('**/rest/v1/ticket_orders*', (r) => json(r, []));
  await page.route('**/rest/v1/rpc/ticket_types_manage_v1*', (r) =>
    json(r, { ok: true, ticket_types: [{ id: T_ID, base_price_pence: price, effective_price_pence: price, has_orders: false, has_price_steps: state.steps.length > 0, steps: state.steps }] }));
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
  if (opts.create) { await page.getByTestId('tix-add').click(); return state; }
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


for (const vp of [{ width: 390, height: 844 }, { width: 360, height: 640 }]) {
  test.describe(`${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp });

    test('saved paid course: presets fill the form, no price, nothing written until Add', async ({ page }) => {
      const st = await open(page, []);
      await expect(page.getByTestId('tix-presets')).toBeVisible();
      await expect(page.getByTestId('tix-preset-weeks-4')).toHaveText('Early bird ends 4 weeks before the start');
      await geometry(page, vp.width);
      await shot(page, `${vp.width}-1-presets`);
      await page.getByTestId('tix-preset-weeks-4').click();
      await expect(page.getByTestId('tix-step-at')).toHaveValue('2099-02-01T00:00');
      await expect(page.getByTestId('tix-step-price')).toHaveValue('');
      expect(st.sets).toEqual([]);
      await geometry(page, vp.width);
      await page.getByTestId('tix-step-price').fill('70');
      await page.getByTestId('tix-step-save').click();
      await expect(page.getByTestId('tix-step-row')).toHaveCount(1);
      expect(st.sets).toEqual([{ p_ticket_type_id: T_ID, p_step_id: null, p_effective_from: '2099-02-01T00:00:00.000Z', p_price_pence: 7000 }]);
      await shot(page, `${vp.width}-2-after-add`);
    });

    test('free course: no presets, says why', async ({ page }) => {
      await open(page, [], { price: 0 });
      await expect(page.getByTestId('tix-presets-blocked')).toContainText('Free tickets cannot have price changes');
      await geometry(page, vp.width);
    });

    test('new ticket: A course shows start and end, missing dates refuse', async ({ page }) => {
      await open(page, [], { create: true });
      await page.getByTestId('tix-kind-course').click();
      await page.getByTestId('tix-form-name').fill('Term 1');
      await page.getByTestId('tix-form-price').fill('60');
      await expect(page.getByTestId('tix-presets-unsaved')).toBeVisible();
      await page.getByTestId('tix-next').click();
      await expect(page.getByTestId('tix-err-validFrom')).toBeVisible();
      await expect(page.getByTestId('tix-err-validTo')).toBeVisible();
      await expectNoHorizontalScroll(page);
      const out = process.env.WALK_OUT;
      if (out) await page.screenshot({ path: `${out}/${vp.width}-3-new-course.png` });
    });
  });
}
