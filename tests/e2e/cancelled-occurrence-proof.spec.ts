/**
 * BROWSER PROOF: Cancelled Occurrence Fix
 *
 * Method: Playwright intercepts the get_event_page_snapshot_v2 RPC and returns
 * a static v2-shaped mock with occurrence_effective.is_cancelled = true. This
 * tests the *frontend* rendering in a real Chromium browser — the only part
 * under test.
 */

import { test, expect } from '@playwright/test';

const SUPABASE_URL = 'https://stsdtacfauprzrdebmzg.supabase.co';
const EVENT_ID = 'cfee4831-e188-4862-b845-c1e4bd48e18d'; // Mock Party [23:39:41]
const OCCURRENCE_ID = '56b6c308-3de3-4421-9e24-e6dc29b6b40d';
const EVENT_PAGE = `/event/${EVENT_ID}`;

// ── v2 static mock: cancelled occurrence ────────────────────────────────────
const MOCK_V2_SNAPSHOT_CANCELLED = {
  event_id: EVENT_ID,
  occurrence_id: OCCURRENCE_ID,
  event: {
    name: 'Mock Party',
    description: null,
    date: null,
    type: null,
    timezone: 'Europe/London',
    city_slug: null,
    location: null,
    status: 'published',
    is_published: true,
    created_by: null,
    cover_image_url: null,
    hero_image_url: null,
    poster_url: null,
    photo_urls: [],
    music_styles: [],
    payment_methods: null,
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
      occurrence_id: OCCURRENCE_ID,
      starts_at: '2026-06-01T20:00:00.000Z',
      ends_at: '2026-06-02T04:00:00.000Z',
      local_date: '2026-06-01',
      timezone: 'Europe/London',
      is_cancelled: true,
      is_live: false,
      is_past: false,
      is_upcoming: true,
      lineup: {
        teachers: [],
        djs: [],
        dancers: [],
        vendors: [],
        videographers: [],
      },
    },
  ],
  occurrence_effective: {
    occurrence_id: OCCURRENCE_ID,
    starts_at: '2026-06-01T20:00:00.000Z',
    ends_at: '2026-06-02T04:00:00.000Z',
    local_date: '2026-06-01',
    timezone: 'Europe/London',
    is_cancelled: true,
    is_live: false,
    is_past: false,
    is_upcoming: true,
    lineup: {
      teachers: [],
      djs: [],
      dancers: [],
      vendors: [],
      videographers: [],
    },
  },
  location_default: {
    city: null,
    venue: null,
    timezone: 'Europe/London',
  },
  attendance: {
    going_count: 5,
    interested_count: 0,
    current_user_status: null,
    preview: [],
  },
};

// ── helper: intercept the RPC and return the cancelled mock ─────────────────
async function interceptAsCancelled(page: import('@playwright/test').Page) {
  await page.route(
    `${SUPABASE_URL}/rest/v1/rpc/get_event_page_snapshot_v2*`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_V2_SNAPSHOT_CANCELLED),
      });
    }
  );
}

// ── PROOF 0: Verify real RPC baseline (non-cancelled control group) ──────────
// Uses a known-good event that exists in the remote DB and returns v2 data
const CONTROL_EVENT_ID = '2a1522d2-7cb6-4ee2-8c46-c75014b86ba0'; // Mock Party — has 1 organiser with avatar

test('CONTROL: real RPC returns is_cancelled=false on non-cancelled event', async ({ page }) => {
  let rpcBody: Record<string, unknown> | null = null;

  page.on('response', async (resp) => {
    if (resp.url().includes('get_event_page_snapshot_v2') && resp.status() === 200) {
      try { rpcBody = await resp.json(); } catch { /* ignore */ }
    }
  });

  await page.goto(`http://127.0.0.1:4173/event/${CONTROL_EVENT_ID}`);
  await page.waitForTimeout(4000);

  expect(rpcBody, 'RPC must have responded').not.toBeNull();
  // occurrence_effective may be null when the event has no occurrences — default to false
  // @ts-expect-error dynamic
  const isCancelled = rpcBody?.occurrence_effective?.is_cancelled ?? false;
  expect(isCancelled).toBe(false);

  console.log('✅ CONTROL: occurrence_effective.is_cancelled = false (real RPC)');
});

// ── MAIN PROOF SUITE: all 7 behaviours with injected is_cancelled=true ───────
test.describe('PROOF: Cancelled-occurrence frontend rendering', () => {
  test.beforeEach(async ({ page }) => {
    await interceptAsCancelled(page);
    await page.goto(`http://127.0.0.1:4173${EVENT_PAGE}`);
    // Wait for event page sections to render
    await page.waitForSelector('text=Schedule', { timeout: 12000 });
  });

  // ── Proof 1: Cancelled badge visible ─────────────────────────────────────
  test('1: Cancelled badge is visible in Schedule section', async ({ page }) => {
    const badge = page.locator('text=CANCELLED').or(page.locator('text=Cancelled'));
    await expect(badge.first()).toBeVisible({ timeout: 5000 });
    console.log('✅ PROOF 1 PASS: Cancelled badge visible');
  });

  // ── Proof 2: Attendance section still visible ─────────────────────────────
  test('2: Attendance section remains visible', async ({ page }) => {
    const attendanceSection = page.locator('section:has-text("Attendance")');
    await expect(attendanceSection).toBeVisible({ timeout: 5000 });
    console.log('✅ PROOF 2 PASS: Attendance section visible');
  });

  // ── Proof 3: RSVP button label shows "Event Cancelled" ───────────────────
  test('3: RSVP button label shows "Event Cancelled"', async ({ page }) => {
    const cancelledButton = page.getByRole('button', { name: 'Event Cancelled' });
    await expect(cancelledButton).toBeVisible({ timeout: 5000 });
    console.log('✅ PROOF 3 PASS: Button shows "Event Cancelled"');
  });

  // ── Proof 4: RSVP button is disabled ─────────────────────────────────────
  test('4: RSVP button is disabled', async ({ page }) => {
    const cancelledButton = page.getByRole('button', { name: 'Event Cancelled' });
    await expect(cancelledButton).toBeDisabled({ timeout: 5000 });
    console.log('✅ PROOF 4 PASS: Button is disabled');
  });

  // ── Proof 5: Helper text is visible ──────────────────────────────────────
  test('5: Helper text "no longer accepting RSVPs" is visible', async ({ page }) => {
    const helperText = page.locator('text=no longer accepting RSVPs');
    await expect(helperText).toBeVisible({ timeout: 5000 });
    console.log('✅ PROOF 5 PASS: Helper text visible');
  });

  // ── Proof 6: Click does not fire an RSVP request ─────────────────────────
  test('6: Clicking disabled button fires no RSVP network request', async ({ page }) => {
    const rsvpRequests: string[] = [];

    page.on('request', (req) => {
      if (req.url().includes('event_attendance') || req.url().includes('rpc/toggle')) {
        rsvpRequests.push(req.url());
      }
    });

    const cancelledButton = page.getByRole('button', { name: 'Event Cancelled' });
    await expect(cancelledButton).toBeVisible();

    // Attempt to click (HTML disabled attribute prevents it, but we try)
    await cancelledButton.click({ force: true, timeout: 2000 }).catch(() => {});

    // Wait a beat for any async request to potentially fire
    await page.waitForTimeout(1500);

    expect(rsvpRequests).toHaveLength(0);
    console.log('✅ PROOF 6 PASS: No RSVP network request fired');
  });

  // ── Proof 7: Auth redirect does NOT auto-RSVP cancelled occurrence ────────
  test('7: Auth redirect with attendanceRedirect state does not fire RSVP', async ({ page }) => {
    const rsvpRequests: string[] = [];

    page.on('request', (req) => {
      if (req.url().includes('event_attendance')) {
        rsvpRequests.push(req.url());
      }
    });

    // Navigate with the attendance redirect query params that EventDetail.tsx reads
    // This simulates the post-auth redirect that would normally trigger auto-RSVP
    const redirectUrl = `http://127.0.0.1:4173${EVENT_PAGE}?occurrenceId=${OCCURRENCE_ID}&intent=attendance&attendanceAction=going&attendanceEventId=${EVENT_ID}&attendanceOccurrenceId=${OCCURRENCE_ID}`;
    await page.goto(redirectUrl);
    await page.waitForSelector('text=Schedule', { timeout: 12000 });

    // Wait for the useEffect to settle
    await page.waitForTimeout(3000);

    expect(rsvpRequests).toHaveLength(0);
    console.log('✅ PROOF 7 PASS: No auto-RSVP fired on cancelled occurrence');
  });
});
