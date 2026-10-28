import { test, expect } from '@playwright/test';
// Needs the flag at dev-server start: VITE_ENABLE_PUBLIC_TICKETING=true npx playwright test tests/e2e/ticket-thanks.spec.ts --project=chromium
// Not in the test:e2e gate list: the flag is off there, so the route is a 404 by design.
import { PHONE, OrganiserFake, expectNoHorizontalScroll, json } from './helpers/organiserFake';

// /tickets/thanks at 390x844: the order read (ticket_order_public_status_v1) is mocked at the
// network layer. Card, text and the back link must sit inside the viewport.

const ORDER = '3f2b8c1e-5a47-4d1b-9c2e-7a6b5c4d3e2f';

async function open(page: import('@playwright/test').Page, reply: unknown) {
  await new OrganiserFake({ noOrganiser: true }).install(page);
  await page.route('**/rest/v1/rpc/ticket_order_public_status_v1', (r) => json(r, reply));
  await page.goto(`/tickets/thanks?o=${ORDER}`);
}

async function insideViewport(page: import('@playwright/test').Page, loc: import('@playwright/test').Locator) {
  const box = await loc.boundingBox();
  const vp = page.viewportSize()!;
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height);
}

test.describe('ticket thank-you 390x844', () => {
  test.use({ viewport: PHONE });

  test('paid: confirmed copy, back link is a 44px tap target in view', async ({ page }) => {
    await open(page, { status: 'paid', ticket_count: 2, event_title: 'Friday Social', event_date: '2026-11-06' });
    const h = page.getByText('Confirmed. Your tickets are in your email.');
    await expect(h).toBeVisible();
    await expect(page.getByText('2 tickets for Friday Social')).toBeVisible();
    await insideViewport(page, h);
    const back = page.getByRole('link', { name: /Back to what/ });
    await expect(back).toHaveAttribute('href', '/');
    await insideViewport(page, back);
    expect((await back.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expectNoHorizontalScroll(page);
  });

  test('failed: says so and offers Back', async ({ page }) => {
    await open(page, { status: 'failed', ticket_count: null, event_title: 'Friday Social', event_date: null });
    await expect(page.getByText("Payment didn't go through")).toBeVisible();
    const back = page.getByRole('link', { name: 'Back', exact: true });
    await insideViewport(page, back);
  });

  test('unknown: neutral copy, never Confirmed', async ({ page }) => {
    await open(page, { status: 'unknown', ticket_count: null, event_title: null, event_date: null });
    await expect(page.getByText(/Confirmed\./)).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });
});
