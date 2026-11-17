import { test, expect } from '@playwright/test';
import { FRIDAY, ORG, ORG_NAME, OrganiserFake, PHONE, expectNoHorizontalScroll, json } from './helpers/organiserFake';

// New ticket on a weekly series at 390x844 over the route-mocked organiser fake (nothing is written):
// Sales close is hidden, the note says each night closes when it ends, no fixed close date is offered.

const MOUNTED = process.env.VITE_ENABLE_ORGANISER_P3 === 'true' && process.env.VITE_ENABLE_ORGANISER_TICKETING === 'true';
test.skip(!MOUNTED, 'organiserP3 / organiserTicketing is off in this server: the Tickets sheet is not mounted');
test.use({ viewport: PHONE });

test('weekly series: new ticket sheet has no Sales close, says each night closes when it ends', async ({ page }) => {
  const fake = new OrganiserFake({});
  await fake.install(page);
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
  await page.route('**/rest/v1/rpc/ticket_door_list_v1*', (r) => json(r, { result: 'not_allowed', rows: [], in_count: null, total_count: null }));
  await page.route('**/rest/v1/rpc/ticket_promo_list_v1*', (r) => json(r, { ok: true, rows: [] }));
  await page.route('**/rest/v1/ticket_types*', (r) => json(r, []));
  await page.route('**/rest/v1/ticket_orders*', (r) => json(r, []));
  await page.goto(`/account/p3/events/${FRIDAY}?o=${ORG}`);
  await expect(page.getByTestId('tix-row')).toBeVisible({ timeout: 45_000 });
  await page.getByTestId('tix-add').click();
  await page.getByTestId('tix-form-name').fill('Door');
  await page.getByTestId('tix-next').click();
  await page.getByTestId('tix-form-capacity').fill('40');
  await expect(page.getByTestId('tix-every-date')).toContainText('sales close when that night ends');
  await expect(page.getByTestId('tix-form-closesAt')).toHaveCount(0);
  await expect(page.getByTestId('tix-close-never')).toHaveCount(0);
  await expect(page.getByTestId('tix-close-pick')).toHaveCount(0);
  await expectNoHorizontalScroll(page);
});
