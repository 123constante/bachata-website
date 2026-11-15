import { test, expect, type Locator, type Page, type Route } from '@playwright/test';
import { ORG, ORG_NAME, OrganiserFake, json } from './helpers/organiserFake';

// Ticket promo codes, organiser section (brief ticket-promo-codes-organiser): the Promo codes
// section on the P3 Tickets sheet and its create / edit sheet at 390x844 and 320x568, light and
// dark, over the route-mocked organiser fake (no prod write). Boxes inside the viewport, opening a
// sheet scrolls nothing, the toast lands inside the viewport. Run with the flags on:
//   VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true VITE_ENABLE_ORGANISER_TICKETING=true \
//     npx playwright test tests/e2e/walk-p3-promo-codes.spec.ts --project=chromium
// No test.skip: with the flags off the page does not mount and every test FAILS.

const SERIES = 'b0000000-0000-4000-8000-000000000b01';
const TYPE = {
  id: 'c0000000-0000-4000-8000-000000000c01', event_series_id: SERIES, occurrence_id: null, name: 'Standard', price_pence: 1200,
  capacity: 60, reserved_count: 3, sales_open_at: null, sales_close_at: null, status: 'on_sale', manual_sold_out: false, created_at: '2026-11-01T10:00:00Z',
};
const promo = (id: string, over: Record<string, unknown>) => ({
  id, code: 'EARLYBIRD', kind: 'percent', value: 10, max_uses: null, used_count: 0, expires_at: null, active: true, created_at: '2026-11-01T10:00:00Z', paid_orders: 0, ...over,
});
const ROWS = [
  promo('p1', { code: 'EARLYBIRD', max_uses: 20, used_count: 3, paid_orders: 3, expires_at: '2099-11-13T23:59:00Z' }),
  promo('p2', { code: 'FRIENDS-5', kind: 'fixed', value: 500 }),
  promo('p3', { code: 'SUMMER', expires_at: '2020-07-01T12:00:00Z', used_count: 12, paid_orders: 11 }),
  promo('p4', { code: 'STAFF', active: false, value: 100 }),
];

async function open(page: Page) {
  const fake = new OrganiserFake({});
  await fake.install(page);
  fake.addSeries(fake.organisers[0], { id: SERIES, name: 'Promo walk', category: 'party', format: 'recurring', lifecycle_status: 'live' });
  await page.route('**/rest/v1/rpc/organiser_onboarding_status_v1*', (r) =>
    json(r, {
      v: 1, gate_on: false, is_admin: false, complete: true, person: { complete: true, missing: [] },
      organisers: [{ id: ORG, name: ORG_NAME, role: 'owner', lifecycle: 'live', complete: true, missing: [], about: { done: true, skipped: false } }],
    }));
  await page.route('**/rest/v1/organiser_stripe_accounts*', (r) => {
    const row = { charges_enabled: true, payouts_enabled: true, details_submitted: true };
    return json(r, (r.request().headers()['accept'] ?? '').includes('vnd.pgrst.object') ? row : [row]);
  });
  await page.route('**/rest/v1/rpc/ticket_sales_summary_v1*', (r) => json(r, { ok: true, ticket_types: [] }));
  await page.route('**/rest/v1/ticket_types*', (r) => json(r, [TYPE]));
  await page.route('**/rest/v1/ticket_orders*', (r) => json(r, []));
  await page.route('**/rest/v1/rpc/ticket_promo_list_v1*', (r) => json(r, { ok: true, rows: ROWS }));
  const sent: string[] = [];
  await page.route('**/rest/v1/rpc/ticket_promo_create_v1*', async (route: Route) => {
    sent.push(route.request().postData() ?? '');
    return json(route, { ok: true, id: 'p9', code: 'NEWCODE' });
  });
  await page.goto(`/account/p3/events/${SERIES}?o=${ORG}`);
  return { sent };
}

const settled = (page: Page) =>
  page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))));
const scrolls = (page: Page) => page.evaluate(() => [window.scrollY, document.querySelector('.p3-main')?.scrollTop ?? 0]);

for (const size of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`${size.width}x${size.height} ${scheme}`, () => {
      test.use({ viewport: size, colorScheme: scheme });
      const inView = async (el: Locator, what: string) => {
        const b = await el.boundingBox();
        expect(b, `${what} has a box`).not.toBeNull();
        expect(b!.x, `${what} left`).toBeGreaterThanOrEqual(-0.5);
        expect(b!.y, `${what} top`).toBeGreaterThanOrEqual(-0.5);
        expect(b!.x + b!.width, `${what} right`).toBeLessThanOrEqual(size.width + 0.5);
        expect(b!.y + b!.height, `${what} bottom`).toBeLessThanOrEqual(size.height + 0.5);
      };

      test('promo list, create sheet and toast fit; no page scroll; one create sent', async ({ page }) => {
        const { sent } = await open(page);
        const row = page.getByTestId('tix-row');
        await expect(row).toBeVisible({ timeout: 20_000 });
        await row.scrollIntoViewIfNeeded();
        const before = await scrolls(page);
        const section = page.getByTestId('promo-section');
        await expect(section).toBeVisible();
        await expect(page.getByTestId(/^promo-row-/)).toHaveCount(4);
        await expect(page.getByTestId('promo-row-p3')).toHaveAttribute('data-state', 'expired');
        await expect(page.getByTestId('promo-row-p4')).toHaveAttribute('data-state', 'off');
        expect(await scrolls(page), 'opening Tickets scrolled the page').toEqual(before);
        await section.scrollIntoViewIfNeeded();
        await settled(page);
        await page.screenshot({ path: `test-results/promo-list-${size.width}-${scheme}.png` });
        const add = page.getByTestId('promo-add');
        await add.scrollIntoViewIfNeeded();
        await inView(add, 'Add a promo code');
        const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflowX, 'no sideways page scroll').toBeLessThanOrEqual(0);

        await add.click();
        const save = page.getByTestId('promo-save');
        await expect(save).toBeVisible();
        await settled(page);
        expect(await scrolls(page), 'opening the promo sheet scrolled the page').toEqual(before);
        await inView(page.getByTestId('promo-sheet'), 'promo sheet');
        expect(await page.getByTestId('promo-sheet').evaluate((el) => !!el.parentElement?.closest('[data-testid="tix-tall"]')), 'promo sheet is not inside the tall sheet').toBe(false);
        await inView(save, 'Create code');
        await page.getByTestId('promo-form-code').fill('newcode');
        await page.getByTestId('promo-form-amount').fill('15');
        await page.screenshot({ path: `test-results/promo-sheet-${size.width}-${scheme}.png` });
        await save.dblclick();
        const toast = page.getByTestId('tix-toast');
        await expect(toast).toHaveText('NEWCODE is ready. Buyers can type it when they buy.');
        await inView(toast, 'toast');
        expect(sent, 'one create sent').toHaveLength(1);
        expect(JSON.parse(sent[0])).toMatchObject({ p_code: 'NEWCODE', p_kind: 'percent', p_value: 15, p_max_uses: null, p_expires_at: null });
      });

      test('a locked code: the edit sheet says why the discount cannot change, inside the viewport', async ({ page }) => {
        await open(page);
        await page.getByTestId('promo-row-p1').getByTestId('promo-edit').click();
        const locked = page.getByTestId('promo-locked');
        await expect(locked).toBeVisible();
        await expect(page.getByTestId('promo-form-amount')).toBeDisabled();
        // the sheet is live, not inert under the tall sheet: typing works
        await page.getByTestId('promo-form-maxUses').fill('30');
        await expect(page.getByTestId('promo-form-maxUses')).toHaveValue('30');
        await locked.scrollIntoViewIfNeeded();
        await inView(locked, 'locked reason');
        await inView(page.getByTestId('promo-save'), 'Save changes');
        await page.screenshot({ path: `test-results/promo-locked-${size.width}-${scheme}.png` });
      });
    });
  }
}
