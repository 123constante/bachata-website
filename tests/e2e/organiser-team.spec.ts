import { test, expect, type Page, type Route } from '@playwright/test';

// Lever 2 W6: the review status strip on /account/series/:id (mockup 05-A) and
// the team page /account/team/:organiserId (05-B's account page for team and
// access requests). Every **/auth/v1/** and **/rest/v1/** call is mocked with a
// STATEFUL fake of organiser_home_v1 (admin D7 team keys),
// list_organiser_access_requests_v1 / resolve_organiser_access_request_v1 (D4)
// and remove_organiser_member_v1 (D7), so each write is asserted by the exact
// request body the page sends and the page is then checked to re-read the
// result. The server's acceptance of these calls is proved separately on E2E
// (PR body). e2e-smoke.yml turns VITE_ENABLE_ORGANISER_SELF_SERVE on.

const projectRef = 'stsdtacfauprzrdebmzg';
const ME = '11111111-1111-1111-1111-111111111111';
const OTHER_OWNER = '22222222-2222-2222-2222-222222222222';
const MANAGER = '33333333-3333-3333-3333-333333333333';
const REQUESTER = '44444444-4444-4444-4444-444444444444';
const ORG = 'org-1';
const SERIES = 'ser-1';
/** The fake's 'now' for rows it creates; the page's clock is not frozen (a frozen clock stalls the route fade-in). */
const NOW = new Date('2026-10-04T11:00:00Z');

const b64url = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

const refuse = (route: Route, message: string) => json(route, { code: 'P0001', message, details: null, hint: null }, 400);

interface Member { user_id: string; member_role: 'owner' | 'manager'; is_primary: boolean; joined_at: string; email: string; display_name: string | null }
interface Request { request_id: string; user_id: string; requester_email: string; message: string | null; created_at: string }
interface Call { rpc: string; body: Record<string, unknown> }

interface Fake {
  calls: Call[];
  refuseNext: string | null;
  members: Member[];
  requests: Request[];
}

interface Options {
  /** The signed-in user's role on the organiser. */
  role?: 'owner' | 'manager';
  /** The second owner is absent: the signed-in owner is the last one. */
  soleOwner?: boolean;
  seriesStatus?: string;
  decision?: Record<string, unknown> | null;
  path: string;
}

async function open(page: Page, opts: Options): Promise<Fake> {
  const role = opts.role ?? 'owner';
  const fake: Fake = {
    calls: [],
    refuseNext: null,
    members: [
      { user_id: role === 'owner' ? ME : OTHER_OWNER, member_role: 'owner', is_primary: true, joined_at: '2026-09-01T10:00:00+00:00', email: 'diego@ritmo.example', display_name: 'Diego R.' },
      ...(opts.soleOwner ? [] : [{ user_id: role === 'owner' ? OTHER_OWNER : '55555555-5555-5555-5555-555555555555', member_role: 'owner' as const, is_primary: false, joined_at: '2026-09-02T10:00:00+00:00', email: 'sofia@ritmo.example', display_name: null }]),
      { user_id: role === 'manager' ? ME : MANAGER, member_role: 'manager', is_primary: false, joined_at: '2026-09-03T10:00:00+00:00', email: 'ana@ritmo.example', display_name: 'Ana M.' },
    ],
    requests: [
      { request_id: 'req-1', user_id: REQUESTER, requester_email: 'maria.k@example.com', message: 'I run the Sunday party with Diego, can I get access?', created_at: '2026-10-03T09:00:00+00:00' },
    ],
  };
  const series = {
    id: SERIES, name: 'Thursday Bachata Class', slug: 'thursday-bachata-class', format: 'recurring', category: 'class',
    lifecycle_status: opts.seriesStatus ?? 'live', version: 3, default_venue_id: 'ven-1', default_city_id: 'city-1',
    default_local_start_time: '19:30:00', default_duration: '02:00:00', default_level: 'beginner',
    default_ticket_url: null, default_description: null, default_cover_image_url: null, default_start_date: '2026-09-01',
    created_at: '2026-09-01T10:00:00+00:00', recurrence_rule: { mode: 'weekly', weekdays: [4], end: { kind: 'none' } }, removed_dates: [],
  };

  const home = () => ({
    today: '2026-10-04',
    organisers: [{
      id: ORG, name: 'Ritmo Bachata London', slug: 'ritmo', avatar_url: null, city_id: null, lifecycle_status: 'live',
      role, is_primary: role === 'owner', joined_at: '2026-09-01T10:00:00+00:00', latest_decision: null,
      series: [{ id: SERIES, name: series.name, slug: series.slug, format: 'recurring', category: 'class', lifecycle_status: series.lifecycle_status,
        default_local_start_time: '19:30:00', upcoming_count: 0, next_dates: [], latest_decision: opts.decision ?? null }],
      team: fake.members.map((m) => ({ ...m, is_self: m.user_id === ME })),
    }],
  });

  const user = { id: ME, aud: 'authenticated', role: 'authenticated', email: 'diego@ritmo.example', user_metadata: {} };
  const token = `${b64url({ alg: 'HS256' })}.${b64url({ sub: ME, amr: [{ method: 'otp', timestamp: 1 }] })}.sig`;
  await page.addInitScript(
    ({ value, ref }) => localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(value)),
    { value: { access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'r', user }, ref: projectRef },
  );
  await page.route('**/auth/v1/**', (route) => json(route, route.request().url().includes('/user') ? user : {}));
  await page.route('**/rest/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = (route.request().postDataJSON?.() ?? {}) as Record<string, unknown>;
    const rpc = path.match(/\/rpc\/([a-z0-9_]+)$/)?.[1];
    if (!rpc) return json(route, []);
    if (rpc === 'organiser_home_v1') return json(route, home());
    if (rpc === 'admin_event_workspace_p5') return json(route, { meta: { version: series.version, has_more: false }, series: { series, program: [] }, occurrences: [] });
    if (rpc === 'list_organiser_access_requests_v1') {
      fake.calls.push({ rpc, body });
      if (body.p_scope === 'mine') return json(route, []);
      return json(route, fake.requests.map((r) => ({ ...r, organiser_name: 'Ritmo Bachata London' })));
    }
    if (rpc === 'resolve_organiser_access_request_v1' || rpc === 'remove_organiser_member_v1' || rpc === 'series_command_p5') {
      fake.calls.push({ rpc, body });
      if (fake.refuseNext) {
        const message = fake.refuseNext;
        fake.refuseNext = null;
        return refuse(route, message);
      }
    }
    if (rpc === 'resolve_organiser_access_request_v1') {
      const req = fake.requests.find((r) => r.request_id === body.p_request_id);
      if (!req) return refuse(route, 'request_not_found');
      fake.requests = fake.requests.filter((r) => r !== req);
      if (body.p_decision === 'grant') {
        fake.members.push({ user_id: req.user_id, member_role: 'manager', is_primary: false, joined_at: NOW.toISOString(), email: req.requester_email, display_name: null });
      }
      return json(route, { request_id: req.request_id, user_id: req.user_id, decision: body.p_decision, member_role: body.p_decision === 'grant' ? body.p_member_role : null });
    }
    if (rpc === 'remove_organiser_member_v1') {
      const m = fake.members.find((x) => x.user_id === body.p_user_id);
      if (!m) return refuse(route, 'not_a_member');
      fake.members = fake.members.filter((x) => x !== m);
      return json(route, { user_id: m.user_id, member_role: m.member_role, removed_rows: 1, self_removed: m.user_id === ME, primary_passed_to: null, audit_id: 'a' });
    }
    if (rpc === 'series_command_p5') {
      const env = body.p_envelope as { command: { kind: string; payload: { to?: string } }; expected_version?: number };
      if (env.expected_version !== series.version) return refuse(route, `version_conflict: expected ${env.expected_version}, got ${series.version}`);
      if (env.command.kind === 'series.set_lifecycle' && env.command.payload.to) series.lifecycle_status = env.command.payload.to;
      series.version += 1;
      return json(route, { ok: true, data: {}, audit_id: 'a', new_version: series.version });
    }
    return json(route, []);
  });
  await page.goto(opts.path);
  return fake;
}

const member = (page: Page, role: 'owner' | 'manager', self = false) =>
  page.locator(`[data-testid="team-member"][data-role="${role}"][data-self="${self}"]`);

/** For screenshots only: let the route's fade-in (PageTransition) finish. */
const settle = (page: Page) => page.waitForTimeout(600);

for (const width of [390, 768, 1280]) {
  test.describe(`organiser team page @${width}`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('an owner reads the team, removes a manager, grants a request and declines another', async ({ page }) => {
      const fake = await open(page, { path: `/account/team/${ORG}` });
      await expect(page.getByTestId('team-title')).toHaveText('Ritmo Bachata London');
      await expect(page.getByTestId('team-member')).toHaveCount(3);
      await expect(member(page, 'owner', true)).toContainText('Diego R.');
      await expect(member(page, 'owner', true)).toContainText('you');
      // D7 shows the email alongside a sign-up name; a nameless owner is labelled by email.
      await expect(member(page, 'owner', false)).toContainText('sofia@ritmo.example');
      // Another owner cannot be removed here (cannot_remove_owner); the button says why.
      await expect(member(page, 'owner', false).getByTestId('member-remove')).toBeDisabled();
      await expect(member(page, 'owner', false).getByTestId('member-note')).toContainText('cannot be removed here');
      // With a second owner present, this owner may leave.
      await expect(member(page, 'owner', true).getByTestId('member-leave')).toBeEnabled();

      // The incoming request, with the requester's message. The read is per organiser.
      const list = fake.calls.find((c) => c.rpc === 'list_organiser_access_requests_v1' && c.body.p_scope === 'incoming');
      expect(list?.body).toEqual({ p_organiser_id: ORG, p_scope: 'incoming' });
      await expect(page.getByTestId('access-request')).toHaveCount(1);
      await expect(page.getByTestId('request-email')).toHaveText('maria.k@example.com');
      await expect(page.getByTestId('request-message')).toContainText('I run the Sunday party with Diego');
      await expect(page.getByTestId('access-request')).toContainText('Asked Sat 3 Oct');
      await expect(page.getByTestId('access-howto')).toContainText('Request access');
      await settle(page);
      await page.screenshot({ path: `test-results/organiser-team-${width}.png`, fullPage: true });

      // 1. Remove the manager: asks first, then the exact RPC body, then the list re-reads.
      await member(page, 'manager').getByTestId('member-remove').click();
      await expect(page.getByTestId('member-confirm')).toContainText('Remove Ana M.?');
      await page.getByTestId('member-confirm-yes').click();
      await expect(page.getByTestId('team-confirmation')).toContainText('Ana M. no longer has access.');
      expect(fake.calls.filter((c) => c.rpc === 'remove_organiser_member_v1').map((c) => c.body)).toEqual([{ p_organiser_id: ORG, p_user_id: MANAGER }]);
      await expect(page.getByTestId('team-member')).toHaveCount(2);

      // 2. Grant the request as a manager: the requester joins the team, the request leaves the list.
      await page.getByTestId('request-grant').click();
      await expect(page.getByTestId('team-confirmation')).toContainText('maria.k@example.com can now edit');
      const resolves = fake.calls.filter((c) => c.rpc === 'resolve_organiser_access_request_v1').map((c) => c.body);
      expect(resolves).toEqual([{ p_request_id: 'req-1', p_decision: 'grant', p_member_role: 'manager' }]);
      await expect(page.getByTestId('requests-empty')).toBeVisible();
      await expect(page.getByTestId('team-member')).toHaveCount(3);
      await expect(member(page, 'manager')).toContainText('maria.k@example.com');

      // 3. Decline the next one: no role, no note.
      fake.requests.push({ request_id: 'req-2', user_id: '66666666-6666-6666-6666-666666666666', requester_email: 'spam@example.com', message: null, created_at: '2026-10-04T08:00:00+00:00' });
      await page.reload();
      await expect(page.getByTestId('access-request')).toHaveCount(1);
      await page.getByTestId('request-decline').click();
      await expect(page.getByTestId('team-confirmation')).toContainText('Declined.');
      expect(fake.calls.filter((c) => c.rpc === 'resolve_organiser_access_request_v1').map((c) => c.body).pop()).toEqual({ p_request_id: 'req-2', p_decision: 'decline' });

      // Nothing but the three team RPCs and the reads ever left the page.
      expect(new Set(fake.calls.map((c) => c.rpc))).toEqual(new Set(['list_organiser_access_requests_v1', 'remove_organiser_member_v1', 'resolve_organiser_access_request_v1']));
    });

    test('the series page shows where the event is in review and sends a draft for review', async ({ page }) => {
      const fake = await open(page, { path: `/account/series/${SERIES}`, seriesStatus: 'draft' });
      const strip = page.getByTestId('review-strip');
      await expect(strip).toHaveAttribute('data-status', 'draft');
      await expect(strip.getByTestId('review-headline')).toHaveText('Draft, not public yet');
      await expect(strip.locator('[data-testid="review-step"][data-step="draft"]')).toHaveAttribute('data-state', 'current');
      await expect(strip.locator('[data-testid="review-step"][data-step="live"]')).toHaveAttribute('data-state', 'todo');
      // No unlisted preview: the public read only serves a live series.
      await expect(strip.getByTestId('review-preview-note')).toContainText('once it is live');
      await expect(page.getByTestId('series-view-as-dancer')).toHaveCount(0);
      await settle(page);
      await page.screenshot({ path: `test-results/organiser-review-strip-draft-${width}.png` });

      await strip.getByTestId('review-submit').click();
      await expect(page.getByTestId('series-confirmation')).toContainText('Sent for review');
      const sent = fake.calls.filter((c) => c.rpc === 'series_command_p5').map((c) => c.body.p_envelope as Record<string, unknown>);
      expect(sent).toHaveLength(1);
      expect(sent[0].target_id).toBe(SERIES);
      expect(sent[0].expected_version).toBe(3);
      expect(sent[0].command).toEqual({ kind: 'series.set_lifecycle', payload: { to: 'pending_review' } });
      // The page re-reads: in review now, nothing left to submit.
      await expect(strip).toHaveAttribute('data-status', 'pending_review');
      await expect(strip.getByTestId('review-headline')).toHaveText('Waiting for the Bachata Calendar team');
      await expect(strip.getByTestId('review-submit')).toHaveCount(0);
      await expect(page.getByTestId('series-lifecycle')).toHaveText('In review');
    });
  });
}

test('a returned series shows the admin message and offers to send it again', async ({ page }) => {
  await open(page, {
    path: `/account/series/${SERIES}`,
    seriesStatus: 'rejected',
    decision: { action: 'rejected', from_state: 'pending_review', to_state: 'rejected', reason: 'Could you add the price and confirm the venue is The Loft?', created_at: '2026-10-01T18:00:00+00:00' },
  });
  const strip = page.getByTestId('review-strip');
  await expect(strip.getByTestId('review-headline')).toHaveText('Returned with a message');
  await expect(strip.getByTestId('review-reason')).toContainText('Could you add the price and confirm the venue is The Loft?');
  await expect(strip.getByTestId('review-reason')).toContainText('Returned on Thu 1 Oct');
  await expect(strip.locator('[data-testid="review-step"][data-step="review"]')).toHaveAttribute('data-state', 'returned');
  await expect(strip.getByTestId('review-submit')).toHaveText(/Send again for review/);
  await settle(page);
  await page.screenshot({ path: 'test-results/organiser-review-strip-returned.png' });
});

test('a live series links the public page as a dancer sees it', async ({ page }) => {
  await open(page, { path: `/account/series/${SERIES}`, seriesStatus: 'live' });
  const strip = page.getByTestId('review-strip');
  await expect(strip.getByTestId('review-headline')).toHaveText('Live on the calendar');
  await expect(strip.getByTestId('series-view-as-dancer')).toHaveAttribute('href', '/event/thursday-bachata-class');
  await expect(strip.getByTestId('review-submit')).toHaveCount(0);
});

test('a server refusal on submit reads as plain words', async ({ page }) => {
  const fake = await open(page, { path: `/account/series/${SERIES}`, seriesStatus: 'draft' });
  fake.refuseNext = 'publish_blocked: series has no venue';
  await page.getByTestId('review-submit').click();
  await expect(page.getByTestId('review-error')).toContainText('needs more details before it can go live');
  await expect(page.getByTestId('review-strip')).not.toContainText('publish_blocked');
});

test('the last owner cannot leave, and the server refusal reads as plain words', async ({ page }) => {
  const fake = await open(page, { path: `/account/team/${ORG}`, soleOwner: true });
  await expect(page.getByTestId('team-member')).toHaveCount(2);
  const me = member(page, 'owner', true);
  await expect(me.getByTestId('member-leave')).toBeDisabled();
  await expect(me.getByTestId('member-note')).toContainText('only owner');
  // The server is the authority: a refusal it raises anyway is shown in the organiser's words.
  fake.refuseNext = 'last_owner';
  await member(page, 'manager').getByTestId('member-remove').click();
  await page.getByTestId('member-confirm-yes').click();
  await expect(page.getByTestId('team-error')).toContainText('You are the only owner');
  await expect(page.getByTestId('team-panel')).not.toContainText('last_owner');
});

test('a manager sees the team and the requests but may only leave', async ({ page }) => {
  const fake = await open(page, { path: `/account/team/${ORG}`, role: 'manager' });
  await expect(page.getByTestId('team-member')).toHaveCount(3);
  await expect(page.getByTestId('member-remove')).toHaveCount(0);
  await expect(page.getByTestId('request-grant')).toHaveCount(0);
  await expect(page.getByTestId('requests-owner-only')).toBeVisible();
  const me = member(page, 'manager', true);
  await me.getByTestId('member-leave').click();
  await expect(page.getByTestId('member-confirm')).toContainText('Leave this team?');
  await page.getByTestId('member-confirm-yes').click();
  // Leaving sends the caller's own id and lands back on the account page.
  await expect(page).toHaveURL(/\/account$/);
  expect(fake.calls.filter((c) => c.rpc === 'remove_organiser_member_v1').map((c) => c.body)).toEqual([{ p_organiser_id: ORG, p_user_id: ME }]);
});

test("another organiser's team shows the refusal, not a list", async ({ page }) => {
  await open(page, { path: '/account/team/org-not-mine' });
  await expect(page.getByTestId('team-unavailable')).toBeVisible();
  await expect(page.getByTestId('team-panel')).toHaveCount(0);
});

test('the account page links the team page', async ({ page }) => {
  await open(page, { path: '/account' });
  await page.getByTestId('team-link').click();
  await expect(page).toHaveURL(new RegExp(`/account/team/${ORG}$`));
  await expect(page.getByTestId('team-title')).toHaveText('Ritmo Bachata London');
});
