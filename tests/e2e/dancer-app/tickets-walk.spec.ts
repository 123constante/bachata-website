import { test, expect, type Page } from '@playwright/test';
import { PHONE, OrganiserFake, expectNoHorizontalScroll, json } from '../helpers/organiserFake';
import { DANCER_SHAPES } from '../../../src/modules/dancer-app/api/fixtures';

// Option A Tickets tab walk at 390x844 (brief option-a-tickets-tab). Needs the flag ON at
// build time: VITE_ENABLE_PUBLIC_TICKETING=true. Not in the test:e2e gate list (flag OFF there).
// Screenshots go to docs/qa/option-a-tickets-tab/ for the PR.

const ORDER = '11111111-2222-4333-8444-555555555555';
const tok = (i: number) => i.toString(16).padStart(64, '0');
const rows = (n: number) => ({ tickets: Array.from({ length: n }, (_, i) => ({ ticket_id: `t${i}`, ticket_type_name: n > 1 ? `Early bird ${i + 1}` : 'Standard', qr_token: tok(i + 1), checked_in: false, short_code: 'ABC234' })) });
const SHOTS = 'docs/qa/option-a-tickets-tab';

async function open(page: Page, path: string, o: { allowed?: boolean; profile?: 'complete' | 'none'; status?: string; qr?: number }) {
  const fake = new OrganiserFake({ noOrganiser: true });
  await fake.install(page);
  await page.route('**/rest/v1/rpc/dancer_area_gate_v1', (r) => json(r, { open: false, allowed: o.allowed ?? true }));
  await page.route('**/rest/v1/rpc/my_dancer_edit_v1', (r) =>
    o.profile === 'none' ? r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'P0002', message: 'no_profile' }) }) : json(r, DANCER_SHAPES.fourFieldComplete.profile));
  await page.route('**/rest/v1/rpc/ticket_order_public_status_v1', (r) => json(r, { status: o.status ?? 'paid', event_title: 'Thursday Social', event_date: '2026-11-19', event_id: 'ev-1', ticket_count: o.qr ?? 1 }));
  await page.route('**/rest/v1/rpc/my_ticket_order_qr_v1', (r) => json(r, rows(o.qr ?? 1)));
  await page.route('**/rest/v1/rpc/my_tickets_v1', (r) => json(r, { tickets: [], truncated: false, total_count: 0 }));
  await page.goto(path);
}

async function noScroll(page: Page) {
  await expectNoHorizontalScroll(page);
  const over = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  expect(over, 'no vertical scroll').toBeLessThanOrEqual(1);
}

test.use({ viewport: PHONE });

test('one ticket, view-only buyer (not allowed, no profile)', async ({ page }) => {
  await open(page, `/app/tickets?o=${ORDER}`, { allowed: false });
  await expect(page.getByTestId('ticket-qr')).toBeVisible();
  await expect(page.getByTestId('tickets-finish-bar')).toBeVisible();
  await noScroll(page);
  await page.screenshot({ path: `${SHOTS}/1-one-ticket.png` });
  await page.getByTestId('tickets-card-qr').click();
  await expect(page.getByTestId('tickets-door-title')).toHaveText('Thursday Social');
  await page.screenshot({ path: `${SHOTS}/1b-door-view.png` });
});

test('three tickets, no profile', async ({ page }) => {
  await open(page, `/app/tickets?o=${ORDER}`, { profile: 'none', qr: 3 });
  await expect(page.getByTestId('tickets-card-count')).toHaveText('Ticket 1 of 3');
  await page.getByTestId('tickets-card-next').click();
  await expect(page.getByTestId('tickets-card-count')).toHaveText('Ticket 2 of 3');
  await noScroll(page);
  await page.screenshot({ path: `${SHOTS}/2-three-tickets.png` });
});

for (const [name, status] of [['pending', 'pending'], ['failed', 'failed']] as const) {
  test(`${name} order`, async ({ page }) => {
    await open(page, `/app/tickets?o=${ORDER}`, { status });
    await expect(page.getByTestId('tickets-card')).toHaveAttribute('data-state', name);
    await noScroll(page);
    await page.screenshot({ path: `${SHOTS}/3-${name}.png` });
  });
}

test('no order on this device (complete dancer: no bar, no locks)', async ({ page }) => {
  await open(page, '/app/tickets', {});
  await expect(page.getByTestId('tickets-card')).toHaveAttribute('data-state', 'none');
  await expect(page.getByTestId('tickets-finish-bar')).toHaveCount(0);
  await noScroll(page);
  await page.screenshot({ path: `${SHOTS}/4-no-order.png` });
});

test('locked tab opens the sheet', async ({ page }) => {
  await open(page, `/app/tickets?o=${ORDER}`, { allowed: false });
  await page.getByTestId('dancer-app-tab-home').click();
  await expect(page.getByTestId('profile-sheet')).toBeVisible();
  await page.getByTestId('profile-chip-videographer').click();
  await expect(page.getByTestId('profile-sheet-soon')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/5-locked-tab-sheet.png` });
  for (const el of await page.locator('[data-profile="dancer"] [data-testid^="profile-chip-"], [data-testid^="dancer-app-tab-"]').all()) {
    const b = await el.boundingBox();
    expect(b!.height).toBeGreaterThanOrEqual(43.5);
  }
});
