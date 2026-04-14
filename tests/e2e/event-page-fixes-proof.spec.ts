/**
 * BROWSER PROOF: Event Page Fixes (April 2026 pass)
 *
 * Proves 4 fixes via network intercept — no DB writes required.
 * Each test injects a controlled RPC response and asserts frontend rendering.
 *
 * Fix 1: schedule.timeLabel renders in Schedule section
 * Fix 2: schedule.timezoneLabel renders alongside timeLabel
 * Fix 3: identityLocation shows "Venue, City" when both exist
 * Fix 4: hero uses gallery[0] before monogram when no cover/organiser/venue image
 */

import { test, expect } from '@playwright/test';

const SUPABASE_URL = 'https://stsdtacfauprzrdebmzg.supabase.co';
const EVENT_ID = 'cfee4831-e188-4862-b845-c1e4bd48e18d';
const EVENT_PAGE = `/event/${EVENT_ID}`;

// ---------------------------------------------------------------------------
// Minimal valid snapshot shape — overridden per test
// ---------------------------------------------------------------------------
function makeSnapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    event_id: EVENT_ID,
    occurrence_id: '56b6c308-3de3-4421-9e24-e6dc29b6b40d',
    event: {
      name: 'Proof Test Event',
      description: null,
      status: 'published',
      is_published: true,
      created_by: null,
      cover_image_url: null,
      hero_image_url: null,
      photo_urls: [],
      music_styles: [],
      key_times: null,
      meta_data_public: {},
      actions: {
        ticket_url: null,
        website_url: null,
        facebook_url: null,
        instagram_url: null,
        pricing: null,
      },
    },
    organisers: [],
    occurrences: [
      {
        occurrence_id: '56b6c308-3de3-4421-9e24-e6dc29b6b40d',
        starts_at: '2026-06-14T20:00:00+00:00',
        ends_at: '2026-06-14T23:00:00+00:00',
        local_date: '2026-06-14',
        timezone: 'Europe/London',
        is_cancelled: false,
        is_live: false,
        is_past: false,
        is_upcoming: true,
        lineup: { teachers: [], djs: [], dancers: [], vendors: [], videographers: [] },
      },
    ],
    occurrence_effective: {
      occurrence_id: '56b6c308-3de3-4421-9e24-e6dc29b6b40d',
      starts_at: '2026-06-14T20:00:00+00:00',
      ends_at: '2026-06-14T23:00:00+00:00',
      local_date: '2026-06-14',
      timezone: 'Europe/London',
      is_cancelled: false,
      is_live: false,
      is_past: false,
      is_upcoming: true,
      lineup: { teachers: [], djs: [], dancers: [], vendors: [], videographers: [] },
    },
    location_default: {
      city: { id: 'city-1', name: 'London', slug: 'london-gb' },
      venue: {
        id: 'venue-1',
        name: 'The Venue',
        address_line: '1 Dance Street',
        postcode: 'W1A 1AA',
        google_maps_link: null,
        image_url: null,
        gallery_urls: [],
        transport_json: null,
        description: null,
        capacity: null,
        floor_type: null,
        facilities_new: [],
        timezone: 'Europe/London',
      },
      timezone: 'Europe/London',
    },
    attendance: {
      going_count: 0,
      current_user_status: null,
      preview: [],
    },
    ...overrides,
  };
}

async function interceptWithSnapshot(
  page: import('@playwright/test').Page,
  snapshot: Record<string, unknown>,
) {
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/get_event_page_snapshot*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(snapshot),
    });
  });
}

// ---------------------------------------------------------------------------
// Fix 1: timeLabel renders in Schedule section
// ---------------------------------------------------------------------------
test('Fix 1: Schedule section renders timeLabel (start–end time)', async ({ page }) => {
  await interceptWithSnapshot(page, makeSnapshot());
  await page.goto(`http://127.0.0.1:4173${EVENT_PAGE}`);
  await page.waitForSelector('text=Schedule', { timeout: 12000 });

  // occurrence_effective.starts_at = 20:00 UTC → "8:00 PM", ends_at = 23:00 → "11:00 PM"
  const timeText = page.locator('section', { hasText: 'Schedule' }).getByText(/PM/);
  await expect(timeText.first()).toBeVisible({ timeout: 5000 });
  console.log('✅ Fix 1 PASS: timeLabel visible in Schedule section');
});

// ---------------------------------------------------------------------------
// Fix 2: timezoneLabel renders alongside timeLabel
// ---------------------------------------------------------------------------
test('Fix 2: Schedule section renders timezoneLabel', async ({ page }) => {
  await interceptWithSnapshot(page, makeSnapshot());
  await page.goto(`http://127.0.0.1:4173${EVENT_PAGE}`);
  await page.waitForSelector('text=Schedule', { timeout: 12000 });

  // timezone = 'Europe/London' — rendered as raw tz string
  const tzText = page.locator('section', { hasText: 'Schedule' }).getByText('Europe/London');
  await expect(tzText.first()).toBeVisible({ timeout: 5000 });
  console.log('✅ Fix 2 PASS: timezoneLabel visible in Schedule section');
});

// ---------------------------------------------------------------------------
// Fix 3: identityLocation shows "Venue, City" when both exist
// ---------------------------------------------------------------------------
test('Fix 3: Identity shows "The Venue, London" location label', async ({ page }) => {
  await interceptWithSnapshot(page, makeSnapshot());
  await page.goto(`http://127.0.0.1:4173${EVENT_PAGE}`);
  await page.waitForSelector('text=Proof Test Event', { timeout: 12000 });

  const locationLabel = page.getByText('The Venue, London');
  await expect(locationLabel.first()).toBeVisible({ timeout: 5000 });
  console.log('✅ Fix 3 PASS: identityLocation shows "The Venue, London"');
});

// ---------------------------------------------------------------------------
// Fix 4: Hero uses gallery[0] before monogram when no cover/organiser/venue image
// ---------------------------------------------------------------------------
test('Fix 4: Hero uses gallery[0] image before falling back to monogram', async ({ page }) => {
  const GALLERY_IMAGE = 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=800';

  const snapshot = makeSnapshot({
    event: {
      ...makeSnapshot().event as Record<string, unknown>,
      photo_urls: [GALLERY_IMAGE],
      cover_image_url: null,
      hero_image_url: null,
    },
  });

  await interceptWithSnapshot(page, snapshot);
  await page.goto(`http://127.0.0.1:4173${EVENT_PAGE}`);
  await page.waitForSelector('text=Proof Test Event', { timeout: 12000 });

  // Hero image alt is set to the event name; if gallery[0] is used it renders an <img>
  const heroImg = page.locator('img[alt="Proof Test Event"]');
  await expect(heroImg.first()).toBeVisible({ timeout: 8000 });

  const src = await heroImg.first().getAttribute('src');
  expect(src).toContain('unsplash');
  console.log('✅ Fix 4 PASS: Hero renders gallery[0] image, not monogram');
});
