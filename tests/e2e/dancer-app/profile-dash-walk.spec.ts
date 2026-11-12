import { test, expect, type Page } from '@playwright/test';
import { PHONE, OrganiserFake, expectNoHorizontalScroll, json } from '../helpers/organiserFake';

// Admin 1534 dancer dashboard walk at 390x844: one profile, two/three profiles, the sheets, and an untouched Save. Shapes follow the prod survey in docs/design/profile-dash/dancer.md.
// Screenshots go to SHOTS only when WALK_SHOTS=1 (a plain CI run writes nothing into the repo).

const SHOTS = process.env.WALK_SHOTS ? 'docs/handover/profile-dash/walk' : 'test-results/profile-dash-walk';
const rpc = (name: string) => `**/rest/v1/rpc/${name}`;
const ID = 'b1000000-0000-4000-8000-000000000001';
const BASE = {
  profile_id: ID, user_id: 'a1000000-0000-4000-8000-000000000001', display_name: null, first_name: 'Ana', surname: null,
  hide_surname_publicly: false, based_city_id: 'c1000000-0000-4000-8000-000000000001', city_name: 'London', dance_role: 'Follower',
  nationality: null, languages: [], bio: null, instagram: null, facebook: null, website_url: null, whatsapp: null,
  show_whatsapp_publicly: true, avatar_url: 'https://img.example/a.jpg', dance_started_year: null, favorite_styles: [], favorite_songs: [],
  achievements: [], other_roles: [], is_active: true, erase_requested_at: null, linked_from_admin: false, complete: true,
  strength: { pct: 100, next_step: null, missing: [] },
};
const UNFINISHED = {
  ...BASE, avatar_url: null, complete: false,
  strength: { pct: 55, next_step: 'photo', missing: ['photo', 'started_year', 'styles', 'bio_social'] },
};

type Opts = { profile: Record<string, unknown> | 'none'; organisers?: 0 | 1 | 2; went?: number; claim?: string };

async function open(page: Page, path: string, o: Opts) {
  const fake = new OrganiserFake({ noOrganiser: !o.organisers });
  if (o.organisers === 2) fake.organisers.push({ ...fake.organisers[0], id: 'o2000000-0000-4000-8000-000000000002', name: 'Soho Nights', team: [], requests: [], series: [] });
  await fake.install(page);
  const saves: unknown[] = [];
  await page.route(rpc('dancer_area_gate_v1'), (r) => json(r, { open: false, allowed: true }));
  await page.route(rpc('my_dancer_edit_v1'), (r) =>
    o.profile === 'none' ? r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'no_profile', code: 'P0001' }) }) : json(r, o.profile));
  await page.route(rpc('save_my_dancer_profile_v1'), (r) => { saves.push(r.request().postDataJSON()); return json(r, o.profile); });
  await page.route(rpc('claim_my_dancer_profile_v1'), (r) => json(r, { ok: true, status: o.claim ?? 'no_match', profile_id: null }));
  await page.route(rpc('get_my_going_v1'), (r) => json(r, { upcoming: [], past: [] }));
  await page.route(rpc('get_calendar_events_v2'), (r) => json(r, []));
  await page.route(rpc('my_dancer_stats_v1'), (r) => json(r, { profile_id: ID, member_since: '2026-09-01T10:00:00Z', nights_going_upcoming: 0, nights_went: o.went ?? 0, level_votes: 0, views_30_days: 0, views_total: 0 }));
  await page.route(rpc('my_profile_views_v1'), (r) => json(r, { profile_id: ID, total: 0, last_7_days: 0, last_30_days: 0, previous_30_days: 0, last_viewed_at: null }));
  await page.route(rpc('my_feature_interest_v1'), (r) => json(r, { features: [] }));
  await page.goto(path);
  return { saves };
}

const snap = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });

/** Every visible button/link under the page is at least 44px tall (px, not rem). */
const smallTaps = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll('button, a[href]'))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || el.closest('[aria-hidden="true"]') || el.closest('.sr-only')) continue;
      if (r.height < 43.5 && !(el as HTMLElement).closest('p')) out.push(`${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)} ${Math.round(r.height)}`);
    }
    return out;
  });

test.describe('profile dash walk 390x844', () => {
  test.use({ viewport: PHONE });

  // Home shapes (stub / unfinished / complete / claim) are walked by profile-dash-home.spec.ts (#1576's Option A Home);
  // this spec keeps the strip, the sheets and the untouched Save.
  test('unfinished: untouched Save sends nothing and says why', async ({ page }) => {
    const { saves } = await open(page, '/app/me/edit', { profile: UNFINISHED, organisers: 0 });
    await expect(page.getByTestId('edit-save')).toBeDisabled();
    await expect(page.getByTestId('edit-save-reason')).toContainText('Nothing has changed yet');
    await expect(page.getByTestId('first_name')).toHaveCount(0);
    await expectNoHorizontalScroll(page);
    await snap(page, 'edit-untouched');
    await page.getByTestId('edit-save').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('edit-save-reason')).toBeInViewport();
    await snap(page, 'edit-untouched-save');
    expect(saves).toHaveLength(0);
  });

  test('one profile: button reads Account, no Switch; sheet has Add a profile and sign out', async ({ page }) => {
    await open(page, '/app/home', { profile: BASE, organisers: 0 });
    await expect(page.getByTestId('profile-switcher-label')).toHaveText('Account');
    await page.getByTestId('profile-account-button').click();
    await expect(page.getByTestId('profile-switcher-sheet').getByText('Your account')).toBeVisible();
    await expect(page.getByText('Switch profile')).toHaveCount(0);
    await snap(page, 'account-one-profile');
    await page.getByTestId('profile-switcher-add').click();
    await expect(page.getByTestId('profile-switcher-add-organiser')).toHaveText('Run events? Become an organiser');
    await snap(page, 'add-profile');
  });

  for (const [n, count] of [['two', 1], ['three', 2]] as const) {
    test(`${n} profiles besides dancer: Switch sheet lists them`, async ({ page }) => {
      await open(page, '/app/home', { profile: BASE, organisers: count as 1 | 2 });
      await expect(page.getByTestId('profile-switcher-label')).toHaveText('Switch');
      await page.getByTestId('profile-switcher-button').click();
      await expect(page.getByTestId('profile-switcher-sides').locator('li')).toHaveCount(count + 1);
      expect(await smallTaps(page)).toEqual([]);
      await snap(page, `switch-${n}-sides`);
    });
  }

  test('many profiles + sign-out confirm: the sheet scrolls and Close stays inside the viewport', async ({ page }) => {
    await open(page, '/app/home', { profile: BASE, organisers: 2 });
    await page.getByTestId('profile-switcher-button').click();
    await page.getByTestId('profile-switcher-sign-out').click();
    const close = page.getByTestId('profile-switcher-close');
    await expect(close).toBeInViewport();
    const box = await page.getByTestId('profile-switcher-sheet').boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
    await snap(page, 'switch-many-confirm');
  });
});
