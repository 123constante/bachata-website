import { expect, test, type Page, type Route } from '@playwright/test';
import { ME, json, projectRefFromUrl } from '../e2e/helpers/organiserFake';
import { FAKE_REF } from '../e2e-phone/fakeSupabase.mjs';

// Arc 1 PR 2 slice B: the sender screens on /admin/organisers (mockups 5a-5f) and the two
// request lists, walked on the PRODUCTION build at 390x844 with seeded fixtures for every
// invite status and every returned refusal. No real Supabase: every call is answered here.
// WALK_SHOTS=<dir> saves one screenshot per screen (the PR's browser-walk evidence).

const REF = projectRefFromUrl(process.env.VITE_SUPABASE_URL) ?? FAKE_REF;
const TOKEN = 'c'.repeat(64);
const SHOTS = process.env.WALK_SHOTS;
const b64url = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const ORGS = [
  { id: 'o-un', name: 'Salsa Norte', lifecycle_status: 'live' },
  { id: 'o-rv', name: 'Bachata Revoked', lifecycle_status: 'live' },
  { id: 'o-in', name: 'Bravo Invited', lifecycle_status: 'live' },
  { id: 'o-ex', name: 'Charlie Expired', lifecycle_status: 'live' },
  { id: 'o-mg', name: 'Delta Managed', lifecycle_status: 'live' },
  { id: 'o-dr', name: 'Echo Draft', lifecycle_status: 'draft' },
];
const inv = (status: string, extra: Record<string, unknown> = {}) => ({ invite_id: `i-${status}`, status, issued_at: '2026-10-14T10:00:00Z', expires_at: '2026-10-28T10:00:00Z', used_at: null, revoked_at: null, ...extra });
const INVITES: Record<string, unknown[]> = {
  'o-rv': [inv('revoked', { revoked_at: '2026-10-15T10:00:00Z' })],
  'o-in': [inv('sent')],
  'o-ex': [inv('expired', { expires_at: '2026-10-08T10:00:00Z' })],
  'o-mg': [inv('used', { used_at: '2026-10-21T09:00:00Z' })],
};

async function install(page: Page, calls: { fn: string; body: Record<string, unknown> }[]) {
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
        case 'organiser_ownership_v1': return json(route, { is_managed: body.p_organiser_id === 'o-mg', i_own_it: false, my_role: null });
        case 'admin_list_organiser_invites_v1': return json(route, INVITES[body.p_organiser_id as string] ?? []);
        case 'admin_issue_organiser_invite_v1':
          if (body.p_first_name === 'X'.repeat(3)) return json(route, { ok: false, reason: 'invalid_first_name' });
          return json(route, { ok: true, invite_id: 'i9', organiser_id: body.p_organiser_id, token: TOKEN, expires_at: '2026-10-28T10:00:00Z', email_bound: !!body.p_email, revoked_previous: [] });
        case 'admin_list_invite_requests_v1':
          return json(route, [{ id: 'r1', organiser_id: 'o-ex', organiser_name: 'Charlie Expired', invite_id: 'i-expired', invite_email: 'luis@example.com', requested_at: '2026-10-21T08:00:00Z', handled_at: null }]);
        case 'admin_list_signup_access_requests_v1':
          return json(route, [
            { id: 'a1', email: 'new.organiser@example.com', note: 'I run Sunday socials in Leeds.', requested_at: '2026-10-21T07:00:00Z', status: 'pending' },
            { id: 'a2', email: 'old@example.com', note: null, requested_at: '2026-10-19T07:00:00Z', status: 'dismissed' },
          ]);
        // A2 not applied yet: the duplicate check is missing, so the alert says "available soon".
        case 'check_invitee_duplicates_v1': return json(route, { code: 'PGRST202', message: 'Could not find the function public.check_invitee_duplicates_v1' }, 404);
        case 'admin_resolve_invite_request_v1': return json(route, { ok: true });
        case 'admin_resolve_signup_access_request_v1': return json(route, { ok: false, reason: 'already_handled' });
        default: return json(route, null);
      }
    }
    if (url.pathname.endsWith('/organiser_profiles')) return json(route, ORGS);
    return json(route, []);
  });
}

const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
};
const noSideScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
const row = (page: Page, name: string) => page.getByTestId('organiser-row').filter({ hasText: name });
const openRow = async (page: Page, name: string) => {
  const r = row(page, name);
  await expect(r).not.toHaveAttribute('data-status', 'loading');
  await r.getByRole('button').first().click();
  return r;
};

test('sender: every status, the Invite sheet, the link form and both request lists at 390x844', async ({ page }) => {
  const calls: { fn: string; body: Record<string, unknown> }[] = [];
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await install(page, calls);
  await page.goto('/admin/organisers');

  // The list: one chip per status (5a, 5d, 5e, 5f).
  await expect(row(page, 'Charlie Expired').getByTestId('status-tag')).toHaveText('Link ran out');
  await expect(row(page, 'Salsa Norte').getByTestId('status-tag')).toHaveText('Unclaimed');
  await expect(row(page, 'Bravo Invited').getByTestId('status-tag')).toHaveText('Invited');
  await expect(row(page, 'Delta Managed').getByTestId('status-tag')).toHaveText('Managed');
  await noSideScroll(page);
  await shot(page, '01-list');

  // 5a -> 5b: one Invite button, three choices.
  await openRow(page, 'Salsa Norte');
  await expect(page.getByTestId('status-detail')).toHaveText('No link sent yet.');
  await expect(page.getByTestId('row-primary')).toHaveText('Invite');
  await shot(page, '02-unclaimed-5a');
  await page.getByTestId('row-primary').click();
  await expect(page.getByTestId('invite-who')).toContainText('They already have an account');
  await shot(page, '03-choices-5b');

  // The link form: a returned refusal under its field, then a bound link shown once (5c).
  await page.getByTestId('choice-link').click();
  await page.getByTestId('link-email').fill('ana@example.com');
  await expect(page.getByTestId('link-email-help')).toHaveText('Check the spelling: this address can then sign up.');
  await page.getByTestId('link-first-name').fill('XXX');
  await page.getByTestId('link-submit').click();
  await expect(page.getByTestId('link-error-first_name')).toBeVisible();
  await noSideScroll(page);
  await shot(page, '04-link-form-refusal');
  await page.getByTestId('link-first-name').fill('Ana');
  await page.getByTestId('link-submit').click();
  await expect(page.getByTestId('link-field')).toHaveValue(new RegExp(`/invite/${TOKEN}$`));
  await expect(page.getByTestId('link-once-note')).toContainText('Only ana@example.com can use it.');
  await shot(page, '05-link-once-5c');
  await page.getByTestId('link-done').click();

  // 5d invited, 5e expired, 5f managed, revoked, draft.
  await page.getByTestId('admin-search').fill('');
  await openRow(page, 'Bravo Invited');
  await expect(page.getByTestId('row-primary')).toHaveText('Copy new link');
  await expect(page.getByTestId('withdraw-invite')).toBeEnabled();
  await shot(page, '06-invited-5d');
  await page.getByTestId('row-primary').click();
  await expect(page.getByTestId('link-replaces-note')).toBeVisible();
  await page.getByTestId('link-cancel').click();
  await openRow(page, 'Charlie Expired');
  await expect(page.getByTestId('row-primary')).toHaveText('Send a new link');
  await shot(page, '07-expired-5e');
  await openRow(page, 'Delta Managed');
  await expect(page.getByTestId('row-primary')).toHaveText('Add another person');
  await expect(page.getByTestId('status-detail')).toContainText('Has an owner. Joined');
  await shot(page, '08-managed-5f');
  await openRow(page, 'Bachata Revoked');
  await expect(page.getByTestId('status-detail')).toHaveText('The last link was withdrawn.');
  await openRow(page, 'Echo Draft');
  await expect(page.getByTestId('status-detail')).toContainText('not live (draft)');

  // Request lists: a link request opens that organiser's link form; an access refusal reads in words.
  await page.getByTestId('link-requests-toggle').click();
  await page.getByTestId('access-requests-toggle').click();
  await expect(page.getByTestId('link-request-row')).toContainText('luis@example.com');
  await expect(page.getByTestId('access-request-note')).toHaveText('I run Sunday socials in Leeds.');
  await noSideScroll(page);
  await shot(page, '09-request-lists');
  await page.getByTestId('access-approve').click();
  await expect(page.getByTestId('access-requests-refused')).toHaveText('Someone already handled this one. The list is up to date now.');
  await page.getByTestId('link-request-send').click();
  await expect(page.getByTestId('link-form')).toBeVisible();
  await expect(page.getByTestId('admin-search')).toHaveValue('Charlie Expired');
  await shot(page, '10-request-to-link-form');

  expect(errors).toEqual([]);
  expect(calls.some((c) => c.fn === 'admin_issue_organiser_invite_v1' && c.body.p_email === 'ana@example.com' && c.body.p_first_name === 'Ana')).toBe(true);
});
