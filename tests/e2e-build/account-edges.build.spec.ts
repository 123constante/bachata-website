import { test, expect, type Page } from '@playwright/test';
import { ORG, ORG_NAME, OrganiserFake, expectNoHorizontalScroll, json } from '../e2e/helpers/organiserFake';
import { DANCER_LINK, type Journey, type Person } from '../journeys/publicEntryJourneys';
import { CITY_LONDON, makeProfile } from '../../src/modules/dancer-app/api/fixtures';
import { Backend, EMAIL, codeStep, isWelcome, nextStage, onboarding, signinForm, signupForm, wire, type Shot } from './helpers/journeyHarness';

// Account edges the journey rows do not reach (MATRIX.md "Proposed follow-up", build-walk
// specs): sign-out on a shared phone and in a second tab, two organisers in the switch
// sheet, an admin-only account in the dancer app, two tabs half way through onboarding,
// and a team invite opened by a different signed-in person. PRODUCTION build at 390x844
// (playwright.build.config.ts); the backend is the same in-browser fake the journey walk
// uses (helpers/journeyHarness.ts) plus OrganiserFake.

const INVITE = '/invite/0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0';
const noShot: Shot = async () => {};
const rowFor = (person: Person, auth?: 'signup' | 'signin'): Journey => ({
  id: 'account-edge', title: 'account edge', entry: '/', person, auth, end: { path: '/', screen: '', state: '' },
});
/** Sign out from the switch sheet. Where it lands is not the point here (the sheet asks for '/', the dancer app's AuthGuard may win with /auth). */
async function signOutFromSheet(page: Page) {
  await page.getByTestId('profile-switcher-button').click();
  await page.getByTestId('profile-switcher-sign-out').click();
  // Slice B: the sheet asks first (its own confirm step), then signs out.
  await page.getByTestId('profile-switcher-signout-confirm').click();
  await expect(page).not.toHaveURL(/\/app\//);
}

test('sign out then a different person signs up: no trace of A', async ({ page }) => {
  test.setTimeout(180_000);
  const a = { firstName: 'Aurelia', email: 'aurelia.a@example.com' };
  const b = { firstName: 'Bea', email: 'bea.b@example.com' };
  const backend = new Backend(rowFor({ signedIn: false, dancer: 'incomplete', organisers: 0, userType: 'dancer' }, 'signup'));
  backend.email = a.email;
  await wire(page, backend);
  // A signs up from the dancer link, finishes onboarding, then signs out from the switch sheet.
  await page.goto(DANCER_LINK);
  await signupForm(page, DANCER_LINK, noShot, a);
  await codeStep(page, noShot, backend, false);
  await page.waitForURL(isWelcome, { timeout: 30_000 });
  await onboarding(page, noShot, 'Go to Home', 'in');
  await expect(page.getByTestId('dancer-screen-home')).toBeVisible();
  await signOutFromSheet(page);
  // M76 (owner decision): sign-out clears every person-scoped key; nothing of A is left on the phone.
  const left = await page.evaluate(
    (needles) => [...Object.entries(localStorage), ...Object.entries(sessionStorage)].filter(([, v]) => needles.some((n) => v.includes(n))).map(([k]) => k),
    [a.email, a.firstName],
  );
  expect(left, 'storage keys still holding A after sign-out').toEqual([]);
  // B, a different person, opens the same link on the same phone: an empty form.
  backend.becomeNew(b.email);
  await page.goto(DANCER_LINK);
  await expect(page.getByText('A little about you')).toBeVisible();
  await expect(page.locator('#signup-firstname')).toHaveValue('');
  await signupForm(page, DANCER_LINK, noShot, b);
  await codeStep(page, noShot, backend, false);
  await page.waitForURL(isWelcome, { timeout: 30_000 });
  await onboarding(page, noShot, 'Go to Home', 'in');
  await expect(page).toHaveURL(/\/app\/home$/);
  await expect(page.getByTestId('dancer-screen-home')).toBeVisible();
  await expect(page.getByText(a.firstName)).toHaveCount(0);
  await expectNoHorizontalScroll(page);
});

test("sign out in tab 1 sends tab 2's guarded page to /auth", async ({ context }) => {
  const backend = new Backend(rowFor({ signedIn: true, dancer: 'complete', organisers: 0, userType: 'dancer' }));
  const tab1 = await context.newPage();
  await wire(tab1, backend);
  await tab1.goto('/app/home');
  const tab2 = await context.newPage();
  await wire(tab2, backend);
  await tab2.goto('/app/home');
  await expect(tab1.getByTestId('dancer-screen-home')).toBeVisible();
  await expect(tab2.getByTestId('dancer-screen-home')).toBeVisible();
  await signOutFromSheet(tab1);
  await expect(tab2).toHaveURL(
    (u) => u.pathname === '/auth' && u.searchParams.get('mode') === 'signin' && u.searchParams.get('returnTo') === '/app/home',
    { timeout: 20_000 },
  );
});

test('two organisers: the switch sheet ticks the ?o= organiser and switches between them', async ({ page }) => {
  const fake = new OrganiserFake();
  const other = 'o2000000-0000-4000-8000-000000000002';
  fake.organisers.push({ ...fake.organisers[0], id: other, name: 'Sensual Sundays', series: [] });
  await fake.install(page);
  await page.route('**/rest/v1/rpc/dancer_area_gate_v1', (r) => json(r, { open: true, allowed: true }));
  await page.route('**/rest/v1/rpc/my_dancer_edit_v1', (r) =>
    json(r, makeProfile({ first_name: 'Ana', based_city_id: CITY_LONDON.id, dance_role: 'Follower', avatar_url: null })),
  );
  const side = (id: string) => page.getByTestId(`profile-switcher-side-organiser:${id}`);
  await page.goto(`/account/o?o=${other}`);
  await expect(page.getByTestId('org-page-home')).toBeVisible();
  await page.getByTestId('profile-switcher-button').click();
  await expect(side(other)).toHaveAttribute('aria-current', 'true');
  await expect(side(ORG)).not.toHaveAttribute('aria-current', 'true');
  await side(ORG).click();
  await expect(page).toHaveURL((u) => u.pathname === '/account/o' && u.searchParams.get('o') === ORG);
  await page.getByTestId('profile-switcher-button').click();
  await expect(side(ORG)).toHaveAttribute('aria-current', 'true');
  await expect(side(other)).not.toHaveAttribute('aria-current', 'true');
  await expectNoHorizontalScroll(page);
});

test('admin-only opens /app/home: /account, then the Finish screen', async ({ page }) => {
  // Pins today's behaviour (MATRIX M45/M81): no dancer row, the dancer area closed to them.
  await new OrganiserFake({ noOrganiser: true, dancerProfile: 'none' }).install(page);
  await page.route('**/rest/v1/rpc/dancer_area_gate_v1', (r) => json(r, { open: true, allowed: false }));
  const trail: string[] = [];
  page.on('framenavigated', (f) => {
    if (f === page.mainFrame()) trail.push(new URL(f.url()).pathname);
  });
  await page.goto('/app/home');
  await expect(page).toHaveURL((u) => u.pathname === '/finish-profile' && u.searchParams.get('returnTo') === '/account', { timeout: 20_000 });
  // Slice B: with no dancer profile at all, the screen says what it does: set one up.
  await expect(page.getByRole('heading', { name: 'Set up your dancer profile' })).toBeVisible();
  expect(trail, 'the dancer area sent them to /account first').toContain('/account');
  await expectNoHorizontalScroll(page);
});

test('two tabs mid-onboarding: tab 2 save after tab 1 finished ends /app/home, no error', async ({ context }) => {
  test.setTimeout(120_000);
  // An older account with a name and a city: role and photo left (MATRIX M80).
  const backend = new Backend(rowFor({ signedIn: true, dancer: 'incomplete', organisers: 0, userType: 'dancer' }));
  const tab1 = await context.newPage();
  await wire(tab1, backend);
  await tab1.goto('/app/welcome');
  const tab2 = await context.newPage();
  await wire(tab2, backend);
  await tab2.goto('/app/welcome');
  expect(await nextStage(tab1, null)).toBe('role');
  expect(await nextStage(tab2, null)).toBe('role');
  await onboarding(tab1, noShot, 'Go to Home', 'in');
  await expect(tab1).toHaveURL(/\/app\/home$/);
  // Tab 2 still shows the role card: the person answers it there too.
  await tab2.locator('section[data-testid="onboarding-role"]').getByRole('radio', { name: 'Follower', exact: true }).click();
  await tab2.getByTestId('onboarding-continue').click();
  expect(await nextStage(tab2, 'role'), 'the card after the stale save').toBe('in');
  await expect(tab2.getByRole('alert')).toHaveCount(0);
  await tab2.getByTestId('onboarding-home').click();
  await expect(tab2).toHaveURL(/\/app\/home$/);
  await expect(tab2.getByTestId('dancer-screen-home')).toBeVisible();
});

test('a different signed-in person opens an invite: the card names who is joining (M57)', async ({ page }) => {
  // The token is bearer-style (owner decision M57): before anything is used, the card says who joins and offers a way out.
  await wire(page, new Backend(rowFor({ signedIn: true, dancer: 'complete', organisers: 0, userType: 'dancer' })));
  await page.goto(INVITE);
  const card = page.getByTestId('invite-card');
  await expect(card).toContainText(new RegExp(`You are joining as (Ana|${EMAIL.replace(/\./g, '\\.')})`));
  await expect(card).toContainText('Not you?');
  await expect(card.getByRole('button', { name: 'Sign out' }).or(card.getByRole('link', { name: 'Sign out' }))).toBeVisible();
});

test('sign out, then an organiser (B) signs in on the same phone: B sees B\'s sides and nothing of A (M77)', async ({ page }) => {
  test.setTimeout(180_000);
  // A: a finished dancer with no organiser side (so A's organiser read is cached as "none"). B: a different
  // account, a finished dancer who also runs an organiser page. The page is never reloaded between them,
  // so only the uid-keyed query caches keep A's answers out of B's chooser.
  const backend = new Backend(rowFor({ signedIn: true, dancer: 'complete', organisers: 0, userType: 'dancer' }));
  const fake = await wire(page, backend);
  await page.goto('/app/home');
  await expect(page.getByTestId('dancer-screen-home')).toBeVisible();
  await signOutFromSheet(page);
  // B arrives: the server now has an organiser page for B's user id.
  const bOrg = new OrganiserFake();
  fake.organisers.push(...bOrg.organisers);
  for (const [id, series] of bOrg.series) fake.series.set(id, series);
  for (const d of bOrg.emptyLineup) fake.emptyLineup.add(d);
  const bEmail = 'bea.org@example.com';
  backend.becomeReturning(bEmail, '77777777-7777-4777-8777-777777777777');
  // Stay in the same page session, no page.goto. Audit H10 (Slice B): sign-out lands on the site home,
  // never the sign-in form, so B signs in from the header's Sign in link.
  await expect(page).not.toHaveURL(/\/auth/);
  await page.getByTestId('header-sign-in-link').click();
  await signinForm(page, noShot, bEmail);
  await codeStep(page, noShot, backend, false);
  // Back on the page B signed in from; B opens the account from the header (B runs events: the organiser
  // area, which carries the same switch sheet), still without a reload. B's sides are read from that sheet.
  await expect(page).not.toHaveURL(/\/auth/, { timeout: 30_000 });
  await page.getByTestId('header-account-link').click();
  // B runs an organiser page, so /account is the organiser home (A's cached "no organiser" must not leak).
  await expect(page).toHaveURL((u) => u.pathname.startsWith('/account/o'), { timeout: 30_000 });
  await page.getByTestId('profile-switcher-button').click();
  await expect(page.locator('[data-testid^="profile-switcher-side-organiser:"]')).toHaveCount(1);
  await expect(page.getByTestId(`profile-switcher-side-organiser:${ORG}`)).toContainText(ORG_NAME);
  await expect(page.getByText(EMAIL)).toHaveCount(0);
  await expectNoHorizontalScroll(page);
});

test('no side, not an admin: /account/continue lands on /app/welcome, never the site home (M44)', async ({ page }) => {
  // An account with no dancer row and no organiser page (0 in prod today; the fake can express it with dancer: 'none').
  // The landing is reached by opening /account/continue signed in. A fresh sign-in does NOT reach it for this person:
  // AuthCallback finds no persona row and uses its own fallback (a city page). Recorded in FOLLOWUP-HANDOVER.md.
  await wire(page, new Backend(rowFor({ signedIn: true, dancer: 'none', organisers: 0, userType: 'dancer' })));
  await page.route('**/rest/v1/rpc/admin_is_admin', (r) => json(r, false));
  await page.goto('/account/continue');
  await page.waitForURL(isWelcome, { timeout: 30_000 });
  await expectNoHorizontalScroll(page);
});
