import { test, expect, type Page, type Route } from '@playwright/test';

// Lever 2 W3 (create a party or a weekly class, mockup 02-A) on /account/new.
// Every **/auth/v1/** and **/rest/v1/** call is mocked with a STATEFUL fake of
// series_command_p5: the create is asserted by the exact envelopes the screen
// sends (the server's acceptance of these envelopes is proved separately on the
// E2E project, in the PR body), and the page is then checked to land on the new
// series' page, whose workspace the fake builds from what was sent.
// e2e-smoke.yml turns VITE_ENABLE_ORGANISER_SELF_SERVE on for the dev server.

const projectRef = 'stsdtacfauprzrdebmzg';
const userId = '11111111-1111-1111-1111-111111111111';
// Sunday 4 Oct 2026 (BST), noon in London.
const NOW = new Date('2026-10-04T11:00:00Z');
const TODAY = '2026-10-04';
// B1: the city ids the create can send. LONDON is what the venue's city name resolves to;
// ORG_CITY is the organiser's own city_id (home), used when the venue has no city.
const LONDON_ID = 'cccccccc-0000-0000-0000-000000000001';
const ORG_CITY_ID = 'cccccccc-0000-0000-0000-000000000002';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const b64url = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

const refuse = (route: Route, message: string) => json(route, { code: 'P0001', message, details: null, hint: null }, 400);

interface Envelope {
  target_id: string;
  expected_version?: number;
  idempotency_key: string;
  command: { kind: string; payload: Record<string, unknown> };
}

interface Fake {
  sent: Envelope[];
  /** kind -> refusal message, consumed on the next envelope of that kind. */
  refuse: Record<string, string>;
  created: { id: string; payload: Record<string, unknown>; version: number; lifecycle: string; rule: unknown; dates: string[] } | null;
  /** The server's replay (command_idempotency_p5): a key that already SUCCEEDED returns its stored response. */
  replay: Map<string, unknown>;
  /** Apply the next create, then drop the connection before the reply (a lost reply on a phone). */
  loseNextCreateReply: boolean;
}

const VENUES = [
  { id: 'ven-1', name: 'Studio 3, Battersea Arts Hub', neighbourhood: 'Battersea', city_name: 'London' },
  { id: 'ven-2', name: 'Salsa Cellar Soho', neighbourhood: 'Soho', city_name: 'London' },
  { id: 'ven-3', name: 'Cityless Hall', neighbourhood: null, city_name: null },
];

const organiser = (over: Record<string, unknown>) => ({
  id: 'org-1', name: 'Ritmo Bachata London', slug: 'ritmo', avatar_url: null, city_id: null, lifecycle_status: 'live',
  role: 'owner', is_primary: true, joined_at: '2026-10-01T10:00:00Z', latest_decision: null, series: [], ...over,
});

const ORGANISERS = [
  organiser({}),
  organiser({ id: 'org-2', name: 'Ritmo Sundays', slug: null, lifecycle_status: 'draft' }),
];

async function openCreate(
  page: Page,
  path = '/account/new?organiser=org-1',
  opts: { organiserCityId?: string | null } = {},
): Promise<Fake> {
  const organisers = ORGANISERS.map((o) => ({ ...o, city_id: opts.organiserCityId ?? null }));
  const fake: Fake = { sent: [], refuse: {}, created: null, replay: new Map(), loseNextCreateReply: false };
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
    const path = new URL(route.request().url()).pathname;
    const body = route.request().postDataJSON?.() ?? null;

    if (path.endsWith('/rpc/organiser_home_v1')) return json(route, { today: TODAY, organisers });
    // The organiser picker reads get_organiser_venue_options_v1 first (B2); v4 is only its fallback.
    // The shared city resolver (src/lib/city-canonical.ts): name -> id, then the cities row.
    if (path.endsWith('/rpc/resolve_city_id')) return json(route, body?.p_city === 'London' ? LONDON_ID : null);
    if (path.endsWith('/cities')) {
      const row = { id: LONDON_ID, name: 'London', slug: 'london' };
      return json(route, route.request().headers().accept?.includes('vnd.pgrst.object') ? row : [row]);
    }
    if (path.endsWith('/rpc/get_organiser_venue_options_v1')) return json(route, VENUES);
    if (path.endsWith('/rpc/get_public_venues_list_v4')) return json(route, VENUES);
    if (path.endsWith('/rpc/series_command_p5')) {
      const env = body?.p_envelope as Envelope;
      fake.sent.push(env);
      const replayed = fake.replay.get(env.idempotency_key);
      if (replayed) return json(route, { ...(replayed as object), idempotent_replay: true });
      const { kind, payload } = env.command;
      if (fake.refuse[kind]) {
        const message = fake.refuse[kind];
        delete fake.refuse[kind];
        return refuse(route, message);
      }
      if (kind === 'series.upsert' && (!fake.created || fake.created.id !== env.target_id)) {
        // A series.upsert on an id with no row is a CREATE: the handler returns the id it inserted.
        fake.created = { id: env.target_id, payload, version: 2, lifecycle: 'draft', rule: null, dates: [] };
        const response = { ok: true, data: { is_create: true, series_id: env.target_id }, audit_id: 'a', new_version: 2 };
        fake.replay.set(env.idempotency_key, response);
        if (fake.loseNextCreateReply) {
          fake.loseNextCreateReply = false;
          return route.abort('connectionreset');
        }
        return json(route, response);
      }
      const s = fake.created;
      if (!s || s.id !== env.target_id) return refuse(route, 'series_not_found');
      if (env.expected_version !== s.version) return refuse(route, `version_conflict: expected ${env.expected_version}, got ${s.version}`);
      if (kind === 'series.add_date') s.dates.push(String(payload.date));
      if (kind === 'series.set_recurrence') s.rule = payload;
      if (kind === 'series.set_lifecycle') s.lifecycle = String(payload.to);
      s.version += 1;
      return json(route, { ok: true, data: {}, audit_id: 'a', new_version: s.version });
    }
    if (path.endsWith('/rpc/admin_event_workspace_p5')) {
      const s = fake.created;
      if (!s || s.id !== body?.p_series_id) return refuse(route, 'series_not_found');
      const p = s.payload;
      const minutes = typeof p.default_duration_minutes === 'number' ? p.default_duration_minutes : null;
      return json(route, {
        meta: { version: s.version, has_more: false },
        series: {
          series: {
            id: s.id, name: p.name, slug: null, format: p.format, category: p.category, lifecycle_status: s.lifecycle, version: s.version,
            default_venue_id: p.default_venue_id ?? null, default_city_id: null, default_local_start_time: `${p.default_local_start_time}:00`,
            default_duration: minutes ? `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:00` : null,
            default_level: p.default_level ?? null, default_ticket_url: p.default_ticket_url ?? null, default_description: p.default_description ?? null,
            default_cover_image_url: p.default_cover_image_url ?? null, default_start_date: p.default_start_date, created_at: '2026-10-04T11:00:00+00:00',
            recurrence_rule: s.rule, removed_dates: [],
          },
          program: [],
        },
        occurrences: s.dates.map((d, i) => ({
          id: `occ-${i + 1}`, occurrence_date: d, lifecycle_status: 'scheduled', version: 1, has_override: false,
          session_overrides_count: 0, added_sessions_count: 0, materialised_start_utc: `${d}T${p.default_local_start_time}:00+00:00`,
        })),
      });
    }
    return json(route, []);
  });
  await page.goto(path);
  await expect(page.getByTestId('account-new-page')).toBeVisible();
  return fake;
}

async function pickVenue(page: Page, term: string) {
  await page.getByTestId('create-venue-picker').getByRole('button', { name: 'Change venue' }).click();
  await page.locator('#create-venue').fill(term);
  await page.getByTestId('venue-option').first().click();
}

for (const width of [390, 768, 1280]) {
  test.describe(`organiser create @${width}`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('a weekly class: the preview follows the form; submit sends the create, the weekly rule and the review move, then lands on the series page', async ({ page }) => {
      // The organiser has a different city: the venue's city (London) still wins.
      const fake = await openCreate(page, undefined, { organiserCityId: ORG_CITY_ID });
      await expect(page.getByTestId('kind-weekly_class')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId('submit-review')).toBeDisabled();
      await expect(page.getByTestId('create-missing')).toHaveText('To continue, add a name, the first date, a start time and a venue. A draft can be saved without a venue.');

      await page.locator('#create-name').fill('Tuesday Bachata Class');
      // Choosing the day picks the next such date from today (a Sunday): Tue 6 Oct.
      await page.getByTestId('create-weekday').selectOption('2');
      await expect(page.locator('#create-date')).toHaveValue('2026-10-06');
      await page.locator('#create-start').fill('19:00');
      await page.locator('#create-end').fill('21:30');
      await pickVenue(page, 'Studio');
      await page.locator('#create-description').fill('Friendly weekly class.');
      await page.locator('#create-ticket').fill('https://tickets.example/tue');

      const preview = page.getByTestId('create-preview');
      await expect(preview.getByTestId('preview-title')).toHaveText('Tuesday Bachata Class');
      await expect(preview.getByTestId('preview-when')).toHaveText('Every Tuesday \u00b7 19:00\u201321:30 \u00b7 first Tue 6 Oct');
      await expect(preview.getByTestId('preview-where')).toHaveText('Studio 3, Battersea Arts Hub');
      await expect(preview).toContainText('Ritmo Bachata London');
      await expect(page.getByTestId('create-price-note')).toContainText('The Bachata Calendar team adds this');
      await expect(page.getByTestId('create-missing')).toHaveCount(0);
      // Mockup 02-A: the preview sits beside the form on a desktop, below it on a phone.
      const formBox = await page.getByTestId('create-fields').boundingBox();
      const previewBox = await preview.boundingBox();
      expect(formBox && previewBox).toBeTruthy();
      if (width >= 1024) expect(previewBox!.x).toBeGreaterThanOrEqual(formBox!.x + formBox!.width);
      else expect(previewBox!.y).toBeGreaterThanOrEqual(formBox!.y + formBox!.height);
      // The shared PageTransition fades in on a clock this spec freezes: let it settle so the image shows the page.
      await expect.poll(() => page.evaluate(() => {
        let n = document.querySelector('[data-testid="create-event"]') as HTMLElement | null;
        let min = 1;
        while (n) { min = Math.min(min, Number(getComputedStyle(n).opacity)); n = n.parentElement; }
        return min;
      }), { timeout: 15000 }).toBe(1);
      await page.screenshot({ path: `test-results/organiser-create-${width}.png` });

      await page.getByTestId('submit-review').click();
      await expect(page).toHaveURL(/\/account\/series\/[0-9a-f-]{36}$/);
      await expect(page.getByTestId('series-created')).toContainText('Sent for review');
      await expect(page.getByTestId('series-title')).toHaveText('Tuesday Bachata Class');
      await expect(page.getByTestId('series-lifecycle')).toHaveText('In review');

      expect(fake.sent).toHaveLength(3);
      const [create, rule, submit] = fake.sent;
      expect(create.target_id).toMatch(UUID);
      expect(page.url()).toContain(`/account/series/${create.target_id}`);
      expect(Object.keys(create).sort()).toEqual(['command', 'idempotency_key', 'target_id']);
      expect(create.command).toEqual({
        kind: 'series.upsert',
        payload: {
          name: 'Tuesday Bachata Class', format: 'recurring', category: 'class', default_start_date: '2026-10-06',
          default_local_start_time: '19:00', timezone: 'Europe/London', default_duration_minutes: 150, default_venue_id: 'ven-1',
          default_city_id: LONDON_ID, default_ticket_url: 'https://tickets.example/tue', default_description: 'Friendly weekly class.',
          organiser_ids: ['org-1'],
        },
      });
      expect(rule).toMatchObject({ target_id: create.target_id, expected_version: 2 });
      expect(rule.command).toEqual({ kind: 'series.set_recurrence', payload: { mode: 'weekly', weekdays: [2], end: { kind: 'none' } } });
      expect(submit).toMatchObject({ target_id: create.target_id, expected_version: 3 });
      expect(submit.command).toEqual({ kind: 'series.set_lifecycle', payload: { to: 'pending_review' } });
    });

    test('a party: save draft sends the create and its one date, with no review move', async ({ page }) => {
      const fake = await openCreate(page);
      await page.getByTestId('kind-party').click();
      await expect(page.getByTestId('kind-party')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId('create-weekday')).toHaveCount(0);
      await page.locator('#create-name').fill('Bachata Sundays Party');
      await page.locator('#create-date').fill('2026-10-17');
      await page.locator('#create-start').fill('20:00');
      await expect(page.getByTestId('create-preview').getByTestId('preview-when')).toHaveText('Sat 17 Oct \u00b7 20:00');
      await expect(page.getByTestId('create-preview').getByTestId('preview-where')).toHaveText('Venue to be confirmed');

      await page.getByTestId('save-draft').click();
      await expect(page).toHaveURL(/\/account\/series\/[0-9a-f-]{36}$/);
      await expect(page.getByTestId('series-created')).toContainText('Saved as a draft');
      await expect(page.getByTestId('series-lifecycle')).toHaveText('Draft');
      await expect(page.locator('[data-testid="series-date-row"][data-date="2026-10-17"]')).toBeVisible();

      expect(fake.sent.map((e) => e.command.kind)).toEqual(['series.upsert', 'series.add_date']);
      expect(fake.sent[0].command.payload).toEqual({
        name: 'Bachata Sundays Party', format: 'one_off', category: 'party', default_start_date: '2026-10-17',
        default_local_start_time: '20:00', timezone: 'Europe/London', organiser_ids: ['org-1'],
      });
      expect(fake.sent[1]).toMatchObject({ target_id: fake.sent[0].target_id, expected_version: 2, command: { kind: 'series.add_date', payload: { date: '2026-10-17' } } });
    });

    test('B1: a venue with no city sends the organiser city as default_city_id', async ({ page }) => {
      const fake = await openCreate(page, undefined, { organiserCityId: ORG_CITY_ID });
      await page.getByTestId('kind-party').click();
      await page.locator('#create-name').fill('Cityless Venue Party');
      await page.locator('#create-date').fill('2026-10-17');
      await page.locator('#create-start').fill('20:00');
      await pickVenue(page, 'Cityless');
      await page.getByTestId('save-draft').click();
      await expect(page).toHaveURL(/\/account\/series\/[0-9a-f-]{36}$/);
      expect(fake.sent[0].command.payload).toEqual({
        name: 'Cityless Venue Party', format: 'one_off', category: 'party', default_start_date: '2026-10-17',
        default_local_start_time: '20:00', timezone: 'Europe/London', default_venue_id: 'ven-3', default_city_id: ORG_CITY_ID,
        organiser_ids: ['org-1'],
      });
    });

    test('B1: no venue city and no organiser city leaves default_city_id out (never invented)', async ({ page }) => {
      const fake = await openCreate(page, undefined, { organiserCityId: null });
      await page.getByTestId('kind-party').click();
      await page.locator('#create-name').fill('No City Anywhere');
      await page.locator('#create-date').fill('2026-10-17');
      await page.locator('#create-start').fill('20:00');
      await pickVenue(page, 'Cityless');
      await page.getByTestId('save-draft').click();
      await expect(page).toHaveURL(/\/account\/series\/[0-9a-f-]{36}$/);
      expect(fake.sent[0].command.payload).toEqual({
        name: 'No City Anywhere', format: 'one_off', category: 'party', default_start_date: '2026-10-17',
        default_local_start_time: '20:00', timezone: 'Europe/London', default_venue_id: 'ven-3', organiser_ids: ['org-1'],
      });
      expect('default_city_id' in fake.sent[0].command.payload).toBe(false);
    });

    test('a draft organiser cannot create yet: the buttons say why, and switching to the live one lifts it', async ({ page }) => {
      const fake = await openCreate(page, '/account/new?organiser=org-2');
      await expect(page.getByTestId('create-organiser')).toHaveValue('org-2');
      await expect(page.getByTestId('create-blocked')).toContainText('Ritmo Sundays is not public yet');
      await page.locator('#create-name').fill('Sunday Social');
      await page.locator('#create-date').fill('2026-10-11');
      await page.locator('#create-start').fill('19:00');
      await expect(page.getByTestId('save-draft')).toBeDisabled();
      await expect(page.getByTestId('submit-review')).toBeDisabled();
      await expect(page.getByTestId('create-missing')).toHaveCount(0);

      await page.getByTestId('create-organiser').selectOption('org-1');
      await expect(page.getByTestId('create-blocked')).toHaveCount(0);
      await expect(page.getByTestId('save-draft')).toBeEnabled();
      await expect(page.getByTestId('create-preview')).toContainText('Ritmo Bachata London');
      expect(fake.sent).toHaveLength(0);
    });

    test('a refused create shows the copy, never the server text; a refused follow-up leaves the draft to open', async ({ page }) => {
      const fake = await openCreate(page);
      await page.getByTestId('kind-party').click();
      await page.locator('#create-name').fill('Masterclass night');
      await page.locator('#create-date').fill('2026-10-24');
      await page.locator('#create-start').fill('20:00');

      fake.refuse['series.upsert'] = 'permission_denied: series.upsert category must be party, class or workshop';
      await page.getByTestId('save-draft').click();
      await expect(page.getByTestId('create-error')).toContainText('That kind of event cannot be set here');
      await expect(page.getByTestId('create-error')).not.toContainText('permission_denied');
      await expect(page).toHaveURL(/\/account\/new/);
      await expect(page.getByTestId('save-draft')).toBeEnabled();
      // A server refusal stored nothing: the organiser can still fix the form.
      await expect(page.locator('#create-name')).toBeEnabled();
      expect(fake.sent).toHaveLength(1);

      fake.refuse['series.add_date'] = 'permission_denied: series.add_date date must be a YYYY-MM-DD date';
      await page.getByTestId('save-draft').click();
      await expect(page.getByTestId('create-error')).toContainText('saved as a draft');
      await expect(page.getByTestId('save-draft')).toHaveCount(0);
      await expect(page.getByTestId('open-draft')).toHaveAttribute('href', `/account/series/${fake.sent[1].target_id}`);
      expect(fake.sent.map((e) => e.command.kind)).toEqual(['series.upsert', 'series.upsert', 'series.add_date']);
      // One key for the create across retries: a refused create stored nothing, so the
      // same key ran fresh; the follow-up carries its own key.
      expect(fake.sent[1].idempotency_key).toBe(fake.sent[0].idempotency_key);
      expect(fake.sent[2].idempotency_key).not.toBe(fake.sent[1].idempotency_key);

      // The series page cannot add the schedule or submit, so the refused follow-up is
      // retried from here, under its own key kept across the retry.
      delete fake.refuse['series.add_date'];
      await page.getByTestId('finish-draft').click();
      await expect(page).toHaveURL(new RegExp(`/account/series/${fake.sent[1].target_id}$`));
      expect(fake.sent.map((e) => e.command.kind)).toEqual(['series.upsert', 'series.upsert', 'series.add_date', 'series.add_date']);
      expect(fake.sent[3].idempotency_key).toBe(fake.sent[2].idempotency_key);
    });

    test('a lost reply on the create: the retry replays the landed create and finishes; Enter sends nothing', async ({ page }) => {
      const fake = await openCreate(page);
      await page.getByTestId('kind-party').click();
      await page.locator('#create-name').fill('Bachata Sundays Party');
      await page.locator('#create-date').fill('2026-10-17');
      await page.locator('#create-start').fill('20:00');
      await page.locator('#create-name').press('Enter');
      await expect(page).toHaveURL(/\/account\/new/);
      expect(fake.sent).toHaveLength(0);

      fake.loseNextCreateReply = true;
      await page.getByTestId('save-draft').click();
      await expect(page.getByTestId('create-error')).toContainText('could not confirm the save');
      // It may have landed: the fields lock, so the retry cannot carry an edit the replay would drop.
      await expect(page.locator('#create-name')).toBeDisabled();
      await expect(page.getByTestId('kind-weekly_class')).toBeDisabled();
      await expect(page.getByTestId('save-draft')).toBeEnabled();
      await page.getByTestId('save-draft').click();
      await expect(page).toHaveURL(/\/account\/series\/[0-9a-f-]{36}$/);
      await expect(page.locator('[data-testid="series-date-row"][data-date="2026-10-17"]')).toBeVisible();
      expect(fake.sent.map((e) => e.command.kind)).toEqual(['series.upsert', 'series.upsert', 'series.add_date']);
      expect(fake.sent[1].idempotency_key).toBe(fake.sent[0].idempotency_key);
      expect(fake.sent[2]).toMatchObject({ expected_version: 2 });
    });
  });
}
