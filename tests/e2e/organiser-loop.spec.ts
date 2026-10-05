import { test, expect, type Page, type Route } from '@playwright/test';

// Lever 2, the WHOLE organiser loop in one journey: a new organiser signs in,
// creates their organiser, sends it for review, the team approves it, they
// create a weekly class, send it for review, the team approves that, the live
// page is linked, and a stranger's access request is granted on the team page.
//
// The other organiser-*.spec.ts files each prove ONE screen against its own fake.
// This spec proves the screens hand over to each other: the state one screen
// writes is the state the next one reads. Every **/auth/v1/** and **/rest/v1/**
// call is answered by ONE stateful fake of the server (create_organiser_profile_v1,
// submit_organiser_profile_v1, organiser_home_v1, series_command_p5,
// admin_event_workspace_p5, list/resolve_organiser_access_request_v1), and the
// "team approves" steps are the fake flipping lifecycle_status, exactly as the
// admin repo's moderation RPCs do. The server's own rules are proved in the admin
// repo; nothing here touches a real database.
// e2e-smoke.yml turns VITE_ENABLE_ORGANISER_SELF_SERVE on for the dev server.

const projectRef = 'stsdtacfauprzrdebmzg';
const ME = '11111111-1111-1111-1111-111111111111';
const REQUESTER = '44444444-4444-4444-4444-444444444444';
const ORG_ID = 'bbbbbbbb-0000-0000-0000-000000000001';
const NOW = new Date('2026-10-04T11:00:00Z');
const TODAY = '2026-10-04';
const LONDON = { id: 'cccccccc-0000-0000-0000-000000000001', name: 'London', slug: 'london', country_name: 'United Kingdom' };
const VENUES = [{ id: 'ven-1', name: 'Studio 3, Battersea Arts Hub', neighbourhood: 'Battersea', city_name: 'London' }];

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

/** The server: one organiser, at most one series, one pending access request. */
interface Server {
  organiser: { lifecycle: string } | null;
  series: { id: string; payload: Record<string, unknown>; version: number; lifecycle: string; rule: unknown; dates: string[]; slug: string | null } | null;
  members: { user_id: string; member_role: 'owner' | 'manager'; is_primary: boolean; joined_at: string; email: string; display_name: string | null }[];
  requests: { request_id: string; user_id: string; requester_email: string; message: string | null; created_at: string }[];
  rpcs: string[];
  envelopes: Envelope[];
}

async function start(page: Page): Promise<Server> {
  const server: Server = {
    organiser: null,
    series: null,
    members: [],
    requests: [],
    rpcs: [],
    envelopes: [],
  };
  const user = { id: ME, aud: 'authenticated', role: 'authenticated', email: 'diego@ritmo.example', user_metadata: {} };
  const token = `${b64url({ alg: 'HS256' })}.${b64url({ sub: ME, amr: [{ method: 'otp', timestamp: 1 }] })}.sig`;
  await page.addInitScript(
    ({ value, ref }) => localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(value)),
    { value: { access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'r', user }, ref: projectRef },
  );
  await page.route('**/auth/v1/**', (route) => json(route, route.request().url().includes('/user') ? user : {}));

  const home = () => ({
    today: TODAY,
    organisers: server.organiser
      ? [{
          id: ORG_ID, name: 'Salsa & Bachata Leeds', slug: server.organiser.lifecycle === 'live' ? 'salsa-bachata-leeds' : null, avatar_url: null,
          city_id: LONDON.id, lifecycle_status: server.organiser.lifecycle, role: 'owner', is_primary: true, joined_at: NOW.toISOString(), latest_decision: null,
          series: server.series
            ? [{ id: server.series.id, name: server.series.payload.name, slug: server.series.slug, format: 'recurring', category: 'class',
                 lifecycle_status: server.series.lifecycle, default_local_start_time: `${server.series.payload.default_local_start_time}:00`,
                 upcoming_count: 0, next_dates: [], latest_decision: null }]
            : [],
          team: server.members.map((m) => ({ ...m, is_self: m.user_id === ME })),
        }]
      : [],
  });

  await page.route('**/rest/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = (route.request().postDataJSON?.() ?? {}) as Record<string, unknown>;
    const rpc = path.match(/\/rpc\/([a-z0-9_]+)$/)?.[1];
    if (!rpc) return json(route, []);
    if (rpc !== 'organiser_home_v1') server.rpcs.push(rpc);

    if (rpc === 'organiser_home_v1') return json(route, home());
    if (rpc === 'search_cities') return json(route, [LONDON]);
    if (rpc === 'get_organiser_venue_options_v1' || rpc === 'get_public_venues_list_v4') return json(route, VENUES);

    if (rpc === 'create_organiser_profile_v1') {
      server.organiser = { lifecycle: 'draft' };
      server.members = [{ user_id: ME, member_role: 'owner', is_primary: true, joined_at: NOW.toISOString(), email: 'diego@ritmo.example', display_name: 'Diego R.' }];
      return json(route, { organiser_id: ORG_ID, slug: null, lifecycle_status: 'draft', member_role: 'owner', is_primary: true });
    }
    if (rpc === 'submit_organiser_profile_v1') {
      if (!server.organiser || server.organiser.lifecycle !== 'draft') return refuse(route, 'not_draft');
      server.organiser.lifecycle = 'pending_review';
      return json(route, { organiser_id: ORG_ID, from_state: 'draft', lifecycle_status: 'pending_review', audit_id: 'a1' });
    }

    if (rpc === 'series_command_p5') {
      const env = body.p_envelope as Envelope;
      server.envelopes.push(env);
      if (!server.organiser || server.organiser.lifecycle !== 'live') return refuse(route, 'organiser_not_live');
      const { kind, payload } = env.command;
      if (kind === 'series.upsert' && !server.series) {
        server.series = { id: env.target_id, payload, version: 2, lifecycle: 'draft', rule: null, dates: [], slug: null };
        return json(route, { ok: true, data: { is_create: true, series_id: env.target_id }, audit_id: 'a', new_version: 2 });
      }
      const s = server.series;
      if (!s || s.id !== env.target_id) return refuse(route, 'series_not_found');
      if (env.expected_version !== s.version) return refuse(route, `version_conflict: expected ${env.expected_version}, got ${s.version}`);
      if (kind === 'series.add_date') s.dates.push(String(payload.date));
      if (kind === 'series.set_recurrence') s.rule = payload;
      if (kind === 'series.set_lifecycle') s.lifecycle = String(payload.to);
      s.version += 1;
      return json(route, { ok: true, data: {}, audit_id: 'a', new_version: s.version });
    }
    if (rpc === 'admin_event_workspace_p5') {
      const s = server.series;
      if (!s || s.id !== body.p_series_id) return refuse(route, 'series_not_found');
      const p = s.payload;
      const minutes = typeof p.default_duration_minutes === 'number' ? p.default_duration_minutes : null;
      return json(route, {
        meta: { version: s.version, has_more: false },
        series: {
          series: {
            id: s.id, name: p.name, slug: s.slug, format: p.format, category: p.category, lifecycle_status: s.lifecycle, version: s.version,
            default_venue_id: p.default_venue_id ?? null, default_city_id: null, default_local_start_time: `${p.default_local_start_time}:00`,
            default_duration: minutes ? `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:00` : null,
            default_level: p.default_level ?? null, default_ticket_url: p.default_ticket_url ?? null, default_description: p.default_description ?? null,
            default_cover_image_url: p.default_cover_image_url ?? null, default_start_date: p.default_start_date, created_at: NOW.toISOString(),
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

    if (rpc === 'list_organiser_access_requests_v1') {
      if (body.p_scope === 'mine') return json(route, []);
      return json(route, server.requests.map((r) => ({ ...r, organiser_name: 'Salsa & Bachata Leeds' })));
    }
    if (rpc === 'resolve_organiser_access_request_v1') {
      const req = server.requests.find((r) => r.request_id === body.p_request_id);
      if (!req) return refuse(route, 'request_not_found');
      server.requests = server.requests.filter((r) => r !== req);
      if (body.p_decision === 'grant') {
        server.members.push({ user_id: req.user_id, member_role: 'manager', is_primary: false, joined_at: NOW.toISOString(), email: req.requester_email, display_name: null });
      }
      return json(route, { request_id: req.request_id, user_id: req.user_id, decision: body.p_decision, member_role: body.p_decision === 'grant' ? body.p_member_role : null });
    }
    return json(route, []);
  });
  return server;
}

async function pickVenue(page: Page, term: string) {
  await page.getByTestId('create-venue-picker').getByRole('button', { name: 'Change venue' }).click();
  await page.locator('#create-venue').fill(term);
  await page.getByTestId('venue-option').first().click();
}

for (const width of [390, 768, 1280]) {
  test.describe(`organiser loop @${width}`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('create an organiser, get it approved, create a class, get it approved, grant a team request', async ({ page }) => {
      const server = await start(page);

      // 1. A brand-new organiser creates their organiser from /account: a draft, then sent for review.
      await page.goto('/account');
      await expect(page.getByTestId('organiser-onboarding')).toBeVisible();
      await page.getByTestId('create-open').click();
      await page.getByTestId('create-name').fill('Salsa & Bachata Leeds');
      await page.getByTestId('create-form').getByRole('combobox').click();
      await page.getByRole('option', { name: /London/ }).click();
      await page.getByTestId('create-submit').click();
      await expect(page.getByTestId('organiser-status')).toHaveText('Draft');
      await page.getByTestId('send-for-review').click();
      await expect(page.getByTestId('organiser-status')).toHaveText('In review');
      expect(server.rpcs).toEqual(expect.arrayContaining(['create_organiser_profile_v1', 'submit_organiser_profile_v1']));

      // 2. While the organiser is in review the create screen cannot start a class: the server refuses
      //    (organiser_not_live) and the screen says the team is still checking it, never the server text.
      await page.goto(`/account/new?organiser=${ORG_ID}`);
      await expect(page.getByTestId('create-blocked')).toContainText('still checking Salsa & Bachata Leeds');
      await expect(page.getByTestId('create-blocked')).not.toContainText('organiser_not_live');
      await expect(page.getByTestId('save-draft')).toBeDisabled();
      expect(server.envelopes).toHaveLength(0);

      // 3. The team approves the organiser (the moderation RPC's effect): /account now shows it live.
      server.organiser!.lifecycle = 'live';
      await page.goto('/account');
      // A live organiser shows no status badge: it shows its public page and "New event".
      await expect(page.getByTestId('organiser-status')).toHaveCount(0);
      await expect(page.getByTestId('organiser-home').getByRole('link', { name: /Public page/ })).toHaveAttribute('href', '/organisers/salsa-bachata-leeds');

      // 4. Create a weekly class on the live organiser, from the "New event" button, and send it for review.
      await page.getByTestId('new-event').click();
      await expect(page).toHaveURL(new RegExp(`/account/new\\?organiser=${ORG_ID}$`));
      await expect(page.getByTestId('create-blocked')).toHaveCount(0);
      await page.locator('#create-name').fill('Tuesday Bachata Class');
      await page.getByTestId('create-weekday').selectOption('2');
      await page.locator('#create-start').fill('19:00');
      await page.locator('#create-end').fill('21:30');
      await pickVenue(page, 'Studio');
      await page.getByTestId('submit-review').click();
      await expect(page).toHaveURL(/\/account\/series\/[0-9a-f-]{36}$/);
      await expect(page.getByTestId('series-title')).toHaveText('Tuesday Bachata Class');
      await expect(page.getByTestId('series-lifecycle')).toHaveText('In review');
      await expect(page.getByTestId('review-strip')).toHaveAttribute('data-status', 'pending_review');
      await expect(page.getByTestId('review-strip').getByTestId('review-headline')).toHaveText('Waiting for the Bachata Calendar team');
      expect(server.envelopes.map((e) => e.command.kind)).toEqual(['series.upsert', 'series.set_recurrence', 'series.set_lifecycle']);
      expect(server.envelopes[0].command.payload).toMatchObject({ organiser_ids: [ORG_ID], default_venue_id: 'ven-1', category: 'class' });
      const seriesUrl = page.url();

      // 5. The team approves the class: the same page, re-read, is live and links the public page.
      server.series!.lifecycle = 'live';
      server.series!.slug = 'tuesday-bachata-class';
      await page.goto(seriesUrl);
      await expect(page.getByTestId('review-strip').getByTestId('review-headline')).toHaveText('Live on the calendar');
      await expect(page.getByTestId('series-view-as-dancer')).toHaveAttribute('href', '/event/tuesday-bachata-class');
      await expect(page.getByTestId('review-submit')).toHaveCount(0);

      // 6. A dancer asks for access: the owner finds it on the team page and grants it.
      server.requests.push({ request_id: 'req-1', user_id: REQUESTER, requester_email: 'maria.k@example.com', message: 'I teach with Diego on Tuesdays.', created_at: '2026-10-03T09:00:00+00:00' });
      await page.goto(`/account/team/${ORG_ID}`);
      await expect(page.getByTestId('team-title')).toHaveText('Salsa & Bachata Leeds');
      await expect(page.getByTestId('team-member')).toHaveCount(1);
      await expect(page.getByTestId('request-email')).toHaveText('maria.k@example.com');
      await page.getByTestId('request-grant').click();
      await expect(page.getByTestId('team-confirmation')).toContainText('maria.k@example.com can now edit');
      await expect(page.getByTestId('team-member')).toHaveCount(2);
      await expect(page.getByTestId('requests-empty')).toBeVisible();

      // 7. The account page now lists the organiser with its class, live.
      await page.goto('/account');
      await expect(page.getByTestId('organiser-home')).toContainText('Salsa & Bachata Leeds');
      await expect(page.getByTestId('organiser-home')).toContainText('Tuesday Bachata Class');
    });
  });
}
