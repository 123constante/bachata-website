import { test, expect, type Page, type Route } from '@playwright/test';

// Lever 2 W4 (series editor and dates, mockup 04-A) and W5 (change one date,
// mockup 03-A) on /account/series/:id. Every **/auth/v1/** and **/rest/v1/**
// call is mocked with a STATEFUL fake of the P5 command RPCs, so each save is
// asserted by the exact request body the page sends and the page is then
// checked to re-read the result. Shapes are the E2E project's real answers
// (admin_event_workspace_p5 / event_view_p5 as an owner, 2026-10-04); the
// server's acceptance of these envelopes is proved separately on E2E (PR body).
// e2e-smoke.yml turns VITE_ENABLE_ORGANISER_SELF_SERVE on for the dev server.

const projectRef = 'stsdtacfauprzrdebmzg';
const userId = '11111111-1111-1111-1111-111111111111';
const SERIES = 'ser-1';
// Sunday 4 Oct 2026 (BST), noon in London. The weekly rule is Sundays.
const NOW = new Date('2026-10-04T11:00:00Z');
const TODAY = '2026-10-04';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const b64url = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

const refuse = (route: Route, message: string) => json(route, { code: 'P0001', message, details: null, hint: null }, 400);

interface FakeDate {
  id: string;
  occurrence_date: string;
  lifecycle_status: 'scheduled' | 'cancelled';
  version: number;
  start: string;
  end: string;
  reason: string | null;
  has_override: boolean;
  session_overrides_count: number;
}

interface Envelope {
  target_id: string;
  expected_version?: number;
  idempotency_key: string;
  command: { kind: string; payload: Record<string, unknown> };
}

interface Fake {
  sent: Envelope[];
  refuseNext: string | null;
}

const VENUES = [
  { id: 'ven-1', name: 'Studio 3, Battersea Arts Hub', neighbourhood: 'Battersea', city_name: 'London' },
  { id: 'ven-2', name: 'Salsa Cellar Soho', neighbourhood: 'Soho', city_name: 'London' },
];

const REASONS = [
  { key: 'venue_closed', label: 'Venue closed' },
  { key: 'teacher_unavailable', label: 'Teacher unavailable' },
  { key: 'bank_holiday', label: 'Bank holiday' },
  { key: 'low_signups', label: 'Low signups' },
  { key: 'other', label: 'Other' },
];

async function openSeries(page: Page, opts: { hasSessions?: boolean; workspaceRefusal?: string; path?: string } = {}): Promise<Fake> {
  const fake: Fake = { sent: [], refuseNext: null };
  const series = {
    id: SERIES, name: 'Sunday Bachata Class', slug: 'sunday-bachata-class', format: 'recurring', category: 'class',
    lifecycle_status: 'live', version: 3, default_venue_id: 'ven-1', default_city_id: 'city-1',
    default_local_start_time: '19:30:00', default_duration: '02:00:00', default_level: 'beginner',
    default_ticket_url: null, default_description: 'Friendly weekly class.', default_cover_image_url: null,
    default_start_date: '2026-09-01', created_at: '2026-09-01T10:00:00+00:00',
    recurrence_rule: { mode: 'weekly', weekdays: [0], end: { kind: 'none' } },
    removed_dates: [] as string[],
  };
  const dates: FakeDate[] = ['2026-10-04', '2026-10-11', '2026-10-18'].map((d, i) => ({
    id: `occ-${i + 1}`, occurrence_date: d, lifecycle_status: 'scheduled', version: 1, start: '19:30', end: '21:30',
    reason: null, has_override: false, session_overrides_count: 0,
  }));

  const workspace = () => ({
    meta: { version: series.version, has_more: false },
    series: {
      series,
      program: opts.hasSessions === false ? [] : [{ day: { id: 'd1' }, sections: [{ section: { id: 's1' }, items: [{ item: { id: 'i1', start_time: '19:30:00' }, people: [] }] }] }],
    },
    occurrences: [...dates].reverse().map((d) => ({
      id: d.id, occurrence_date: d.occurrence_date, lifecycle_status: d.lifecycle_status, version: d.version,
      has_override: d.has_override, session_overrides_count: d.session_overrides_count, added_sessions_count: 0,
      materialised_start_utc: `${d.occurrence_date}T${d.start}:00+00:00`,
    })),
  });

  const detail = (d: FakeDate) => ({
    event: {
      name: series.name, venue_id: 'ven-1', ticket_url: null, description: series.default_description, cover_image_url: null,
      venue_id_override: null, ticket_url_override: null, description_override: null, cover_image_url_override: null,
      cancellation_reason_label: d.reason,
    },
    program: [{ start_time: `${d.start}:00`, end_time: `${d.end}:00`, cancelled: false }],
    schedule: { timezone: 'Europe/London', local_start_time: `${d.start}:00`, local_end_time: `${d.end}:00` },
    occurrence: { id: d.id, date: d.occurrence_date, version: d.version, series_id: SERIES, lifecycle_status: d.lifecycle_status,
      materialised_start_utc: `${d.occurrence_date}T${d.start}:00+00:00` },
    added_sessions: [],
  });

  const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'diego@ritmo.example', user_metadata: {} };
  const token = `${b64url({ alg: 'HS256' })}.${b64url({ sub: userId, amr: [{ method: 'otp', timestamp: 1 }] })}.sig`;
  await page.clock.setFixedTime(NOW);
  await page.addInitScript(
    ({ value, ref }) => localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(value)),
    {
      value: { access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'r', user },
      ref: projectRef,
    },
  );
  await page.route('**/auth/v1/**', (route) => json(route, route.request().url().includes('/user') ? user : {}));
  await page.route('**/rest/v1/**', (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const body = route.request().postDataJSON?.() ?? null;

    if (path.endsWith('/rpc/admin_event_workspace_p5')) {
      if (opts.workspaceRefusal) return refuse(route, opts.workspaceRefusal);
      return json(route, workspace());
    }
    if (path.endsWith('/rpc/event_view_p5')) {
      const d = dates.find((x) => x.id === body?.p_target?.occurrence_id);
      return d && body?.p_viewer?.role === 'organiser' ? json(route, detail(d)) : refuse(route, 'not_found: occurrence');
    }
    if (path.endsWith('/rpc/series_command_p5') || path.endsWith('/rpc/occurrence_command_p5')) {
      const env = body?.p_envelope as Envelope;
      fake.sent.push(env);
      if (fake.refuseNext) {
        const message = fake.refuseNext;
        fake.refuseNext = null;
        return refuse(route, message);
      }
      const { kind, payload } = env.command;
      if (kind.startsWith('series.')) {
        if (env.expected_version !== series.version) return refuse(route, `version_conflict: expected ${env.expected_version}, got ${series.version}`);
        if (kind === 'series.upsert') {
          if (typeof payload.name === 'string') series.name = payload.name;
          if (typeof payload.default_local_start_time === 'string') series.default_local_start_time = `${payload.default_local_start_time}:00`;
          if (typeof payload.default_duration_minutes === 'number') {
            const m = payload.default_duration_minutes;
            series.default_duration = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:00`;
          }
        }
        if (kind === 'series.add_date') {
          dates.push({ id: `occ-${dates.length + 1}`, occurrence_date: String(payload.date), lifecycle_status: 'scheduled', version: 1,
            start: '19:30', end: '21:30', reason: null, has_override: false, session_overrides_count: 0 });
          dates.sort((a, b) => a.occurrence_date.localeCompare(b.occurrence_date));
        }
        series.version += 1;
        return json(route, { ok: true, data: {}, audit_id: 'a', new_version: series.version });
      }
      const d = dates.find((x) => x.id === env.target_id);
      if (!d) return refuse(route, 'not_found: occurrence');
      if (env.expected_version !== d.version) return refuse(route, `version_conflict: expected ${env.expected_version}, got ${d.version}`);
      if (kind === 'occurrence.cancel') {
        d.lifecycle_status = payload.cancelled ? 'cancelled' : 'scheduled';
        d.reason = payload.cancelled ? String(payload.reason) : d.reason;
        d.has_override = true;
      }
      // Admin D8: on a series with no programme times the first move of a date
      // creates its date-time session and says so with date_session_created.
      const dateSessionCreated = kind === 'occurrence.set_time' && opts.hasSessions === false && d.session_overrides_count === 0;
      if (kind === 'occurrence.set_time') {
        d.start = String(payload.new_local_start);
        d.end = String(payload.new_local_end ?? d.end);
        d.session_overrides_count = 1;
      }
      d.version += 1;
      const data = dateSessionCreated ? { applied: { start: d.start, end: d.end }, date_session_created: true } : {};
      return json(route, { ok: true, data, audit_id: 'a', new_version: d.version });
    }
    if (path.endsWith('/rest/v1/cancellation_reasons')) return json(route, REASONS);
    if (path.endsWith('/rpc/get_public_venues_list_v4')) return json(route, VENUES);
    if (path.endsWith('/rpc/organiser_home_v1')) {
      return json(route, {
        today: TODAY,
        organisers: [{ id: 'org-1', name: 'Ritmo Bachata London', slug: 'ritmo', avatar_url: null, city_id: null, lifecycle_status: 'live',
          role: 'owner', latest_decision: null,
          series: [{ id: SERIES, name: series.name, slug: series.slug, format: 'recurring', category: 'class', lifecycle_status: 'live',
            default_local_start_time: '19:30:00', upcoming_count: 3, latest_decision: null,
            next_dates: dates.map((d) => ({ occurrence_id: d.id, occurrence_date: d.occurrence_date, lifecycle_status: d.lifecycle_status,
              materialised_start_utc: `${d.occurrence_date}T${d.start}:00+00:00`, has_own_changes: false })) }] }],
      });
    }
    return json(route, []);
  });
  await page.goto(opts.path ?? `/account/series/${SERIES}`);
  await expect(page.getByTestId(opts.path === '/account' ? 'account-page' : 'account-series-page')).toBeVisible();
  return fake;
}

const row = (page: Page, date: string) => page.locator(`[data-testid="series-date-row"][data-date="${date}"]`);

function expectEnvelope(env: Envelope | undefined, target: string, version: number, command: Envelope['command']) {
  expect(env).toBeDefined();
  expect(Object.keys(env as Envelope).sort()).toEqual(['command', 'expected_version', 'idempotency_key', 'target_id']);
  expect(env?.target_id).toBe(target);
  expect(env?.expected_version).toBe(version);
  expect(env?.idempotency_key).toMatch(UUID);
  expect(env?.command).toEqual(command);
}

for (const width of [390, 768, 1280]) {
  test.describe(`organiser series page @${width}`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('edit the series, add a date, cancel and un-cancel a date, move one date', async ({ page }) => {
      const fake = await openSeries(page);
      await expect(page.getByTestId('series-title')).toHaveText('Sunday Bachata Class');
      await expect(page.getByTestId('scope-note')).toContainText('A change here applies to every future date.');
      await expect(page.getByTestId('series-date-row')).toHaveCount(3);
      await expect(row(page, TODAY)).toContainText('Tonight');

      // 1. Basics: name and start time, saved for every date. Only the changed keys go.
      await page.getByLabel('Name').fill('Sunday Bachata Class & Practice');
      await page.locator('#series-start').fill('20:00');
      await page.getByTestId('basics-save').click();
      await expect(page.getByTestId('series-confirmation')).toContainText('Saved for every future date');
      expectEnvelope(fake.sent[0], SERIES, 3, {
        kind: 'series.upsert',
        payload: { name: 'Sunday Bachata Class & Practice', default_local_start_time: '20:00', default_duration_minutes: 90 },
      });
      await expect(page.getByTestId('series-title')).toHaveText('Sunday Bachata Class & Practice');

      // 2. Add a date (the series version moved on: the next save carries the new one).
      await page.locator('#add-date').fill('2026-10-07');
      await page.getByTestId('add-date-submit').click();
      await expect(row(page, '2026-10-07')).toBeVisible();
      expectEnvelope(fake.sent[1], SERIES, 4, { kind: 'series.add_date', payload: { date: '2026-10-07' } });

      // 3. Cancel Sun 11 Oct with a reason (03-A action sheet).
      await row(page, '2026-10-11').getByTestId('date-open').click();
      const sheet = page.getByTestId('date-sheet');
      await expect(sheet).toContainText('Sun 11 Oct');
      await sheet.getByTestId('action-cancel').click();
      await expect(sheet.getByTestId('cancel-confirm')).toBeDisabled();
      await sheet.getByTestId('cancel-reason').filter({ hasText: 'Venue closed' }).click();
      await page.screenshot({ path: `test-results/organiser-date-sheet-${width}.png` });
      await sheet.getByTestId('cancel-confirm').click();
      await expect(sheet.getByTestId('date-done')).toContainText('Sun 11 Oct is cancelled.');
      expectEnvelope(fake.sent[2], 'occ-2', 1, { kind: 'occurrence.cancel', payload: { cancelled: true, reason: 'Venue closed' } });
      await sheet.getByTestId('date-close').click();
      await expect(sheet).toBeHidden();
      await expect(row(page, '2026-10-11').getByTestId('row-cancelled')).toBeVisible();
      await expect(page.getByTestId('scope-note')).toContainText('Sun 11 Oct (cancelled)');

      // 4. Un-cancel it.
      await row(page, '2026-10-11').getByTestId('date-open').click();
      await expect(sheet.getByTestId('date-cancelled-banner')).toContainText('Venue closed');
      await sheet.getByTestId('action-uncancel').click();
      await expect(sheet.getByTestId('date-done')).toContainText('is back on');
      expectEnvelope(fake.sent[3], 'occ-2', 2, { kind: 'occurrence.cancel', payload: { cancelled: false } });
      await sheet.getByTestId('date-close').click();
      await expect(sheet).toBeHidden();
      await expect(row(page, '2026-10-11').getByTestId('row-time')).toHaveText('19:30');

      // 5. Move tonight only (03-C layout inside the sheet). Wall-clock digits, no zone shift.
      await row(page, TODAY).getByTestId('date-open').click();
      await sheet.getByTestId('action-time').click();
      await expect(sheet.locator('#date-start')).toHaveValue('19:30');
      await sheet.locator('#date-start').fill('20:15');
      await sheet.locator('#date-end').fill('22:45');
      await sheet.getByTestId('date-save').click();
      await expect(sheet.getByTestId('date-done')).toContainText('now starts at 20:15');
      expectEnvelope(fake.sent[4], 'occ-1', 1, { kind: 'occurrence.set_time', payload: { new_local_start: '20:15', new_local_end: '22:45' } });
      await sheet.getByTestId('date-close').click();
      await expect(sheet).toBeHidden();
      await expect(row(page, TODAY).getByTestId('row-time')).toHaveText('20:15');

      // Nothing outside the owner allowlist ever left the page.
      const kinds = fake.sent.map((e) => e.command.kind);
      expect(kinds).toEqual(['series.upsert', 'series.add_date', 'occurrence.cancel', 'occurrence.cancel', 'occurrence.set_time']);

      await page.screenshot({ path: `test-results/organiser-series-${width}.png`, fullPage: true });
    });
  });
}

test('a server refusal reads as plain words, never raw text', async ({ page }) => {
  const fake = await openSeries(page);
  await row(page, '2026-10-18').getByTestId('date-open').click();
  const sheet = page.getByTestId('date-sheet');
  await sheet.getByTestId('action-cancel').click();
  await sheet.getByTestId('cancel-reason').filter({ hasText: 'Other' }).click();
  fake.refuseNext = 'permission_denied: occurrence.cancel on a past date is admin-only';
  await sheet.getByTestId('cancel-confirm').click();
  await expect(sheet.getByTestId('date-error')).toHaveText('That date has already happened, so it can no longer be changed.');
  await expect(sheet).not.toContainText('admin-only');
});

test('a version conflict keeps what the organiser typed', async ({ page }) => {
  const fake = await openSeries(page);
  await page.getByLabel('Name').fill('Typed name');
  fake.refuseNext = 'version_conflict: expected 3, got 4';
  await page.getByTestId('basics-save').click();
  await expect(page.getByTestId('basics-error')).toContainText('changed somewhere else');
  await expect(page.getByLabel('Name')).toHaveValue('Typed name');
});

test('a series with no programme times can move one date (admin D8: the date gets its own time)', async ({ page }) => {
  const fake = await openSeries(page, { hasSessions: false });
  await row(page, TODAY).getByTestId('date-open').click();
  const sheet = page.getByTestId('date-sheet');
  // A rule date is a break; an off-rule date would be "Remove".
  await expect(sheet.getByTestId('action-skip')).toBeVisible();
  await expect(sheet.getByTestId('action-time')).toBeEnabled();
  await expect(sheet.getByTestId('action-time')).not.toContainText('set by the Bachata Calendar team');
  await sheet.getByTestId('action-time').click();
  await expect(sheet.getByTestId('time-panel')).toContainText('Only');
  await sheet.locator('#date-start').fill('22:30');
  await sheet.locator('#date-end').fill('01:30');
  await sheet.getByTestId('date-save').click();
  await expect(sheet.getByTestId('date-done')).toContainText('now has its own time: 22:30\u201301:30.');
  await expect(sheet.getByTestId('date-done')).not.toContainText('session');
  const sent = fake.sent[fake.sent.length - 1];
  expect(sent?.command).toEqual({ kind: 'occurrence.set_time', payload: { new_local_start: '22:30', new_local_end: '01:30' } });
});

test("another organiser's series shows the refusal, not an editor", async ({ page }) => {
  await openSeries(page, { workspaceRefusal: 'permission_denied: actor x cannot edit series y' });
  await expect(page.getByTestId('series-unavailable')).toBeVisible();
  await expect(page.getByTestId('series-editor')).toHaveCount(0);
});

test('the home card opens the series page', async ({ page }) => {
  await openSeries(page, { path: '/account' });
  await page.getByTestId('series-manage').click();
  await expect(page).toHaveURL(new RegExp(`/account/series/${SERIES}$`));
  await expect(page.getByTestId('series-title')).toHaveText('Sunday Bachata Class');
});
