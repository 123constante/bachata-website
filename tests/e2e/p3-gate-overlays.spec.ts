import { test, expect, type Locator, type Page, type Route } from '@playwright/test';
import { FRIDAY, ORG, OrganiserFake, PHONE, expectNoHorizontalScroll, json } from './helpers/organiserFake';

// P3-GATE overlays (F-11, F-12) at 390x844 with a FLOWING clock (page.clock.install, never paused), on the real app
// over the route-mocked organiser fake. Runs only when the dev server has the P3 and ticketing flags, as the other
// test:e2e:p3 walks do:
//   VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true VITE_ENABLE_ORGANISER_TICKETING=true \
//     npx playwright test tests/e2e/p3-gate-overlays.spec.ts --project=chromium
// The gate flag is OFF on prod, so the status read says gate_on and the refusal is the exact shape
// _require_onboarding_complete_v1 raises (P0001 'onboarding_incomplete', DETAIL {missing, organiser_id}).
//
// Asserts, for the Repeat sheet's held note and for the Tickets sheet's refused Add: the sheet, its confirm button and
// the gate sheet (with Continue / Not now) sit inside the viewport; opening a sheet does not scroll the page and every
// focus() inside a dialog passes { preventScroll: true }; nothing is sent that the gate would refuse (no Repeat dry
// run, so no failed-change record). The shared gate sheet's own light/dark geometry is p3-gate-sheet.spec.ts.

const P3_ON = process.env.VITE_ENABLE_ORGANISER_P3 === 'true';
const TIX_ON = process.env.VITE_ENABLE_ORGANISER_TICKETING === 'true';
const CLOCK = new Date('2026-10-30T18:30:00Z');
const REFUSAL = { code: 'P0001', message: 'onboarding_incomplete', details: JSON.stringify({ missing: ['org_logo'], organiser_id: ORG }), hint: 'Finish your details' };
const STATUS = {
  v: 1, gate_on: true, is_admin: false, complete: false,
  person: { complete: true, missing: [] },
  organisers: [{ id: ORG, name: 'Ritmo Bachata London', role: 'owner', lifecycle: 'live', complete: false, missing: ['org_logo'], about: { done: false, skipped: false } }],
};

type Box = { x: number; y: number; width: number; height: number };
async function inView(el: Locator, what: string) {
  const b = (await el.boundingBox()) as Box | null;
  expect(b, `${what} has a box`).not.toBeNull();
  expect(b!.x, `${what} left`).toBeGreaterThanOrEqual(0);
  expect(b!.y, `${what} top`).toBeGreaterThanOrEqual(0);
  expect(b!.x + b!.width, `${what} right`).toBeLessThanOrEqual(PHONE.width + 0.5);
  expect(b!.y + b!.height, `${what} bottom`).toBeLessThanOrEqual(PHONE.height + 0.5);
}
const scrolls = (page: Page) => page.evaluate(() => [window.scrollY, document.querySelector('.p3-main')?.scrollTop ?? 0]);
const dialogFocus = (page: Page, gateOnly = false) => page.evaluate((g) => (window as unknown as { __focus: Array<{ inDialog: boolean; inGate: boolean; preventScroll: boolean; who: string; stack: string }> }).__focus.filter((f) => (g ? f.inGate : f.inDialog)), gateOnly);

async function openReal(page: Page) {
  await page.clock.install({ time: CLOCK });
  const fake = new OrganiserFake();
  await fake.install(page);
  await page.addInitScript(() => {
    const w = window as unknown as { __focus: Array<{ inDialog: boolean; inGate: boolean; preventScroll: boolean; who: string; stack: string }> };
    w.__focus = [];
    const orig = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function focus(this: HTMLElement, o?: FocusOptions) {
      w.__focus.push({ inDialog: !!this.closest('[role="dialog"]'), inGate: !!this.closest('[role="dialog"]')?.querySelector('[data-testid="p3-gate"]'), preventScroll: o?.preventScroll === true, who: this.getAttribute('data-testid') ?? this.tagName, stack: new Error().stack?.split('\n').slice(2, 5).join(' | ') ?? '' });
      return orig.call(this, o);
    };
  });
  const sent: string[] = [];
  // registered after the fake's own routes, so these win
  await page.route('**/rest/v1/rpc/organiser_onboarding_status_v1*', (r) => json(r, STATUS));
  await page.route('**/rest/v1/rpc/series_command_p5*', async (route: Route) => {
    sent.push(route.request().postData() ?? '');
    return json(route, REFUSAL, 400);
  });
  // ticketing reads: a connected Stripe row, no ticket types yet (the prod shape of 50 of 51 pages, plus Stripe)
  await page.route('**/rest/v1/organiser_stripe_accounts*', (r) => {
    const row = { charges_enabled: true, payouts_enabled: true, details_submitted: true };
    return json(r, (r.request().headers()['accept'] ?? '').includes('vnd.pgrst.object') ? row : [row]);
  });
  await page.route('**/rest/v1/rpc/ticket_sales_summary_v1*', (r) => json(r, { ok: true, ticket_types: [] }));
  await page.route('**/rest/v1/ticket_types*', (r) => json(r, []));
  await page.route('**/rest/v1/ticket_orders*', (r) => json(r, []));
  const tix: string[] = [];
  await page.route('**/rest/v1/rpc/ticket_type_upsert_v1*', async (route: Route) => {
    tix.push(route.request().postData() ?? '');
    return json(route, REFUSAL, 400);
  });
  await page.goto(`/account/p3/events/${FRIDAY}`);
  await expect(page.getByTestId('p3-event')).toBeVisible();
  return { sent, tix };
}

async function gateInView(page: Page) {
  const gate = page.getByTestId('p3-gate');
  await expect(gate).toBeVisible();
  await page.clock.runFor(1000); // the clock flows; nothing may move the boxes
  await inView(page.locator('[role="dialog"]', { has: gate }), 'gate sheet');
  await inView(page.getByTestId('p3-gate-go'), 'Continue');
  await inView(page.getByTestId('p3-gate-not-now'), 'Not now');
  // in view is not enough: the gate sheet once drew BEHIND the open Repeat sheet. A tap at each control's centre must reach it.
  for (const id of ['p3-gate-go', 'p3-gate-not-now']) {
    const hit = await page.getByTestId(id).evaluate((el) => {
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
      return top === el || el.contains(top);
    });
    expect(hit, `a tap on ${id} reaches it (nothing drawn over the gate sheet)`).toBe(true);
  }
  await expect(page.getByTestId('p3-gate-go')).toHaveAttribute('href', `/account/p3/start?o=${ORG}&at=review`);
}

test.describe('P3-GATE overlays on the real app (390x844)', () => {
  test.skip(!P3_ON, 'needs VITE_ENABLE_ORGANISER_P3=true in the dev server (a walk, like walk-w3c-1-repeat)');
  test.use({ viewport: PHONE });

  test('Repeat: the held note and Save sit in view, no dry run is sent, Save opens the gate sheet in view, no page scroll', async ({ page }) => {
    const { sent } = await openReal(page);
    const before = await scrolls(page);
    await page.getByTestId('p3-open-repeat').click();
    const sheet = page.getByTestId('p3-sheet');
    await expect(sheet).toBeVisible();
    expect(await scrolls(page), 'opening Repeat did not scroll the page').toEqual(before);
    await page.getByRole('button', { name: 'Monday' }).click();
    const held = page.getByTestId('p3-repeat-held');
    await expect(held).toBeVisible();
    const save = page.getByTestId('p3-repeat-save');
    await expect(save).toBeEnabled();
    await expect(page.getByTestId('p3-gate')).toHaveCount(0); // no gate sheet before Save is tapped
    await page.clock.runFor(1500); // past any preview debounce
    expect(sent, 'a predicted refusal sends no dry run (no failed-change record)').toHaveLength(0);
    await inView(sheet, 'Repeat sheet');
    await inView(save, 'Save');
    await held.scrollIntoViewIfNeeded();
    await inView(held, 'held note');
    await page.screenshot({ path: 'test-results/p3-gate-overlays-repeat-held.png' });
    await save.click();
    await gateInView(page);
    expect(sent, 'Save on a held refusal sends nothing').toHaveLength(0);
    expect(await scrolls(page), 'the gate sheet did not scroll the page').toEqual(before);
    const focus = await dialogFocus(page);
    expect(focus.length).toBeGreaterThan(0);
    for (const f of focus) expect(f.preventScroll, `dialogs focus with { preventScroll: true }: ${f.who} ${f.stack}`).toBe(true);
    await page.screenshot({ path: 'test-results/p3-gate-overlays-repeat-gate.png' });
    await page.getByTestId('p3-gate-not-now').click();
    await expect(page.getByTestId('p3-gate')).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });

  test('Tickets: a refused Add keeps the ticket sheet, opens the gate sheet in view, no generic error, no page scroll', async ({ page }) => {
    test.skip(!TIX_ON, 'needs VITE_ENABLE_ORGANISER_TICKETING=true in the dev server');
    const { tix } = await openReal(page);
    const row = page.getByTestId('tix-row');
    await row.scrollIntoViewIfNeeded();
    const before = await scrolls(page);
    await row.click();
    await expect(page.getByTestId('tix-add')).toBeVisible();
    expect(await scrolls(page), 'opening Tickets did not scroll the page').toEqual(before);
    await page.getByTestId('tix-add').click();
    await page.getByTestId('tix-form-name').fill('Standard');
    await page.getByTestId('tix-form-price').fill('12');
    await page.getByTestId('tix-next').click();
    await page.getByTestId('tix-form-capacity').fill('40');
    await page.getByTestId('tix-next').click();
    const save = page.getByTestId('tix-save');
    await expect(save).toBeVisible();
    await inView(page.locator('[role="dialog"]', { has: save }), 'Tickets sheet');
    await inView(save, 'ticket Save');
    await save.click();
    await gateInView(page);
    expect(tix).toHaveLength(1);
    await expect(page.getByText('That did not work. Try again in a moment.')).toHaveCount(0);
    expect(await scrolls(page), 'the gate sheet did not scroll the page').toEqual(before);
    // The ticket sheets (StackSheet, on main, outside this PR) focus their title without preventScroll; the page
    // scroll check above is what proves they do not move the page. The gate sheet's own focus must pass it.
    const focus = await dialogFocus(page, true);
    expect(focus.length).toBeGreaterThan(0);
    for (const f of focus) expect(f.preventScroll, `dialogs focus with { preventScroll: true }: ${f.who} ${f.stack}`).toBe(true);
    await page.screenshot({ path: 'test-results/p3-gate-overlays-tickets-gate.png' });
    await page.getByTestId('p3-gate-not-now').click();
    await expect(page.getByTestId('p3-gate')).toHaveCount(0);
    await expect(save, 'the ticket sheet stays open under the gate sheet').toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
