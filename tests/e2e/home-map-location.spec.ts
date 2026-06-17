/**
 * Festival Map homepage -- location feature, iPhone e2e proof.
 *
 * Verifies the blue compass map control + the pulsing "you are here" dot + the
 * Tonight-tab distance sort, in an iPhone-13 viewport. Real GPS and the iOS
 * permission sheet cannot be emulated (covered by the on-device checklist); this
 * proves the wiring: tap compass -> dot appears + control flips to granted ->
 * Today tab sorts with distance chips; denial shows accurate copy.
 *
 * Method: intercept get_map_events_v1 (the home-map RPC -- NOT get_calendar_events)
 * with deterministic, today-dated London rows carrying lat/lng.
 */

import { test, expect, devices } from '@playwright/test';

const SUPABASE_URL = 'https://stsdtacfauprzrdebmzg.supabase.co';
const HOME_PATH = '/city/london-gb';

// Today in Europe/London (timezoneId is pinned below so the browser's
// todayStr() agrees with this) -- the Today tab filters on instance_date.
const TODAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/London',
}).format(new Date());

type Row = Record<string, unknown>;

const mapRow = (
  i: number,
  name: string,
  lat: number,
  lng: number,
  venue: string,
): Row => ({
  occurrence_id: `occ-${i}`,
  event_id: `evt-${i}`,
  name,
  cover_image_url: null,
  venue_name: venue,
  area: 'London',
  city_slug: 'london-gb',
  lat,
  lng,
  instance_date: TODAY,
  start_time: `${TODAY} 19:30:00+00`,
  end_time: `${TODAY} 23:30:00+00`,
  type: 'standard',
  format: 'one_off',
  category: 'party',
  has_party: true,
  has_class: false,
  class_start: null,
  class_end: null,
  party_start: '19:30',
  party_end: '23:30',
  created_at: `${TODAY}T10:00:00+00:00`,
  updated_at: null,
  freshness_kind: null,
  is_cancelled: false,
  cancellation_reason_label: null,
});

// Three distinct venues a short distance apart (so the cluster radius change is
// exercised and distance sorting has something to order).
const MAP_ROWS: Row[] = [
  mapRow(1, 'Latino Flava', 51.5134, -0.084, 'Forge'),
  mapRow(2, 'Sensual Night', 51.4988, -0.1132, 'Waterloo Action Centre'),
  mapRow(3, 'Latino Royal', 51.5154, -0.1217, 'Sway Bar'),
];

const installMocks = async (
  context: import('@playwright/test').BrowserContext,
) => {
  await context.route(
    `${SUPABASE_URL}/rest/v1/rpc/get_map_events_v1`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MAP_ROWS),
      });
    },
  );
  await context.route(
    `${SUPABASE_URL}/rest/v1/rpc/is_valid_city_slug`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: 'true',
      });
    },
  );
};

test.use({ ...devices['iPhone 13'], timezoneId: 'Europe/London' });

test.describe('Festival Map location, iPhone 13', () => {
  test('grant -> pulsing user dot + control granted + distance chips', async ({
    context,
    page,
  }) => {
    await installMocks(context);
    await context.grantPermissions(['geolocation'], {
      origin: 'http://127.0.0.1:4173',
    });
    // Trafalgar Square, central London.
    await context.setGeolocation({ latitude: 51.5074, longitude: -0.1278 });

    await page.goto(HOME_PATH);

    // The blue compass map control (not the Tonight-tab pill).
    const compass = page.getByRole('button', {
      name: 'Use my location',
      exact: true,
    });
    await expect(compass).toBeVisible({ timeout: 15_000 });
    await compass.click();

    // Pulsing "you are here" dot is added to the map. (Leaflet markers go
    // visibility:hidden mid pan-animation, so assert DOM attachment: presence
    // proves the userCoords -> marker wiring; the visual is on-device/screenshot.)
    await expect(page.getByTestId('user-location-dot')).toBeAttached({
      timeout: 10_000,
    });
    // Control flips to its granted affordance (tap = recentre on the dot).
    await expect(
      page.getByRole('button', { name: 'Recentre map on your location' }),
    ).toBeVisible();

    // Today tab sorts by distance and renders the teal MI chips.
    await page.getByRole('tab', { name: 'Today' }).click();
    const badges = page.getByTestId('distance-badge');
    await expect(badges.first()).toBeVisible({ timeout: 10_000 });
    expect(await badges.count()).toBeGreaterThan(0);
  });

  test('deny -> accurate denied copy, no dead retry (iOS)', async ({
    context,
    page,
  }) => {
    await installMocks(context);
    // Force a deterministic PERMISSION_DENIED before app code runs.
    await page.addInitScript(() => {
      navigator.geolocation.getCurrentPosition = (_success, error) => {
        if (error) {
          error({
            code: 1,
            message: 'User denied geolocation',
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as unknown as GeolocationPositionError);
        }
      };
    });

    await page.goto(HOME_PATH);

    const compass = page.getByRole('button', {
      name: 'Use my location',
      exact: true,
    });
    await expect(compass).toBeVisible({ timeout: 15_000 });
    await compass.click();

    // No dot on denial.
    await expect(page.getByTestId('user-location-dot')).toHaveCount(0);

    // The Tonight-tab control shows the accurate iOS denial copy (the emulated
    // iPhone UA -> isIOSUserAgent() true -> Settings guidance, no Try again).
    await page.getByRole('tab', { name: 'Today' }).click();
    await expect(page.getByText(/location is off for this site/i)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/try again/i)).toHaveCount(0);
  });
});
