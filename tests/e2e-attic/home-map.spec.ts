import { test, expect } from '@playwright/test';

const SUPABASE_URL = 'https://stsdtacfauprzrdebmzg.supabase.co';
const HOME_PATH = '/city/london-gb';

// Fixture shape notes:
//  - 0001 "Saturday Social" has the earliest date so it is the first All-Events
//    card (desktop card-tap test depends on this).
//  - 0003 "Mix Night" is a Class & Party event with split times AND is placed far
//    east, isolated, so it stays an individual pin (never clustered) -- the
//    single-pin preview + split-segment assertions target it.
//  - 0004/0005 share identical coords so they ALWAYS form one cluster bubble --
//    the cluster-preview assertion targets it.
const MAP_EVENTS = [
  {
    occurrence_id: 'map-occ-1',
    event_id: '00000000-0000-0000-0000-000000000001',
    name: 'Saturday Social',
    cover_image_url: null,
    venue_name: 'Ministry of Sound',
    area: null,
    city_slug: 'london-gb',
    lat: 51.5,
    lng: -0.075,
    instance_date: '2026-06-21',
    start_time: '2026-06-21T20:00:00+00:00',
    end_time: '2026-06-22T01:00:00+00:00',
    type: 'party',
    has_party: true,
    has_class: false,
    class_start: null,
    class_end: null,
    party_start: null,
    party_end: null,
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
    lat: 51.516,
    lng: -0.105,
    instance_date: '2026-06-22',
    start_time: '2026-06-22T14:00:00+00:00',
    end_time: '2026-06-22T18:00:00+00:00',
    type: 'class',
    has_party: false,
    has_class: true,
    class_start: null,
    class_end: null,
    party_start: null,
    party_end: null,
    created_at: '2026-06-09T08:00:00+00:00',
    updated_at: '2026-06-09T08:00:00+00:00',
    is_cancelled: false,
    cancellation_reason_label: null,
  },
  {
    occurrence_id: 'map-occ-3',
    event_id: '00000000-0000-0000-0000-000000000003',
    name: 'Mix Night',
    cover_image_url: null,
    venue_name: 'Riverside Rooms',
    area: null,
    city_slug: 'london-gb',
    lat: 51.512,
    lng: -0.06,
    instance_date: '2026-06-23',
    start_time: '2026-06-23T19:30:00+00:00',
    end_time: '2026-06-24T00:00:00+00:00',
    type: 'social',
    has_party: true,
    has_class: true,
    class_start: '19:30',
    class_end: '20:30',
    party_start: '20:30',
    party_end: '00:00',
    created_at: '2026-06-09T07:00:00+00:00',
    updated_at: '2026-06-09T07:00:00+00:00',
    is_cancelled: false,
    cancellation_reason_label: null,
  },
  {
    occurrence_id: 'map-occ-4',
    event_id: '00000000-0000-0000-0000-000000000004',
    name: 'Westside Warmup',
    cover_image_url: null,
    venue_name: 'West Hall',
    area: null,
    city_slug: 'london-gb',
    lat: 51.508,
    lng: -0.09,
    instance_date: '2026-06-24',
    start_time: '2026-06-24T20:00:00+00:00',
    end_time: '2026-06-25T00:00:00+00:00',
    type: 'party',
    has_party: true,
    has_class: false,
    class_start: null,
    class_end: null,
    party_start: null,
    party_end: null,
    created_at: '2026-06-09T06:00:00+00:00',
    updated_at: '2026-06-09T06:00:00+00:00',
    is_cancelled: false,
    cancellation_reason_label: null,
  },
  {
    occurrence_id: 'map-occ-5',
    event_id: '00000000-0000-0000-0000-000000000005',
    name: 'Westside Class',
    cover_image_url: null,
    venue_name: 'West Hall',
    area: null,
    city_slug: 'london-gb',
    lat: 51.508,
    lng: -0.09,
    instance_date: '2026-06-25',
    start_time: '2026-06-25T19:00:00+00:00',
    end_time: '2026-06-25T21:00:00+00:00',
    type: 'class',
    has_party: false,
    has_class: true,
    class_start: null,
    class_end: null,
    party_start: null,
    party_end: null,
    created_at: '2026-06-09T05:00:00+00:00',
    updated_at: '2026-06-09T05:00:00+00:00',
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
  // Live global festivals (events table, queried via PostgREST) -- stub to []
  // so real remote festivals can't pollute the deterministic fixture list or its
  // date ordering (the first All-Events card must stay event 0001).
  await context.route(/\/rest\/v1\/events\?/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
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

  test('page head shows the colour-coded tagline, no week count', async ({ context, page }) => {
    await installMocks(context);
    await page.goto(HOME_PATH);
    await expect(page.locator('.home-map__canvas')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('in one place.')).toBeVisible();
    // The "N this week" count is desktop-only now.
    await expect(page.getByText(/this week/i)).toHaveCount(0);
  });

  test('feed has no in-feed search field (omnibox replaces it on mobile)', async ({ context, page }) => {
    await installMocks(context);
    await page.goto(HOME_PATH);
    await expect(page.locator('.home-map__canvas')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('input[placeholder="Search events, venues..."]')).toHaveCount(0);
  });

  test('header search pill is visible and expands the omnibox', async ({ context, page }) => {
    await installMocks(context);
    await page.goto(HOME_PATH);
    await expect(page.locator('.home-map__canvas')).toBeVisible({ timeout: 15_000 });
    const trigger = page.getByRole('button', { name: 'Search' });
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(page.getByLabel('Search events, venues and people')).toBeVisible();
  });

  test('a Class & Party event shows split Class / Party time segments', async ({ context, page }) => {
    await installMocks(context);
    await page.goto(HOME_PATH);
    await expect(page.locator('.home-map__canvas')).toBeVisible({ timeout: 15_000 });
    const row = page.getByRole('button', { name: /Mix Night/ });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row).toContainText('Class');
    await expect(row).toContainText('Party');
  });

  test('tapping a pin opens an inline preview (no Leaflet popup) that navigates', async ({ context, page }) => {
    await installMocks(context);
    await page.goto(HOME_PATH);
    await expect(page.locator('.home-map__canvas')).toBeVisible({ timeout: 15_000 });
    const pin = page.locator('.leaflet-marker-icon[title*="Mix Night"]');
    await expect(pin).toBeVisible({ timeout: 15_000 });
    await pin.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Mix Night');
    // Mobile uses the inline card, never a Leaflet popup.
    await expect(page.locator('.leaflet-popup')).toHaveCount(0);
    // Tapping the preview routes to the event page.
    await dialog.locator('[data-occ]').first().click();
    await expect(page).toHaveURL(/\/event\/00000000-0000-0000-0000-000000000003/, { timeout: 10_000 });
  });

  test('tapping a cluster lists its events in the preview', async ({ context, page }) => {
    await installMocks(context);
    await page.goto(HOME_PATH);
    await expect(page.locator('.home-map__canvas')).toBeVisible({ timeout: 15_000 });
    const cluster = page.locator('.leaflet-marker-icon.rcl').first();
    await expect(cluster).toBeVisible({ timeout: 15_000 });
    await cluster.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // The two coincident events both appear as rows.
    await expect(dialog.locator('[data-occ]')).toHaveCount(2);
  });

  test('the map stays put while the feed scrolls', async ({ context, page }) => {
    await installMocks(context);
    await page.goto(HOME_PATH);
    await expect(page.locator('.home-map__canvas')).toBeVisible({ timeout: 15_000 });
    const card = page.locator('.hm-mapcard');
    const before = await card.boundingBox();
    await page.locator('#hm-rail-panel').evaluate((el) => el.scrollBy(0, 200));
    const after = await card.boundingBox();
    expect(after?.y).toBeCloseTo(before?.y ?? 0, 0);
  });

  test('a background-map tap clears an open preview', async ({ context, page }) => {
    await installMocks(context);
    await page.goto(HOME_PATH);
    await expect(page.locator('.home-map__canvas')).toBeVisible({ timeout: 15_000 });
    const pin = page.locator('.leaflet-marker-icon[title*="Mix Night"]');
    await expect(pin).toBeVisible({ timeout: 15_000 });
    await pin.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    // Tapping empty map -> EventMap onSelect(null) -> preview clears.
    await page.locator('.home-map__canvas').click({ position: { x: 6, y: 6 } });
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('Escape and the close button each dismiss the preview', async ({ context, page }) => {
    await installMocks(context);
    await page.goto(HOME_PATH);
    await expect(page.locator('.home-map__canvas')).toBeVisible({ timeout: 15_000 });
    const pin = page.locator('.leaflet-marker-icon[title*="Mix Night"]');
    await expect(pin).toBeVisible({ timeout: 15_000 });
    await pin.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // Re-open and dismiss via the close button.
    await pin.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Close preview' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('expand / collapse toggles the fullscreen map', async ({ context, page }) => {
    await installMocks(context);
    await page.goto(HOME_PATH);
    await expect(page.locator('.home-map__canvas')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('in one place.')).toBeVisible();
    await page.getByRole('button', { name: 'Explore the full map' }).click();
    // Page head + feed unmount in fullscreen.
    await expect(page.getByText('in one place.')).toHaveCount(0);
    await expect(page.getByRole('tablist')).toHaveCount(0);
    await page.getByRole('button', { name: 'Back to the list' }).click();
    await expect(page.getByText('in one place.')).toBeVisible();
    await expect(page.getByRole('tablist')).toBeVisible();
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
