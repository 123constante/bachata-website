/**
 * Tonight page — "near me" location feature, mobile e2e proof.
 *
 * Method: intercept the get_calendar_events RPC with a deterministic
 * set of London events with venue lat/lng, then exercise the three
 * paths in iPhone-13 viewport:
 *   1. geolocation granted (Playwright permission + setGeolocation)
 *   2. geolocation denied (Playwright permission denied)
 *   3. postcode fallback success + invalid-postcode error
 */

import { test, expect, devices } from '@playwright/test';

const SUPABASE_URL = 'https://stsdtacfauprzrdebmzg.supabase.co';
const TONIGHT_PATH = '/city/london-gb/tonight';

const TONIGHT_ROWS = [
  {
    event_id: '460e499a-4915-4af2-b62a-d1e7b84e0ffd',
    name: 'Latino Flava Wednesdays',
    photo_url: [],
    location: 'Forge',
    instance_date: '2026-05-13',
    start_time: '2026-05-13T19:30:00+00:00',
    end_time: '2026-05-13T23:30:00+00:00',
    is_recurring: false,
    meta_data: {},
    key_times: { party: { start: '19:30', end: '23:30', active: true } },
    type: 'party',
    has_party: true,
    has_class: false,
    class_start: null,
    class_end: null,
    party_start: '19:30',
    party_end: '23:30',
    city_slug: 'london-gb',
    cover_image_url: null,
    occurrence_id: 'a1',
    occurrence_starts_at: '2026-05-13T19:30:00+00:00',
    occurrence_ends_at: '2026-05-13T23:30:00+00:00',
    city_timezone: 'Europe/London',
    venue_lat: 51.5134,
    venue_lng: -0.084,
    primary_organiser_name: null,
  },
  {
    event_id: '7446ec07-843c-4f55-b0ba-624992d20044',
    name: 'Sensual Wednesdays',
    photo_url: [],
    location: 'Waterloo Action Centre',
    instance_date: '2026-05-13',
    start_time: '2026-05-13T18:30:00+00:00',
    end_time: '2026-05-13T22:30:00+00:00',
    is_recurring: false,
    meta_data: {},
    key_times: { party: { start: '18:30', end: '22:30', active: true } },
    type: 'party',
    has_party: true,
    has_class: false,
    class_start: null,
    class_end: null,
    party_start: '18:30',
    party_end: '22:30',
    city_slug: 'london-gb',
    cover_image_url: null,
    occurrence_id: 'a2',
    occurrence_starts_at: '2026-05-13T18:30:00+00:00',
    occurrence_ends_at: '2026-05-13T22:30:00+00:00',
    city_timezone: 'Europe/London',
    venue_lat: 51.4988,
    venue_lng: -0.1132,
    primary_organiser_name: null,
  },
  {
    event_id: '8fac4298-17ba-4a98-92ed-64bbc85c0cc6',
    name: 'Latino Royal',
    photo_url: [],
    location: 'Sway Bar',
    instance_date: '2026-05-13',
    start_time: '2026-05-13T19:00:00+00:00',
    end_time: '2026-05-13T23:00:00+00:00',
    is_recurring: false,
    meta_data: {},
    key_times: { party: { start: '19:00', end: '23:00', active: true } },
    type: 'party',
    has_party: true,
    has_class: false,
    class_start: null,
    class_end: null,
    party_start: '19:00',
    party_end: '23:00',
    city_slug: 'london-gb',
    cover_image_url: null,
    occurrence_id: 'a3',
    occurrence_starts_at: '2026-05-13T19:00:00+00:00',
    occurrence_ends_at: '2026-05-13T23:00:00+00:00',
    city_timezone: 'Europe/London',
    venue_lat: 51.5154,
    venue_lng: -0.1217,
    primary_organiser_name: null,
  },
];

const installRpcMock = async (
  context: import('@playwright/test').BrowserContext,
) => {
  await context.route(
    `${SUPABASE_URL}/rest/v1/rpc/get_calendar_events`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(TONIGHT_ROWS),
      });
    },
  );
  // CityContext validates the slug — let it succeed.
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

test.use({ ...devices['iPhone 13'] });

test.describe('Tonight near-me, iPhone 13', () => {
  test('geolocation granted -> distance badges + nearest summary', async ({
    context,
    page,
  }) => {
    await installRpcMock(context);
    await context.grantPermissions(['geolocation'], { origin: 'http://127.0.0.1:4173' });
    // Trafalgar Square, central London.
    await context.setGeolocation({ latitude: 51.5074, longitude: -0.1278 });

    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(TONIGHT_PATH);
    await page.getByRole('button', { name: /find events near me/i }).click();

    await expect(page.getByText('Sorted by distance from you')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId('tonight-nearest-summary')).toBeVisible();
    const badges = page.getByTestId('distance-badge');
    await expect(badges.first()).toBeVisible();
    expect(await badges.count()).toBeGreaterThan(0);

    expect(consoleErrors.filter((e) => !e.includes('favicon'))).toEqual([]);
  });

  test('geolocation denied -> postcode fallback with denied reason', async ({
    context,
    page,
  }) => {
    await installRpcMock(context);
    // No grantPermissions call => browser will deny when getCurrentPosition fires.
    // To force a deterministic denial, monkey-patch the API before app code runs.
    await page.addInitScript(() => {
      const origGet = navigator.geolocation.getCurrentPosition.bind(
        navigator.geolocation,
      );
      navigator.geolocation.getCurrentPosition = (_success, error) => {
        const err = {
          code: 1,
          message: 'User denied geolocation',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        } as unknown as GeolocationPositionError;
        if (error) error(err);
        return origGet as unknown as void;
      };
    });

    await page.goto(TONIGHT_PATH);
    await page.getByRole('button', { name: /find events near me/i }).click();

    await expect(
      page.getByText(/permission denied/i),
    ).toBeVisible({ timeout: 10_000 });
    // The CTA is replaced by the postcode form.
    await expect(page.getByPlaceholder(/SW1A 1AA/i)).toBeVisible();
  });

  test('postcode submit -> distance sort works; invalid postcode shows error', async ({
    context,
    page,
  }) => {
    await installRpcMock(context);
    // Mock postcodes.io: valid postcode returns Trafalgar Square; invalid 404s.
    await context.route('https://api.postcodes.io/postcodes/*', async (route) => {
      const url = route.request().url();
      if (url.endsWith('NOTAREAL')) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ status: 404, error: 'Postcode not found' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 200,
          result: { latitude: 51.5074, longitude: -0.1278 },
        }),
      });
    });

    await page.addInitScript(() => {
      navigator.geolocation.getCurrentPosition = (_success, error) => {
        if (error) {
          error({
            code: 1,
            message: 'denied',
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as unknown as GeolocationPositionError);
        }
      };
    });

    await page.goto(TONIGHT_PATH);
    await page.getByRole('button', { name: /find events near me/i }).click();
    await expect(page.getByPlaceholder(/SW1A 1AA/i)).toBeVisible();

    // Invalid postcode first.
    await page.getByPlaceholder(/SW1A 1AA/i).fill('NOTAREAL');
    await page.getByRole('button', { name: /use postcode/i }).click();
    await expect(page.getByText(/couldn't find that postcode/i)).toBeVisible({
      timeout: 10_000,
    });

    // Now a valid postcode.
    await page.getByPlaceholder(/SW1A 1AA/i).fill('SW1A 1AA');
    await page.getByRole('button', { name: /use postcode/i }).click();

    await expect(page.getByText('Sorted by distance from you')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId('tonight-nearest-summary')).toBeVisible();
    await expect(page.getByTestId('distance-badge').first()).toBeVisible();
  });
});
