import { test, expect, type Locator, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import {
  SUPABASE_ANON,
  SUPABASE_URL,
  assertE2eTarget,
  londonDate,
  pageAs,
  signIn,
  testPng,
  type SignedIn,
} from './helpers/e2eRealSupabase';

/**
 * The organiser LAUNCH WALK, end to end on the REAL E2E project (no mocks), organiser -> admin -> public:
 *
 *   1  a test organiser creates a weekly party, sets the venue, a session with a start time, a cover;
 *   2  on the way, the editor says what it still needs and Send for review is disabled with that reason;
 *   3  Send for review -> status "In review";
 *   4  date edits: change the session time, move one date to a venue in ANOTHER city, cancel a date
 *      with a listed reason, put it back;
 *   5  the E2E admin approves it with admin_approve_entity_v1 (the RPC the admin moderation queue's
 *      Approve calls) -- the G6 question: an organiser event whose only sessions are per-date ones;
 *   6  the public site, signed out, at 390 and 1280: event page, city calendar day, search all show
 *      the SAME start time; the moved date lists under the other city's calendar;
 *   7  negative paths: a contributor (not owner/manager) is refused in the page and by the RPCs;
 *      a series whose only date is cancelled says so and Send for review carries the reason.
 *
 * KNOWN DEFECTS found by the first walk (2026-10-09) are pinned with test.fail(): when one is
 * fixed its test turns red here, which is the cue to drop the test.fail(). (7b's refusal copy and
 * 7c's stale editor after a cancel are fixed and now assert the right behaviour.)
 *
 * NOT in `npm run test:e2e` / e2e-smoke.yml: it needs E2E logins and writes to the E2E database.
 * Runs only under playwright.organiser-real-rpc.config.ts, which refuses prod or any non-E2E project.
 *
 * Run (after `npm run seed:e2e:organiser-real-rpc`, which also deletes the "RPC Journey *" series
 * earlier runs created, so the 10-series-a-day cap never blocks a re-run):
 *   E2E_ORGANISER_OWNER_PASSWORD=... E2E_ORGANISER_CONTRIBUTOR_PASSWORD=... \
 *   E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... \
 *   VITE_SUPABASE_URL=https://srrpvuxldthwumzrngla.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=<E2E anon key> \
 *   npm run test:e2e:organiser-launch-walk
 * Without admin credentials steps 4 (other-city venue), 5 and 6 skip with a reason.
 */

const OWNER_EMAIL = process.env.E2E_ORGANISER_OWNER_EMAIL || 'e2e-organiser-owner@fixtures.bachata-admin.test';
const OWNER_PASSWORD = process.env.E2E_ORGANISER_OWNER_PASSWORD || '';
const CONTRIB_EMAIL = process.env.E2E_ORGANISER_CONTRIBUTOR_EMAIL || 'e2e-organiser-contributor@fixtures.bachata-admin.test';
const CONTRIB_PASSWORD = process.env.E2E_ORGANISER_CONTRIBUTOR_PASSWORD || '';
// The admin repo's E2E admin login (its .env.playwright names): PLAYWRIGHT_ADMIN_* or E2E_ADMIN_*.
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || process.env.PLAYWRIGHT_ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || process.env.PLAYWRIGHT_ADMIN_PASSWORD || '';

const VENUE = 'E2E Test Venue';
const LONDON_SLUG = 'london';
// A second city + venue, made idempotently through the admin's own RPCs (admin_save_city_v1 /
// admin_save_venue_v2) when missing: the seed has London only.
const OTHER_CITY = { name: 'E2E Manchester', slug: 'e2e-manchester' };
const OTHER_VENUE = 'E2E Manchester Venue';
const SHOTS = 'test-results/organiser-launch-walk';
const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

function refusal(): string | null {
  if (process.env.ORGANISER_REAL_RPC_CONFIG !== '1') return 'run it with its own config: npm run test:e2e:organiser-launch-walk';
  if (!OWNER_PASSWORD || !CONTRIB_PASSWORD) return 'set E2E_ORGANISER_OWNER_PASSWORD and E2E_ORGANISER_CONTRIBUTOR_PASSWORD (see docs/e2e-organiser-real-rpc.md)';
  if (!SUPABASE_URL || !SUPABASE_ANON) return 'set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to the E2E project';
  return null;
}
const NO_ADMIN = !ADMIN_EMAIL || !ADMIN_PASSWORD ? 'set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD (the admin repo E2E admin login)' : '';
if (process.env.ORGANISER_REAL_RPC_CONFIG === '1') assertE2eTarget();

/** "9:30 PM", "9:30PM", "21:30" -> minutes after midnight. */
const minutesOf = (t: string) => {
  const m = /(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(t);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (!m[3]) h = Number(m[1]);
  else if (m[3].toUpperCase() === 'PM') h += 12;
  return h * 60 + Number(m[2]);
};
const START = 21 * 60 + 30; // the session start after step 4's change
const START_RE = /(?<!\d)(21:30|9:30\s?PM)/i;

const addDays = (key: string, n: number) => londonDate(new Date(Date.parse(`${key}T12:00:00Z`) + n * 86400000));

/** Screenshot at the page's current (phone) size, then at 1280x800, then back. */
async function shotBoth(page: Page, name: string) {
  await page.screenshot({ path: `${SHOTS}/${name}-390.png` });
  await page.setViewportSize(DESKTOP);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/${name}-1280.png` });
  await page.setViewportSize(PHONE);
}

/** The next POST to a real RPC / Storage path. */
const rpcDone = (page: Page, path: string) =>
  page.waitForResponse((r) => r.url().includes(path) && r.request().method() === 'POST').then((r) => {
    console.log(`[launch-walk] ${path} -> HTTP ${r.status()}`);
    return r;
  });

/** A disabled control must say why: its own label, aria-describedby or title carries a non-empty reason. */
async function expectDisabledWithReason(page: Page, control: Locator, reason: RegExp) {
  await expect(control).toBeDisabled();
  const describedBy = await control.getAttribute('aria-describedby');
  const text = [
    await control.innerText(),
    (await control.getAttribute('title')) ?? '',
    describedBy ? await page.locator(`[id="${describedBy}"]`).innerText() : '',
  ].join(' ');
  expect(text, 'a disabled control carries its reason').toMatch(reason);
}

/** Open a city calendar on `dateKey` (YYYY-MM-DD) and tap that day once its events have loaded. */
async function openCalendarDay(page: Page, citySlug: string, dateKey: string) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const monthLabel = new Date(y, m - 1, 1).toLocaleString('en-GB', { month: 'long' });
  await page.goto(`/city/${citySlug}/calendar`);
  // Day cells are labelled "Friday, 16 October[, today][, has events]". The grid renders first;
  // only then is "is that day on this month" a fair question.
  await expect(page.getByRole('button', { name: /^[A-Z][a-z]+day, \d{1,2} [A-Z][a-z]+/ }).first()).toBeVisible({ timeout: 30_000 });
  const day = page.getByRole('button', { name: new RegExp(`^[A-Z][a-z]+day, ${d} ${monthLabel}\\b`) });
  for (let i = 0; i < 3 && !(await day.count()); i++) await page.getByRole('button', { name: 'Next month' }).first().click();
  const withEvents = page.getByRole('button', { name: new RegExp(`^[A-Z][a-z]+day, ${d} ${monthLabel}(, today)?, has events$`) });
  await expect(withEvents).toBeVisible({ timeout: 30_000 });
  await withEvents.click();
}

test.describe.configure({ mode: 'serial' });

test.describe('organiser launch walk on the real RPCs (E2E project)', () => {
  test.skip(refusal() !== null, refusal() ?? '');

  const tag = Date.now().toString(36);
  // The seed's cleanup deletes this organiser's "RPC Journey *" series on its next run.
  const name = `RPC Journey Launch ${tag}`;
  const firstDate = londonDate(new Date(Date.now() + 7 * 24 * 3600 * 1000));
  const dates = [firstDate, addDays(firstDate, 7), addDays(firstDate, 14)];

  let owner: SignedIn;
  let admin: SignedIn | null = null;
  let page: Page;
  const errors: string[] = [];
  let seriesId = '';
  const occ: Record<string, string> = {};
  let otherCityReady = false;
  let approved = false;

  const dateRow = (d: string) => page.locator(`[data-testid="org-date-row"][data-date="${d}"]`);
  const openEditor = async () => {
    await page.goto(`/account/o/events/${seriesId}`);
    await expect(page.getByTestId('org-event-editor')).toBeVisible();
  };
  const openDate = async (d: string) => {
    await openEditor();
    await dateRow(d).click();
    await expect(page.getByTestId('org-page-date')).toBeVisible();
    await expect(page.getByTestId('date-schedule')).toBeVisible();
    occ[d] = page.url().split('/').pop() ?? '';
  };

  test.beforeAll(async ({ browser }) => {
    mkdirSync(SHOTS, { recursive: true });
    owner = await signIn(OWNER_EMAIL, OWNER_PASSWORD);
    page = await pageAs(browser, owner.session, errors, PHONE);
    if (NO_ADMIN) return;
    admin = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
    // The other-city fixture, through the admin's canonical RPCs (idempotent).
    let { data: city } = await admin.client.from('cities').select('id').eq('slug', OTHER_CITY.slug).maybeSingle();
    if (!city) {
      const made = await admin.client.rpc('admin_save_city_v1', {
        p_payload: { ...OTHER_CITY, country_code: 'GB', timezone: 'Europe/London', is_active: true },
      } as never);
      expect(made.error, made.error?.message).toBeNull();
      city = { id: (made.data as { city?: { id: string } })?.city?.id ?? '' };
    }
    const { data: venue } = await admin.client.from('venues').select('id').eq('name', OTHER_VENUE).maybeSingle();
    if (!venue) {
      const made = await admin.client.rpc('admin_save_venue_v2', {
        p_payload: {
          name: OTHER_VENUE, city_id: city?.id, address: '1 Test Road, Manchester', timezone: 'Europe/London',
          country: 'GB', publish_state: 'draft', audit_reason: 'E2E launch-walk fixture',
        },
      } as never);
      expect((made.data as { success?: boolean })?.success, JSON.stringify(made.data ?? made.error)).toBe(true);
    }
    otherCityReady = true;
  });

  test.afterAll(async () => {
    await page?.context().close();
  });

  test('1+2 creates a weekly party; the editor says what it still needs until venue, session and cover are in', async () => {
    await page.goto('/account/o/events/new');
    await page.getByTestId('org-new-event-name').fill(name);
    await page.getByTestId('org-new-event-type-party').click();
    const created = rpcDone(page, '/rest/v1/rpc/series_command_p5');
    await page.getByTestId('org-new-event-create').click();
    expect((await created).status()).toBe(200);
    await expect(page).toHaveURL(/\/account\/o\/events\/[0-9a-f-]{36}$/);
    seriesId = page.url().split('/').pop() ?? '';
    await expect(page.getByTestId('org-event-status')).toHaveText('Draft');
    console.log(`[launch-walk] series ${seriesId} "${name}", first date ${firstDate}`);

    // 2: everything missing is named, and Send for review is disabled with that reason.
    const blocked = page.getByTestId('org-event-review-blocked');
    await expect(blocked).toContainText(/venue/i);
    await expect(blocked).toContainText(/session/i);
    await expect(blocked).toContainText(/cover/i);
    await expectDisabledWithReason(page, page.getByTestId('org-event-review-send'), /venue/i);
    await shotBoth(page, '01-new-event-needs');

    // Weekly + venue.
    await page.getByTestId('org-row-repeats').click();
    await page.getByRole('radio', { name: /^Every / }).click();
    await page.getByTestId('org-sheet-done').click();
    await page.getByTestId('org-row-venue').click();
    await page.getByTestId('org-venue-search-open').click();
    await page.getByTestId('org-venue-query').fill(VENUE);
    await page.getByTestId('org-venue-result').filter({ hasText: VENUE }).first().click();
    await page.getByTestId('org-sheet-done').click();
    const saved = rpcDone(page, '/rest/v1/rpc/series_command_p5');
    await page.getByTestId('org-preview-bar-action').click();
    expect((await saved).status()).toBe(200);
    await expect(page.getByTestId('org-save-error')).toHaveCount(0);
    for (const d of dates) await expect(dateRow(d)).toBeVisible();
    await expect(blocked).not.toContainText(/venue/i);
    await expect(blocked).toContainText(/session/i);

    // A party session with a start time, on the first date (organiser sessions are per date).
    await openDate(firstDate);
    await page.getByTestId('date-add-session').click();
    await page.getByTestId('session-type-party').click();
    await page.getByTestId('session-name').fill('Social party');
    await page.getByTestId('session-start').fill('21:00');
    await page.getByTestId('session-end').fill('02:00');
    await page.getByTestId('date-sheet-done').click();
    const prog = rpcDone(page, '/rest/v1/rpc/organiser_set_occurrence_programme_v1');
    await page.getByTestId('date-preview-bar-action').click();
    expect((await prog).status()).toBe(200);
    await expect(page.getByTestId('date-save-error')).toHaveCount(0);
    await expect(page.getByTestId('date-header')).toContainText('21:00');
    await shotBoth(page, '02-date-session');

    // Cover.
    await openEditor();
    await expect(blocked).toContainText(/cover/i);
    await expect(blocked).not.toContainText(/session/i);
    const uploaded = rpcDone(page, '/storage/v1/object/organiser-flyers/');
    await page.getByTestId('org-cover-file').setInputFiles({ name: `cover-${tag}.png`, mimeType: 'image/png', buffer: testPng(800, 800) });
    expect((await uploaded).status()).toBe(200);
    const withCover = rpcDone(page, '/rest/v1/rpc/series_command_p5');
    await page.getByTestId('org-preview-bar-action').click();
    expect((await withCover).status()).toBe(200);
    await expect(blocked).toHaveCount(0);
    await expect(page.getByTestId('org-event-review-send')).toBeEnabled();
    await shotBoth(page, '03-ready-to-send');
  });

  test('3 Send for review -> "In review"', async () => {
    test.skip(!seriesId, 'no series from step 1');
    await openEditor();
    const sent = rpcDone(page, '/rest/v1/rpc/series_command_p5');
    await page.getByTestId('org-event-review-send').click();
    const yes = page.getByTestId('org-event-review-yes');
    if (await yes.isVisible().catch(() => false)) await yes.click();
    expect((await sent).status()).toBe(200);
    await expect(page.getByTestId('org-event-status')).toHaveText('In review');
    await page.reload();
    await expect(page.getByTestId('org-event-status')).toHaveText('In review');
    await shotBoth(page, '04-in-review');
  });

  test('4 date edits: time, venue in another city, cancel with a listed reason, put back', async () => {
    test.skip(!seriesId, 'no series from step 1');
    // Time: 21:00 -> 21:30 on the first date.
    await openDate(firstDate);
    await page.getByTestId('session-row-open').first().click();
    await page.getByTestId('session-start').fill('21:30');
    await page.getByTestId('date-sheet-done').click();
    const prog = rpcDone(page, '/rest/v1/rpc/organiser_set_occurrence_programme_v1');
    await page.getByTestId('date-preview-bar-action').click();
    expect((await prog).status()).toBe(200);
    await page.reload();
    await expect(page.getByTestId('date-header')).toContainText('21:30');
    await shotBoth(page, '05-date-time-changed');

    // Venue in another city, on the second date.
    if (otherCityReady) {
      await openDate(dates[1]);
      await page.getByTestId('date-venue').click();
      await page.getByRole('dialog').getByRole('button', { name: new RegExp(OTHER_VENUE) }).first().click();
      // While unsaved, the date actions are disabled and say why.
      await expectDisabledWithReason(page, page.getByTestId('date-cancel'), /save your changes first/i);
      await expectDisabledWithReason(page, page.getByTestId('date-break'), /save your changes first/i);
      const moved = rpcDone(page, '/rest/v1/rpc/occurrence_command_p5');
      await page.getByTestId('date-preview-bar-action').click();
      expect((await moved).status()).toBe(200);
      await page.reload();
      await expect(page.getByTestId('date-venue')).toContainText(OTHER_CITY.name);
      await expect(page.getByTestId('date-venue')).toContainText(OTHER_VENUE);
      await shotBoth(page, '06-date-other-city');
    } else {
      console.log(`[launch-walk] other-city venue step skipped: ${NO_ADMIN}`);
    }

    // Cancel the third date with a listed reason, then put it back.
    await openDate(dates[2]);
    await page.getByTestId('date-cancel').click();
    const sheet = page.getByRole('dialog');
    await expect(page.getByTestId('date-cancel-confirm')).toBeDisabled();
    await sheet.getByRole('button', { name: 'Venue closed' }).click();
    await sheet.getByRole('checkbox').check();
    const cancelled = rpcDone(page, '/rest/v1/rpc/occurrence_command_p5');
    await page.getByTestId('date-cancel-confirm').click();
    expect((await cancelled).status()).toBe(200);
    await expect(page.getByTestId('date-cancelled-note')).toContainText('Venue closed');
    await shotBoth(page, '07-date-cancelled');
    await page.getByTestId('date-uncancel').click();
    const back = rpcDone(page, '/rest/v1/rpc/occurrence_command_p5');
    await page.getByTestId('date-uncancel-confirm').click();
    expect((await back).status()).toBe(200);
    await page.reload();
    await expect(page.getByTestId('date-schedule')).toBeVisible();
    await expect(page.getByTestId('date-cancelled-note')).toHaveCount(0);
    await expect(page.getByTestId('date-header')).toContainText('In review');
    await shotBoth(page, '08-date-put-back');
  });

  test('5 G6: the admin approves the organiser event (per-date sessions only) with admin_approve_entity_v1', async () => {
    test.skip(!seriesId, 'no series from step 1');
    test.skip(!!NO_ADMIN, NO_ADMIN);
    // The shape G6 is about: sessions only on dates, none on the series.
    const ws = await owner.client.rpc('admin_event_workspace_p5', { p_series_id: seriesId });
    expect(ws.error, ws.error?.message).toBeNull();
    const occs = (ws.data?.occurrences ?? []) as Array<{ occurrence_date: string; added_sessions_count?: number }>;
    expect(occs.find((o) => o.occurrence_date === firstDate)?.added_sessions_count ?? 0).toBeGreaterThan(0);
    console.log(`[launch-walk] G6 shape: lifecycle ${ws.data?.series?.series?.lifecycle_status}, dates with added sessions ${occs.filter((o) => (o.added_sessions_count ?? 0) > 0).length}/${occs.length}`);

    const res = await admin!.client.rpc('admin_approve_entity_v1', { p_target_type: 'series', p_target_id: seriesId, p_reason: null } as never);
    expect(res.error, res.error?.message).toBeNull();
    const out = res.data as { ok?: boolean; from_state?: string; to_state?: string };
    console.log(`[launch-walk] admin_approve_entity_v1 -> ${JSON.stringify(out)}`);
    expect(out.ok).toBe(true);
    expect(out.from_state).toBe('pending_review');
    expect(out.to_state).toBe('live');
    approved = true;

    await openEditor();
    await expect(page.getByTestId('org-event-status')).toHaveText('Live');
    await shotBoth(page, '09-live');
  });

  test('6 public site: event page, calendar and search show the same start time (390 and 1280)', async ({ browser }) => {
    test.skip(!approved, 'not approved in step 5');
    for (const viewport of [PHONE, DESKTOP]) {
      const pErrors: string[] = [];
      const pub = await pageAs(browser, null, pErrors, viewport);
      const seen: Record<string, number | null> = {};
      try {
        // Event page, on the first date.
        await pub.goto(`/event/${seriesId}?occurrenceId=${occ[firstDate]}`);
        const main = pub.locator('main').first();
        await expect(main).toContainText(name);
        await expect(main).toContainText(START_RE, { timeout: 30_000 });
        seen.event = minutesOf((await main.innerText()).match(START_RE)?.[0] ?? '');
        await pub.screenshot({ path: `${SHOTS}/10-public-event-${viewport.width}.png` });

        // City calendar, that day.
        await openCalendarDay(pub, LONDON_SLUG, firstDate);
        const dlg = pub.getByRole('dialog').filter({ hasText: name });
        await expect(dlg).toContainText(START_RE);
        const calText = await dlg.innerText();
        seen.calendar = minutesOf(calText.slice(calText.indexOf(name)).match(START_RE)?.[0] ?? '');
        await pub.screenshot({ path: `${SHOTS}/11-public-calendar-${viewport.width}.png` });

        // Search.
        await pub.goto(`/search?q=${encodeURIComponent(name)}`);
        // The "Results for ..." heading carries the name before the result cards load: wait for a time.
        await expect(pub.getByRole('main')).toContainText(name);
        await expect(pub.getByRole('main')).toContainText(START_RE, { timeout: 30_000 });
        const searchText = await pub.getByRole('main').innerText();
        seen.search = minutesOf(searchText.slice(searchText.indexOf(name)).match(START_RE)?.[0] ?? '');
        await pub.screenshot({ path: `${SHOTS}/12-public-search-${viewport.width}.png` });

        console.log(`[launch-walk] ${viewport.width}px start minutes ${JSON.stringify(seen)}`);
        expect(seen).toEqual({ event: START, calendar: START, search: START });
        expect(pErrors, pErrors.join('\n')).toEqual([]);
      } finally {
        await pub.context().close();
      }
    }
  });

  test('6b the moved date lists under the other city (the city follows the venue)', async ({ browser }) => {
    test.skip(!approved || !otherCityReady, 'needs step 5 and the other-city fixture');
    const pub = await pageAs(browser, null, [], PHONE);
    try {
      await openCalendarDay(pub, OTHER_CITY.slug, dates[1]);
      await expect(pub.getByRole('dialog').filter({ hasText: name })).toContainText(OTHER_VENUE);
      await pub.screenshot({ path: `${SHOTS}/13-public-other-city-calendar-390.png` });
    } finally {
      await pub.context().close();
    }
  });

  test('6c KNOWN DEFECT: a date with no session shows no invented start time on the public site', async ({ browser }) => {
    test.skip(!approved, 'not approved in step 5');
    // 2026-10-09 walk: the organiser editor says "No times yet" for the third date, but the event
    // page and the calendar show "8:00 PM - 1:00 AM" / "20:00 - 01:00" (the series default leaks; G3).
    test.fail();
    const pub = await pageAs(browser, null, [], PHONE);
    try {
      await pub.goto(`/event/${seriesId}?occurrenceId=${occ[dates[2]]}`);
      const main = pub.locator('main').first();
      await expect(main).toContainText(name);
      await pub.waitForTimeout(5000);
      await pub.screenshot({ path: `${SHOTS}/14-public-sessionless-date-390.png` });
      await expect(main).not.toContainText(/(?<!\d)(8:00\s?PM|20:00)/i);
    } finally {
      await pub.context().close();
    }
  });

  test('7 a contributor cannot see or edit the event: refused in the page and by the RPCs', async ({ browser }) => {
    test.skip(!seriesId, 'no series from step 1');
    const contributor = await signIn(CONTRIB_EMAIL, CONTRIB_PASSWORD);
    const cErrors: string[] = [];
    const cPage = await pageAs(browser, contributor.session, cErrors, PHONE);
    try {
      await cPage.goto(`/account/o/events/${seriesId}`);
      await expect(cPage.getByTestId('org-editor-error')).toBeVisible();
      await expect(cPage.getByTestId('org-event-editor')).toHaveCount(0);
      await cPage.screenshot({ path: `${SHOTS}/15-contributor-refused-390.png` });

      const ws = await owner.client.rpc('admin_event_workspace_p5', { p_series_id: seriesId });
      const version = ws.data?.series?.series?.version;
      const read = await contributor.client.rpc('admin_event_workspace_p5', { p_series_id: seriesId });
      expect(read.error?.message ?? '').toMatch(/^permission_denied/);
      const cmd = await contributor.client.rpc('series_command_p5', {
        p_envelope: {
          target_id: seriesId, expected_version: version, idempotency_key: crypto.randomUUID(),
          command: { kind: 'series.upsert', payload: { name: `${name} hijacked` } },
        },
      } as never);
      expect(cmd.error?.message ?? '').toMatch(/^permission_denied/);
      const cancel = await contributor.client.rpc('occurrence_command_p5', {
        p_envelope: {
          target_id: occ[firstDate], expected_version: 1, idempotency_key: crypto.randomUUID(),
          command: { kind: 'occurrence.cancel', payload: { cancelled: true, reason: 'Venue closed' } },
        },
      } as never);
      expect(cancel.error?.message ?? '').toMatch(/^permission_denied/);
      const after = await owner.client.rpc('admin_event_workspace_p5', { p_series_id: seriesId });
      expect(after.data?.series?.series?.name).toBe(name);
      expect(cErrors, cErrors.join('\n')).toEqual([]);
    } finally {
      await cPage.context().close();
    }
  });

  test('7b the refusal says the person has no access, not "check your connection"', async ({ browser }) => {
    test.skip(!seriesId, 'no series from step 1');
    // Fixed after the 2026-10-09 walk: permission_denied used to read "Check your connection".
    const contributor = await signIn(CONTRIB_EMAIL, CONTRIB_PASSWORD);
    const cPage = await pageAs(browser, contributor.session, [], PHONE);
    try {
      await cPage.goto(`/account/o/events/${seriesId}`);
      await expect(cPage.getByTestId('org-editor-error')).toBeVisible();
      await expect(cPage.getByTestId('org-editor-error')).toContainText(/do not have access to this event/i);
      await expect(cPage.getByTestId('org-editor-error')).not.toContainText(/connection/i);
    } finally {
      await cPage.context().close();
    }
  });

  test('7c a series whose only date is cancelled says so, and Send for review carries the reason', async () => {
    test.skip(!seriesId, 'no series from step 1');
    const cName = `RPC Journey Launch cancelled-only ${tag}`;
    await page.goto('/account/o/events/new');
    await page.getByTestId('org-new-event-name').fill(cName);
    await page.getByTestId('org-new-event-type-party').click();
    const created = rpcDone(page, '/rest/v1/rpc/series_command_p5');
    await page.getByTestId('org-new-event-create').click();
    expect((await created).status()).toBe(200);
    await expect(page.getByTestId('org-event-editor')).toBeVisible();
    await page.getByTestId('org-date-row').first().click();
    await expect(page.getByTestId('date-schedule')).toBeVisible();
    await page.getByTestId('date-cancel').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Low signups' }).click();
    await page.getByRole('dialog').getByRole('checkbox').check();
    const cancelled = rpcDone(page, '/rest/v1/rpc/occurrence_command_p5');
    await page.getByTestId('date-cancel-confirm').click();
    expect((await cancelled).status()).toBe(200);

    // Back on the editor through the in-app "Event" link, with NO reload, the date reads cancelled
    // (fixed after the 2026-10-09 walk, where it stayed "upcoming" until a reload).
    await page.getByRole('link', { name: 'Event' }).first().click();
    await expect(page.getByTestId('org-event-editor')).toBeVisible();
    await expect(page.getByTestId('org-schedule-none')).toContainText(/every upcoming date is cancelled/i);
    await expect(page.getByTestId('org-date-row').first()).toContainText(/cancelled/i);
    await expect(page.getByTestId('org-event-review-blocked')).toContainText(/upcoming date/i);
    await expectDisabledWithReason(page, page.getByTestId('org-event-review-send'), /upcoming date/i);
    await shotBoth(page, '16-cancelled-only');

    await page.goto('/account/o/events');
    await expect(page.getByTestId('org-event-row').filter({ hasText: cName })).toContainText(/no upcoming dates/i);
    await shotBoth(page, '17-event-list');
    expect(errors, errors.join('\n')).toEqual([]);
  });
});
