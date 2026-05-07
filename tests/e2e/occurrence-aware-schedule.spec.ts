/**
 * Phase C — occurrence-aware ScheduleBlock e2e proof.
 *
 * Primary signal (load-bearing): the public event page MUST call the
 * correct program RPC depending on whether ?occurrenceId=… is in the URL.
 *
 *   /event/:id                → get_event_program_v1 fires; occurrence RPC silent
 *   /event/:id?occurrenceId=… → get_occurrence_program_v1 fires; series RPC silent
 *
 * DOM-level checks alone can pass against the wrong RPC if the override
 * happens to coincide with the series state, so the network-routing
 * assertion stands alone as the regression gate.
 *
 * Strategy: mock get_event_page_snapshot_v2 minimally so the page renders
 * the schedule block, mock both program RPCs with distinguishable bodies,
 * then count requests and verify rendered DOM.
 */

import { test, expect, type Page, type Request } from '@playwright/test';

const SUPABASE_URL = 'https://stsdtacfauprzrdebmzg.supabase.co';
const EVENT_ID = 'cfee4831-e188-4862-b845-c1e4bd48e18d';
const OCCURRENCE_ID = '56b6c308-3de3-4421-9e24-e6dc29b6b40d';

const SNAPSHOT_MOCK = {
  event_id: EVENT_ID,
  occurrence_id: OCCURRENCE_ID,
  event: {
    name: 'Phase C Mock Event',
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
      is_cancelled: false,
      is_live: false,
      is_past: false,
      is_upcoming: true,
      lineup: { teachers: [], djs: [], dancers: [], vendors: [], videographers: [] },
    },
  ],
  occurrence_effective: {
    occurrence_id: OCCURRENCE_ID,
    starts_at: '2026-06-01T20:00:00.000Z',
    ends_at: '2026-06-02T04:00:00.000Z',
    local_date: '2026-06-01',
    timezone: 'Europe/London',
    is_cancelled: false,
    is_live: false,
    is_past: false,
    is_upcoming: true,
    lineup: { teachers: [], djs: [], dancers: [], vendors: [], videographers: [] },
  },
  location_default: { city: null, venue: null, timezone: 'Europe/London' },
  attendance: { going_count: 0, interested_count: 0, current_user_status: null, preview: [] },
};

// Distinguishable program rows. Series carries TWO rows (one of which the
// override will hide); occurrence carries ONE (the un-cancelled one). DOM
// assertions key off the unique titles.
const SERIES_PROGRAM = [
  {
    id: 'series-class',
    title: 'Series Class',
    type: 'class',
    start_time: '2026-06-01T19:00:00',
    end_time: '2026-06-01T20:00:00',
    sort_order: 1,
    levels: ['intermediate'],
    room: null,
    people: [],
    section_id: null,
    section_kind: null,
    section_label: null,
  },
  {
    id: 'series-cancelled',
    title: 'Cancelled In Override',
    type: 'class',
    start_time: '2026-06-01T20:00:00',
    end_time: '2026-06-01T21:00:00',
    sort_order: 2,
    levels: ['advanced'],
    room: null,
    people: [],
    section_id: null,
    section_kind: null,
    section_label: null,
  },
];

const OCCURRENCE_PROGRAM = [
  {
    id: 'series-class',
    title: 'Series Class',
    type: 'class',
    start_time: '2026-06-01T19:00:00',
    end_time: '2026-06-01T20:00:00',
    sort_order: 1,
    levels: ['intermediate'],
    room: null,
    people: [],
    section_id: null,
    section_kind: null,
    section_label: null,
  },
];

async function installRpcMocks(page: Page) {
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/get_event_page_snapshot_v2*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(SNAPSHOT_MOCK),
    }),
  );
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/get_event_program_v1*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(SERIES_PROGRAM),
    }),
  );
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/get_occurrence_program_v1*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(OCCURRENCE_PROGRAM),
    }),
  );
  // Sections RPC — empty array is fine (the schedule falls back to legacy
  // type-inference grouping, which still renders the cards).
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/get_event_program_sections_v1*`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
}

type RpcCounts = { event: number; occurrence: number };

function trackRpcCalls(page: Page): RpcCounts {
  const counts: RpcCounts = { event: 0, occurrence: 0 };
  page.on('request', (req: Request) => {
    const url = req.url();
    if (url.includes('/rpc/get_event_program_v1')) counts.event += 1;
    if (url.includes('/rpc/get_occurrence_program_v1')) counts.occurrence += 1;
  });
  return counts;
}

test.describe('Phase C — occurrence-aware schedule RPC routing', () => {
  test('series mode: /event/:id calls get_event_program_v1 only', async ({ page }) => {
    await installRpcMocks(page);
    const counts = trackRpcCalls(page);

    await page.goto(`/event/${EVENT_ID}`);
    await page.waitForSelector('text=Series Class', { timeout: 12000 });

    // Settle: any deferred fetch should have fired by now.
    await page.waitForTimeout(500);

    expect(counts.event, 'series RPC must fire exactly once').toBe(1);
    expect(counts.occurrence, 'occurrence RPC must NOT fire in series mode').toBe(0);

    // Secondary DOM signal: the cancelled-in-override session IS visible
    // in series mode (because we're rendering the series program).
    await expect(page.locator('text=Cancelled In Override')).toBeVisible();
  });

  test('occurrence mode: /event/:id?occurrenceId=… calls get_occurrence_program_v1 only', async ({ page }) => {
    await installRpcMocks(page);
    const counts = trackRpcCalls(page);

    await page.goto(`/event/${EVENT_ID}?occurrenceId=${OCCURRENCE_ID}`);
    await page.waitForSelector('text=Series Class', { timeout: 12000 });

    await page.waitForTimeout(500);

    expect(counts.occurrence, 'occurrence RPC must fire exactly once').toBe(1);
    expect(counts.event, 'series RPC must NOT fire in occurrence mode').toBe(0);

    // Secondary DOM signal: the cancelled-in-override session is GONE
    // because the merged occurrence program filtered it out.
    await expect(page.locator('text=Cancelled In Override')).toHaveCount(0);
  });
});
