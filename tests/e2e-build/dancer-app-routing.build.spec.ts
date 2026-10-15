import { test, expect, type Page } from '@playwright/test';
import { OrganiserFake, expectNoHorizontalScroll, json } from '../e2e/helpers/organiserFake';

// The sign-in routing walk (brief dancer-app-routing) at 390x844 against the
// PRODUCTION build (playwright.build.config.ts). The backend is mocked at the
// network layer in the shapes prod has (read-only survey 2026-10-15: 12
// dancer-only, 3 dancer + one organiser, 2 admin-only accounts; none with two
// organisers -- that case is walked too, as the brief asks). The sign-in
// landing is /account/continue: AuthCallback's hop there is unit-tested
// (tests/regression/today/authCallback.today.test.tsx).
const SHOTS = 'docs/review-packs/dancer-app-routing';

const PROFILE = {
  profile_id: 'b1000000-0000-4000-8000-000000000001',
  user_id: 'a1000000-0000-4000-8000-000000000001',
  display_name: 'Ana', first_name: 'Ana', surname: null, hide_surname_publicly: false,
  based_city_id: 'c1000000-0000-4000-8000-000000000001', city_name: 'London', dance_role: 'Follower',
  nationality: null, languages: [], bio: null, instagram: null, facebook: null, website_url: null,
  whatsapp: null, show_whatsapp_publicly: true, avatar_url: null,
  dance_started_year: null, favorite_styles: [], favorite_songs: [], achievements: [],
  other_roles: [] as string[], is_active: true, erase_requested_at: null, linked_from_admin: false,
  complete: true, strength: { pct: 70, next_step: 'started_year', missing: ['started_year', 'styles', 'bio_social'] },
};

type Shape = 'dancer-only' | 'org+dancer' | 'two-orgs+dancer' | 'admin-only';

async function open(page: Page, shape: Shape, path: string) {
  const fake = new OrganiserFake({
    noOrganiser: shape === 'dancer-only' || shape === 'admin-only',
    dancerProfile: shape === 'admin-only' ? 'none' : 'complete',
  });
  if (shape === 'two-orgs+dancer') {
    fake.organisers.push({ ...fake.organisers[0], id: 'o2000000-0000-4000-8000-000000000002', name: 'Sensual Sundays', series: [] });
  }
  await fake.install(page);
  const allowed = shape !== 'admin-only';
  await page.route('**/rest/v1/rpc/dancer_area_gate_v1', (r) => json(r, { open: true, allowed }));
  await page.route('**/rest/v1/rpc/my_dancer_edit_v1', (r) =>
    json(r, { ...PROFILE, other_roles: shape === 'dancer-only' ? [] : ['organising'] }),
  );
  await page.goto(path);
}

/** Every visible control in `scope` is at least 44px tall. */
async function expectTapTargets(page: Page, scope: string) {
  const small = await page.locator(`${scope} a:visible, ${scope} button:visible`).evaluateAll((els) =>
    els.map((e) => ({ t: (e.textContent ?? '').trim().slice(0, 30), h: e.getBoundingClientRect().height })).filter((x) => x.h < 44),
  );
  expect(small).toEqual([]);
}

test('dancer-only: sign-in lands straight in the dancer app (no chooser)', async ({ page }) => {
  await open(page, 'dancer-only', '/account/continue');
  await expect(page).toHaveURL(/\/app\/home$/);
  await expect(page.getByTestId('dancer-app-shell')).toBeVisible();
  await expect(page.getByTestId('profile-switcher-button')).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${SHOTS}/01-signin-landing-dancer-only.png` });
});

test('admin-only: sign-in lands on the site home, as before', async ({ page }) => {
  await open(page, 'admin-only', '/account/continue');
  // The site home ('/') opens on the default city's events feed.
  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/(city\/[a-z-]+)?$/);
});

for (const [shape, names, file] of [
  ['org+dancer', 2, '02-continue-as-1-org.png'],
  ['two-orgs+dancer', 3, '03-continue-as-2-orgs.png'],
] as const) {
  test(`${shape}: "Continue as..." lists organisers first, then the dancer`, async ({ page }) => {
    await open(page, shape, '/account/continue');
    await expect(page.getByTestId('continue-as')).toBeVisible();
    const buttons = page.getByTestId('continue-as').getByRole('link');
    await expect(buttons).toHaveCount(names);
    await expect(buttons.last()).toContainText('Dancer');
    await expect(buttons.first()).toContainText('Organiser');
    await expectNoHorizontalScroll(page);
    await expectTapTargets(page, '[data-testid="continue-as"]');
    await page.screenshot({ path: `${SHOTS}/${file}` });
    await page.getByTestId('continue-as-dancer').click();
    await expect(page).toHaveURL(/\/app\/home$/);
  });
}

test('switch sheet in the dancer app: every side, a tick on Dancer, settings, sign out', async ({ page }) => {
  await open(page, 'org+dancer', '/app/home');
  await page.getByTestId('profile-switcher-button').click();
  const sheet = page.getByTestId('profile-switcher-sheet');
  await expect(sheet).toBeVisible();
  await expect(page.getByTestId('profile-switcher-side-dancer')).toHaveAttribute('aria-current', 'true');
  await expect(page.getByTestId('profile-switcher-settings')).toBeVisible();
  await expect(page.getByTestId('profile-switcher-sign-out')).toBeVisible();
  // Not under the dancer app's bottom tabs: the topmost element at its centre is the button itself.
  const signOut = page.getByTestId('profile-switcher-sign-out');
  expect(await signOut.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
  })).toBe(true);
  await expectNoHorizontalScroll(page);
  await expectTapTargets(page, '[data-testid="profile-switcher-sheet"]');
  await page.screenshot({ path: `${SHOTS}/04-switch-sheet-in-app.png` });
  await page.locator('[data-testid^="profile-switcher-side-organiser"]').first().click();
  await expect(page).toHaveURL(/\/account\/o$/);
});

test('switch sheet in the organiser area: same sheet, a tick on the organiser', async ({ page }) => {
  await open(page, 'org+dancer', '/account/o');
  await expect(page.getByTestId('org-page-home')).toBeVisible();
  await page.getByTestId('profile-switcher-button').click();
  await expect(page.getByTestId('profile-switcher-sheet')).toBeVisible();
  await expect(page.locator('[data-testid^="profile-switcher-side-organiser"]').first()).toHaveAttribute('aria-current', 'true');
  await expectNoHorizontalScroll(page);
  await expectTapTargets(page, '[data-testid="profile-switcher-sheet"]');
  await page.screenshot({ path: `${SHOTS}/05-switch-sheet-in-organiser-area.png` });
  await page.getByTestId('profile-switcher-side-dancer').click();
  await expect(page).toHaveURL(/\/app\/home$/);
});

test('/app/options: the quiet "Become an organiser" row and Account settings', async ({ page }) => {
  await open(page, 'dancer-only', '/app/options');
  await expect(page.getByTestId('opt-switch-organiser')).toContainText('Run events? Become an organiser');
  await expect(page.getByRole('link', { name: 'Account settings' })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${SHOTS}/06-options-become-organiser.png` });
});

test('the old /account/dancer URL opens the dancer app (organiser + dancer: the owner report)', async ({ page }) => {
  await open(page, 'org+dancer', '/account/dancer');
  await expect(page).toHaveURL(/\/app\/home$/);
  await expect(page.getByTestId('dancer-app-shell')).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${SHOTS}/07-old-account-dancer-redirect.png` });
});
