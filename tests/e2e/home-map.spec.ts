import { test, expect } from '@playwright/test';

const SUPABASE_URL = 'https://stsdtacfauprzrdebmzg.supabase.co';
const HOME_PATH = '/city/london-gb';

const MAP_EVENTS = [
  {
    occurrence_id: 'map-occ-1',
    event_id: '00000000-0000-0000-0000-000000000001',
    name: 'Saturday Social',
    cover_image_url: null,
    venue_name: 'Ministry of Sound',
    area: null,
    city_slug: 'london-gb',
    lat: 51.4972,
    lng: -0.1002,
    instance_date: '2026-06-21',
    start_time: '2026-06-21T20:00:00+00:00',
    end_time: '2026-06-22T01:00:00+00:00',
    type: 'party',
    has_party: true,
    has_class: false,
    created_at: '2026-06-09T09:00:00+00:00',
    updated_at: '2026-06-09T09:00:00+00:00',
    is_cancelled: false,
    cancellation_reason_label: null,
  },
  {
    occurrence_id: 'map-occ-2',
    event_id: '00000000-0000-0000-0000-000000000002',
    name: 'Bachata Bootcamp',
    cover_image_url: null,
    venue_name: 'Dance Attic',
    area: null,
    city_slug: 'london-gb',
    lat: 51.5033,
    lng: -0.1195,
    instance_date: '2026-06-22',
    start_time: '2026-06-22T14:00:00+00:00',
    end_time: '2026-06-22T18:00:00+00:00',
    type: 'class',
    has_party: false,
    has_class: true,
    created_at: '2026-06-09T08:00:00+00:00',
    updated_at: '2026-06-09T08:00:00+00:00',
    is_cancelled: false,
    cancellation_reason_label: null,
  },
];

async function installMocks(context: import('@playwright/test').BrowserContext) {
  await context.route(
    `${SUPABASE_URL}/rest/v1/rpc/get_map_events_v1`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MAP_EVENTS),
      }),
  );
  await context.route(
    `${SUPABASE_URL}/rest/v1/rpc/is_valid_city_slug`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: 'true',
      }),
  );
}

test.describe('Festival Map Homepage -- mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('renders map canvas and opens on the All Events tab', async ({ context, page }) => {
    await installMocks(context);
    await page.goto(HOME_PATH);
    await expect(page.locator('.home-map__canvas')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('tablist')).toBeVisible();
    // Lead with events: All Events is the default tab.
    await expect(
      page.getByRole('tab', { name: 'All Events' }),
    ).toHaveAttribute('aria-selected', 'true');
  });

  test('can switch to the What\'s New tab', async ({ context, page }) => {
    await installMocks(context);
    await page.goto(HOME_PATH);
    await expect(page.locator('.home-map__canvas')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('tab', { name: "What's New" }).click();
    await expect(
      page.getByRole('tab', { name: "What's New" }),
    ).toHaveAttribute('aria-selected', 'true');
  });
});

test.describe('Festival Map Homepage -- desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('clicking an event card opens the event page', async ({ context, page }) => {
    await installMocks(context);
    await page.goto(HOME_PATH);
    await expect(page.locator('.home-map__canvas')).toBeVisible({ timeout: 15_000 });

    // Default tab is All Events; the first dated card is the soonest event.
    const firstCard = page.locator('[data-occ]').first();
    await expect(firstCard).toBeVisible({ timeout: 10_000 });
    await firstCard.click();

    // Audit P0: a card tap routes to the event detail page (not just a map fly).
    await expect(page).toHaveURL(/\/event\/00000000-0000-0000-0000-000000000001/, {
      timeout: 10_000,
    });
  });
});
