import { expect, test, type Page, type Route } from '@playwright/test';
import { ME, json, projectRefFromUrl, refuse } from '../e2e/helpers/organiserFake';
import { FAKE_REF } from '../e2e-phone/fakeSupabase.mjs';

// W3 "an invite always names the person": "Who is this for?", its refusal screens, and the
// possible-duplicates repair on /admin/organisers, walked on the PRODUCTION build at 390x844.
// No real Supabase: every call is answered here. Shapes follow prod (2026-10-23, counts only):
// a page with one Leader, team members with and without a login, A2 applied or not.
// WALK_SHOTS=<dir> saves one screenshot per screen (the PR's design pack).

const REF = projectRefFromUrl(process.env.VITE_SUPABASE_URL) ?? FAKE_REF;
const TOKEN = 'd'.repeat(64);
const SHOTS = process.env.WALK_SHOTS;
const b64url = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const ORGS = [{ id: 'o-sv', name: 'Sensual Vibes', lifecycle_status: 'live' }];
const TEAM = [
  { member_profile_id: 'p-papa', is_leader: true },
  { member_profile_id: 'p-maria', is_leader: false },
];
const PEOPLE = [
  { id: 'p-papa', first_name: 'Papacito', surname: null, display_name: null },
  { id: 'p-maria', first_name: 'Maria', surname: 'Lopez', display_name: null },
];
// Not on the team list: found by the admin search RPC, which (unlike a table read) returns claimed_by.
const ROSA = { id: 'p-rosa', first_name: 'Rosa', surname: 'Lima', display_name: null, claimed_by: 'u-rosa' };
// A2's real answer shape (bachata-admin claude/invite-a2-identity-join, 20261205330000). A paused join is not a pair.
const NOT_LINKED = [
  { invite_id: 'i-tom', organiser_id: 'o-sv', organiser_name: 'Sensual Vibes', user_id: 'u-tom', person_profile_id: 'p-tom', person_label: 'Tom Reyes', attempted_at: '2026-10-22T10:00:00Z' },
];
const dupAnswer = (pairs: unknown[], notLinked: unknown[]) => ({
  healthy: pairs.length + notLinked.length === 0, count: pairs.length, pairs, not_linked_count: notLinked.length, not_linked: notLinked,
  dismissed_count: 0, measured_as: 'authenticated', checked_at: '2026-10-23T09:00:00Z',
});
const PAIRS = [
  { organiser_id: 'o-sv', organiser_name: 'Sensual Vibes', login_profile_id: 'p-jin', login_label: 'Jinder', premade_profile_id: 'p-papa', premade_label: 'Papacito', kind: 'team_stub' },
];
// The texts A2's dry run writes (20261205340000), for the Papacito shape.
const CHANGES = {
  changes: [
    { kind: 'team_drop', text: 'Remove the duplicate "Jinder" entry from the Sensual Vibes team list ("Papacito" stays on it)' },
    { kind: 'field_fill', text: 'Fill the empty description of "Papacito" from "Jinder"' },
    { kind: 'claim', text: '"Papacito" becomes the profile of the signed-in account; its pages and seats stay' },
    { kind: 'archive', text: 'Archive the duplicate profile "Jinder" (kept, not deleted)' },
    { kind: 'login_disable', text: 'Disable the unused sign-in that was never used (no email is sent)' },
  ],
  applied: false,
};

interface World { a2: boolean; pairs: unknown[]; notLinked: unknown[]; invite: 'ok' | 'email_in_use' | 'login_has_signed_in'; dry: 'ok' | 'two_real_logins' | 'nameless'; dismiss: 'ok' | 'missing' }
const missing = (route: Route, fn: string) => json(route, { code: 'PGRST202', message: `Could not find the function public.${fn}` }, 404);

async function install(page: Page, w: World, calls: { fn: string; body: Record<string, unknown> }[]) {
  const user = { id: ME, aud: 'authenticated', role: 'authenticated', email: 'admin@example.com', user_metadata: {} };
  const token = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: ME, role: 'authenticated' })}.sig`;
  await page.addInitScript(
    ({ value, ref }) => localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(value)),
    { value: { access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'r', user }, ref: REF },
  );
  await page.route('**/auth/v1/**', (route) => (route.request().url().includes('/auth/v1/user') ? json(route, user) : json(route, {})));
  await page.route('**/rest/v1/**', (route: Route) => {
    const url = new URL(route.request().url());
    const body = (route.request().postDataJSON?.() ?? {}) as Record<string, unknown>;
    if (url.pathname.includes('/rest/v1/rpc/')) {
      const fn = url.pathname.split('/rpc/')[1];
      calls.push({ fn, body });
      switch (fn) {
        case 'admin_is_admin': return json(route, true);
        case 'organiser_ownership_v1': return json(route, { is_managed: false, i_own_it: false, my_role: null });
        case 'admin_list_organiser_invites_v1': return json(route, []);
        case 'admin_list_invite_requests_v1': return json(route, []);
        case 'admin_list_signup_access_requests_v1': return json(route, []);
        case 'admin_search_people_v1': return json(route, String(body.p_query).toLowerCase().startsWith('ro') ? [ROSA] : []);
        case 'check_invitee_duplicates_v1': return w.a2 ? json(route, dupAnswer(w.pairs, w.notLinked)) : missing(route, fn);
        case 'admin_join_duplicate_people_v1':
          if (!w.a2) return missing(route, fn);
          if (body.p_dry_run === false) { w.pairs = w.pairs.slice(1); return json(route, { changes: CHANGES.changes, applied: true }); }
          if (w.dry === 'nameless') return json(route, { changes: [{ kind: 'claim', text: '"(no name)" becomes the profile of the signed-in account; its pages and seats stay' }, { kind: 'archive', text: 'Archive the duplicate profile "Jinder" (kept, not deleted)' }], applied: false });
          return json(route, w.dry === 'ok' ? CHANGES : { changes: [], refused: 'two_real_logins', applied: false });
        case 'admin_dismiss_invitee_duplicate_v1': return w.dismiss === 'missing' ? missing(route, fn) : json(route, { ok: true, dismissed: true });
        case 'admin_invite_person_v1':
          if (w.invite !== 'ok') return refuse(route, w.invite);
          return json(route, { invite_id: 'i9', token: TOKEN, email: body.p_email, link_path: `/invite/${TOKEN}`, message: `Hello Papacito! You are invited to manage Sensual Vibes on Bachata Calendar.\n\nOpen this link and sign in with ${body.p_email}:\nhttps://bachatacalendar.co.uk/invite/${TOKEN}\n\nThe link works for 7 days.` });
        default: return json(route, null);
      }
    }
    if (url.pathname.endsWith('/organiser_profiles')) return json(route, ORGS);
    if (url.pathname.endsWith('/organiser_team_members')) return json(route, TEAM);
    if (url.pathname.endsWith('/dancer_profiles')) return json(route, PEOPLE);
    return json(route, []);
  });
}

const shot = async (page: Page, name: string) => {
  if (!SHOTS) return;
  // From the top: a full-page shot taken mid-scroll paints the sticky header over the middle.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
};
const noSideScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
const openWho = async (page: Page) => {
  const r = page.getByTestId('organiser-row').filter({ hasText: 'Sensual Vibes' });
  await expect(r).not.toHaveAttribute('data-status', 'loading');
  await r.getByRole('button').first().click();
  await page.getByTestId('row-primary').click();
  await expect(page.getByTestId('invite-who')).toContainText('Who is this for?');
};
const world = (over: Partial<World> = {}): World => ({ a2: false, pairs: [], notLinked: [], invite: 'ok', dry: 'ok', dismiss: 'ok', ...over });

test('who is this for: the Leader pre-selected, email once, link ready (A2 not applied)', async ({ page }) => {
  const calls: { fn: string; body: Record<string, unknown> }[] = [];
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await install(page, world(), calls);
  await page.goto('/admin/organisers');
  await expect(page.getByTestId('dup-unavailable')).toContainText('available soon');
  await expect(page.getByTestId('dup-unavailable').locator('button')).toHaveCount(0);
  await noSideScroll(page);
  await shot(page, 'w3-01-admin-home-duplicates-available-soon');
  await openWho(page);
  await expect(page.getByTestId('who-pick').filter({ hasText: 'Papacito' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('who-leader-tag')).toHaveCount(1);
  await noSideScroll(page);
  await shot(page, 'w3-02-who-is-this-for');
  // Tap targets: every pick and action at least 44px tall (PLAN.md section 3).
  for (const b of await page.getByTestId('invite-who').locator('button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.getByTestId('who-next').click();
  await expect(page.getByTestId('who-email-person')).toHaveText('Papacito');
  await expect(page.getByTestId('who-email-person')).toBeFocused();
  await page.getByTestId('who-email-input').fill('papacito@example.com');
  await shot(page, 'w3-03-their-email');
  await page.getByTestId('who-submit').click();
  await expect(page.getByTestId('invite-person-result')).toContainText('Invite link ready for Papacito.');
  // The link is shown once: the row cannot be closed until Done.
  await page.getByTestId('organiser-row').filter({ hasText: 'Sensual Vibes' }).getByRole('button').first().click();
  await expect(page.getByTestId('link-close-warning')).toBeVisible();
  await expect(page.getByTestId('invite-person-result')).toBeVisible();
  await noSideScroll(page);
  await shot(page, 'w3-04-invite-ready');
  expect(calls.filter((c) => c.fn === 'admin_invite_person_v1').map((c) => c.body)).toEqual([{ p_dancer_profile_id: 'p-papa', p_email: 'papacito@example.com', p_organiser_id: 'o-sv' }]);
  expect(calls.some((c) => c.fn === 'admin_issue_organiser_invite_v1')).toBe(false);
  expect(errors).toEqual([]);
});

test('refusal screens: email_in_use before and after A2, a used login', async ({ page }) => {
  const w = world({ invite: 'email_in_use' });
  const calls: { fn: string; body: Record<string, unknown> }[] = [];
  await install(page, w, calls);
  await page.goto('/admin/organisers');
  await openWho(page);
  await page.getByTestId('who-next').click();
  await page.getByTestId('who-email-input').fill('old.login@example.com');
  await page.getByTestId('who-submit').click();
  await expect(page.getByTestId('invite-refused')).toHaveAttribute('data-code', 'email_in_use');
  await expect(page.getByTestId('invite-refused')).toContainText('available soon');
  await expect(page.getByTestId('invite-refused-title')).toBeFocused();
  await noSideScroll(page);
  await shot(page, 'w3-05-refused-email-in-use-before-a2');
  // A used login on the person: a login someone has signed into is never switched.
  w.invite = 'login_has_signed_in';
  await page.getByTestId('invite-refused-who').click();
  await page.getByTestId('who-search').fill('Rosa');
  await page.getByTestId('who-pick').filter({ hasText: 'Rosa Lima' }).click();
  await page.getByTestId('who-next').click();
  await expect(page.getByTestId('who-has-login')).toBeVisible();
  await shot(page, 'w3-06-email-person-has-login');
  await page.getByTestId('who-email-input').fill('rosa@example.com');
  await page.getByTestId('who-submit').click();
  await expect(page.getByTestId('invite-refused')).toHaveAttribute('data-code', 'login_has_signed_in');
  await noSideScroll(page);
  await shot(page, 'w3-07-refused-login-has-signed-in');
});

test('email_in_use after A2 is applied: no "available soon"', async ({ page }) => {
  await install(page, world({ a2: true, invite: 'email_in_use' }), []);
  await page.goto('/admin/organisers');
  await expect(page.getByTestId('dup-none')).toBeVisible();
  await openWho(page);
  await page.getByTestId('who-next').click();
  await page.getByTestId('who-email-input').fill('taken@example.com');
  await page.getByTestId('who-submit').click();
  await expect(page.getByTestId('invite-refused')).not.toContainText('available soon');
  await shot(page, 'w3-08-refused-email-in-use-after-a2');
});

test('possible duplicates: alert, Same person?, What will change, second confirm, Joined', async ({ page }) => {
  const calls: { fn: string; body: Record<string, unknown> }[] = [];
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await install(page, world({ a2: true, pairs: [...PAIRS], notLinked: [...NOT_LINKED] }), calls);
  await page.goto('/admin/organisers');
  await expect(page.getByTestId('dup-count')).toHaveText('2 possible duplicates');
  await expect(page.getByTestId('dup-paused')).toContainText('Tom Reyes tried to join Sensual Vibes; the join is paused.');
  await expect(page.getByTestId('dup-paused').getByRole('button')).toHaveCount(0);
  await noSideScroll(page);
  await shot(page, 'w3-09-duplicates-alert');
  await page.getByTestId('dup-review').first().click();
  await expect(page.getByTestId('dup-same')).toContainText('Same person?');
  await noSideScroll(page);
  await shot(page, 'w3-10-same-person');
  await page.getByTestId('dup-show-changes').click();
  await expect(page.getByTestId('dup-change-list')).toContainText('"Papacito" becomes the profile of the signed-in account');
  await shot(page, 'w3-11-what-will-change');
  await page.getByTestId('dup-join').click();
  await expect(page.getByTestId('dup-confirm')).toContainText('Join these two into one?');
  await shot(page, 'w3-12-second-confirm');
  const real = () => calls.filter((c) => c.fn === 'admin_join_duplicate_people_v1' && c.body.p_dry_run === false);
  expect(real()).toHaveLength(0);
  await page.getByTestId('dup-confirm-yes').click();
  await expect(page.getByTestId('dup-joined')).toContainText('Joined. Papacito is one profile now');
  await noSideScroll(page);
  await shot(page, 'w3-13-joined');
  expect(real().map((c) => c.body)).toEqual([{ p_keep_profile: 'p-papa', p_fold_profile: 'p-jin', p_dry_run: false }]);
  await page.getByTestId('dup-close').click();
  await expect(page.getByTestId('dup-count')).toHaveText('1 possible duplicate');
  expect(errors).toEqual([]);
});

test('duplicates refusals: two used logins; dismiss before its RPC exists', async ({ page }) => {
  await install(page, world({ a2: true, pairs: [PAIRS[0]], dry: 'two_real_logins', dismiss: 'missing' }), []);
  await page.goto('/admin/organisers');
  await page.getByTestId('dup-review').click();
  await page.getByTestId('dup-not-same').click();
  await expect(page.getByTestId('dup-dismiss-error')).toContainText('not applied yet');
  await shot(page, 'w3-14-dismiss-not-available');
  await page.getByTestId('dup-show-changes').click();
  await expect(page.getByTestId('dup-dry-refused')).toContainText('two real people');
  await expect(page.getByTestId('dup-join')).toBeDisabled();
  await noSideScroll(page);
  await shot(page, 'w3-15-refused-both-signed-in');
});

// Mocked shape: the RPC labels a profile an admin made with no first name as the literal "(no name)".
test('nameless profile: reads "no name yet" on every duplicates screen, never "(no name)"', async ({ page }) => {
  if (process.env.WALK_VIEWPORT === '360x640') await page.setViewportSize({ width: 360, height: 640 });
  const pair = { ...PAIRS[0], premade_label: '(no name)' };
  await install(page, world({ a2: true, pairs: [pair], notLinked: [], dry: 'nameless' }), []);
  await page.goto('/admin/organisers');
  const row = page.getByTestId('dup-pair');
  await expect(row).toContainText('Jinder signed up and is on the Sensual Vibes team list next to a profile with no name yet, a profile you made.');
  await noSideScroll(page);
  await shot(page, 'noname-01-alert');
  await page.getByTestId('dup-review').click();
  await expect(page.getByTestId('dup-same')).toContainText('see one profile with no name yet');
  await shot(page, 'noname-02-same-person');
  await page.getByTestId('dup-show-changes').click();
  await expect(page.getByTestId('dup-change-list')).toContainText('The profile with no name yet becomes the profile');
  await page.getByTestId('dup-join').click();
  await page.getByTestId('dup-confirm-yes').click();
  await expect(page.getByTestId('dup-joined')).toContainText('Joined. This profile has no name yet and is one profile now');
  await noSideScroll(page);
  await shot(page, 'noname-03-joined');
  const text = (await page.locator('body').innerText());
  expect(text).not.toMatch(/\(no name\)|Unnamed profile/);
});
