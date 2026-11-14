import { test, expect } from '@playwright/test';
// Needs the flag at dev-server start: VITE_ENABLE_PUBLIC_TICKETING=true npx playwright test tests/e2e/ticket-thanks-forward.spec.ts --project=chromium
// Not in the test:e2e gate list (flag off there).
import { PHONE, OrganiserFake, expectNoHorizontalScroll, json } from './helpers/organiserFake';

const ORDER = '3f2b8c1e-5a47-4d1b-9c2e-7a6b5c4d3e2f';

test.use({ viewport: PHONE });

const GATE = '**/rest/v1/rpc/dancer_area_gate_v1';

// allowed:false is an incomplete profile: the gate admits /app/tickets view-only.
for (const allowed of [true, false]) {
  test(`signed-in buyer (profile ${allowed ? 'complete' : 'incomplete'}) returning from Stripe lands in the Tickets tab`, async ({ page }) => {
    await new OrganiserFake({ noOrganiser: true }).install(page);
    await page.route(GATE, (r) => json(r, { open: false, allowed }));
    await page.route('**/rest/v1/rpc/ticket_order_public_status_v1', (r) => json(r, { status: 'paid', ticket_count: 2, event_title: 'Friday Social', event_date: '2026-11-06' }));
    await page.route('**/rest/v1/rpc/my_ticket_order_qr_v1', (r) => json(r, { tickets: [] }));
    await page.goto(`/tickets/thanks?o=${ORDER}`);
    await expect(page).toHaveURL(new RegExp(`/app/tickets\\?o=${ORDER}`), { timeout: 20000 });
    await expect(page.getByTestId('tickets-screen')).toBeVisible({ timeout: 20000 });
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: test.info().outputPath(`forward-${allowed ? 'complete' : 'incomplete'}-390x844.png`) });
  });
}
