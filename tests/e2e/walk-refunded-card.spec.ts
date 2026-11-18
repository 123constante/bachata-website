import { test, expect, type Page, type Route } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { OrganiserFake, PHONE, expectNoHorizontalScroll, json } from './helpers/organiserFake';

// Brief refunded-card-website: My tickets + the Tickets tab at 390x844 with my_tickets_v1 answered in
// prod's shapes (admin 20261118194506: `refunded`, `order_refunded_pence`). Prod survey 2026-11-18:
// used, used + part refund, fully refunded (void, no QR). Mounts only with ticketing + buyer onboarding on:
//   VITE_ENABLE_PUBLIC_TICKETING=true VITE_ENABLE_BUYER_ONBOARDING=true WALK_SHOTS=docs/walk/refunded-card \
//     npx playwright test tests/e2e/walk-refunded-card.spec.ts --project=chromium

const OUT = process.env.WALK_SHOTS ?? 'test-results/walk-refunded-card';
mkdirSync(OUT, { recursive: true });
const MOUNTED = process.env.VITE_ENABLE_PUBLIC_TICKETING === 'true' && process.env.VITE_ENABLE_BUYER_ONBOARDING === 'true';
test.skip(!MOUNTED, 'publicTicketing / buyer onboarding off in this server');
test.use({ viewport: PHONE, colorScheme: 'dark' });

const NOW = new Date('2026-11-18T12:00:00Z');
let seq = 0;
const row = (o: Record<string, unknown>) => {
  seq += 1;
  return {
    order_id: `0rd${String(seq).padStart(5, '0')}-0000-4000-8000-000000000000`, event_series_id: `s${seq}`, event_title: 'Friday Party Night',
    occurrence_date: '2026-11-21', start_time: '21:00', ticket_type_name: 'Party', ticket_id: `t${seq}`,
    qr_token: seq.toString(16).padStart(64, 'a'), short_code: null, checked_in: false, checked_in_at: null,
    night_cancelled: false, refunded: false, order_refunded_pence: 0, ...o,
  };
};
const ALL = [
  row({ event_title: 'Refunded Sunday Party', occurrence_date: '2026-11-22', refunded: true, qr_token: null, order_refunded_pence: 1250 }),
  row({ event_title: 'Cancelled Thursday', occurrence_date: '2026-11-19', night_cancelled: true }),
  row({ event_title: 'Tonight (used)', occurrence_date: '2026-11-18', checked_in: true, checked_in_at: '2026-11-18T11:14:00Z', order_refunded_pence: 300 }),
  row({ event_title: 'Saturday Bachata (part refunded)', occurrence_date: '2026-11-21', order_refunded_pence: 500 }),
  row({ event_title: 'Past night (drops off)', occurrence_date: '2026-11-08' }),
];

async function open(page: Page, path: string, tickets: unknown[]) {
  await new OrganiserFake({ noOrganiser: true }).install(page);
  await page.route('**/rest/v1/rpc/dancer_area_gate_v1', (r) => json(r, { open: false, allowed: true }));
  await page.clock.setFixedTime(NOW);
  await page.route('**/rest/v1/rpc/my_tickets_v1*', (route: Route) => json(route, { tickets, truncated: false, total_count: tickets.length }));
  await page.goto(path);
  await page.waitForLoadState('networkidle').catch(() => undefined);
}

const shot = (page: Page, name: string) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });

test('My tickets: one list, soonest first, greyed at the bottom, past dropped', async ({ page }) => {
  await open(page, '/account/my-tickets', ALL);
  await expect(page.getByTestId('my-tickets-list')).toBeVisible({ timeout: 45_000 });
  const titles = await page.getByTestId('my-ticket').locator('h3').allInnerTexts();
  expect(titles).toEqual(['Saturday Bachata (part refunded)', 'Tonight (used)', 'Cancelled Thursday', 'Refunded Sunday Party']);
  await expect(page.getByText('£12.50 refunded, usually 5 to 10 working days to reach your card')).toBeVisible();
  await expect(page.getByText('The organiser will be in touch about refunds')).toBeVisible();
  await expect(page.getByText('Part refunded £5', { exact: true })).toBeVisible();
  await expect(page.getByTestId('my-ticket-tag')).toHaveText(['Used', 'Refunded']);
  await expectNoHorizontalScroll(page);
  await shot(page, '1-my-tickets-list');
  for (const [i, name] of [[2, '2-cancelled-card'], [1, '3-used-card'], [3, '4-refunded-card'], [0, '5-part-refund-card']] as const) {
    await page.getByTestId('my-ticket').nth(i).screenshot({ path: `${OUT}/${name}.png` });
  }
});

test('My tickets: only past tickets = empty state with one browse button', async ({ page }) => {
  await open(page, '/account/my-tickets', [row({ occurrence_date: '2026-11-01' })]);
  await expect(page.getByText('No tickets yet')).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId('my-tickets-state').getByRole('link')).toHaveText(['Browse events']);
  await shot(page, '6-empty-state');
});
