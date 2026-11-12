import { test, expect, type Page } from '@playwright/test';
import { NOW, PHONE, OrganiserFake, expectNoHorizontalScroll, json, refuse } from '../helpers/organiserFake';

// Dancer dashboard slice 1 (admin #1534): Option A Home at 390x844 against the organiser fake (session + REST) with the dancer RPCs
// answered at the network layer. Screenshots of four shapes go to docs/handover/dancer-rebuild-w2b/.

const SHOTS = 'docs/handover/dancer-dash-1576';
const rpc = (name: string) => `**/rest/v1/rpc/${name}`;
const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (offset: number) => {
  // Relative to the fake's frozen browser clock (NOW), not the machine's: past/upcoming must agree with the page.
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() + offset);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

const PROFILE = {
  profile_id: 'b1000000-0000-4000-8000-000000000001', user_id: 'a1000000-0000-4000-8000-000000000001',
  display_name: null, first_name: 'Ana', surname: null, hide_surname_publicly: false,
  based_city_id: 'c1000000-0000-4000-8000-000000000001', city_name: 'London', dance_role: 'Follower',
  nationality: null, languages: [], bio: null, instagram: null, facebook: null, website_url: null, whatsapp: null,
  show_whatsapp_publicly: true, avatar_url: null, dance_started_year: null, favorite_styles: [], favorite_songs: [],
  achievements: [], other_roles: [], is_active: true, erase_requested_at: null, linked_from_admin: false, complete: false,
  strength: { pct: 55, next_step: 'photo', missing: ['photo', 'started_year', 'styles', 'bio_social'] },
};
/** One get_my_going_v1 night (Going P2): series (public event) `id`, `offset` days out, 9 PM London, no zone. */
const night = (id: string, name: string, offset: number) => ({
  occurrence_id: `occ-${id}-${offset}`, public_event_id: id, event_title: name, occurrence_date: dayKey(offset),
  starts_at_local: `${dayKey(offset)}T21:00:00`, venue_id: 'v1', venue_name: 'Camden', event_lifecycle: 'live', night_lifecycle: 'scheduled', is_cancelled: false,
});
type GoingNight = ReturnType<typeof night>;
/** The RPC's split: upcoming soonest first, past (ended) most recent first. */
const mine = (rows: GoingNight[]) => ({
  upcoming: rows.filter((r) => r.occurrence_date >= dayKey(0)).sort((a, b) => a.occurrence_date.localeCompare(b.occurrence_date)),
  past: rows.filter((r) => r.occurrence_date < dayKey(0)).sort((a, b) => b.occurrence_date.localeCompare(a.occurrence_date)),
});

// B1b: Home also reads my_dancer_stats_v1 / my_profile_views_v1 (the views tile, the strip) and
// my_feature_interest_v1 (the partner tile). Going P2: the "Upcoming nights" number and the strip's
// Going cell are the count over get_my_going_v1's upcoming list, not the stats.
const stats = (went: number) => ({
  profile_id: PROFILE.profile_id, member_since: '2026-09-01T10:00:00Z', nights_going_upcoming: 0, nights_went: went,
  level_votes: 0, views_30_days: 0, views_total: 0,
});
const VIEWS = { profile_id: PROFILE.profile_id, total: 0, last_7_days: 0, last_30_days: 0, previous_30_days: 0, last_viewed_at: null };


const FULL = { ...PROFILE, avatar_url: 'https://img.example/a.jpg', complete: true, strength: { pct: 70, next_step: 'started_year', missing: ['started_year', 'styles', 'bio_social'] } };
const NEW = { ...PROFILE, first_name: null, based_city_id: null, city_name: null, dance_role: null, strength: { pct: 0, next_step: 'first_name', missing: ['first_name', 'city', 'role', 'photo', 'started_year', 'styles', 'bio_social'] } };
const UNFINISHED = { ...PROFILE, dance_role: null, strength: { pct: 40, next_step: 'role', missing: ['role', 'photo', 'started_year', 'styles', 'bio_social'] } };

type Shape = { name: string; profile: Record<string, unknown> | null; rows: GoingNight[]; went: number; organiser: boolean; claim?: boolean; claimStatus?: string; claimTitle?: string };
const SHAPES: Shape[] = [
  { name: 'new', profile: NEW, rows: [], went: 0, organiser: false },
  { name: 'unfinished', profile: UNFINISHED, rows: [], went: 0, organiser: false },
  { name: 'claimed', profile: { ...FULL, linked_from_admin: true }, rows: [night('s1', 'Soho Sensual Thursdays', 4)], went: 12, organiser: false },
  { name: 'complete-one-role', profile: FULL, rows: [night('s1', 'Soho Sensual Thursdays', 4)], went: 12, organiser: false },
  { name: 'complete-two-roles', profile: FULL, rows: [night('s1', 'Soho Sensual Thursdays', 4)], went: 12, organiser: true },
  { name: 'unclaimed', profile: null, rows: [], went: 0, organiser: false },
  { name: 'unclaimed-already-linked', profile: null, rows: [], went: 0, organiser: false, claimStatus: 'already_linked', claimTitle: 'Your page is already yours' },
  { name: 'unclaimed-ambiguous', profile: null, rows: [], went: 0, organiser: false, claimStatus: 'ambiguous', claimTitle: 'We found more than one page' },
];

async function open(page: Page, shape: Shape, path = '/app/home') {
  const fake = new OrganiserFake({ noOrganiser: !shape.organiser, dancerProfile: shape.profile ? 'complete' : 'none' });
  await fake.install(page);
  await page.route(rpc('dancer_area_gate_v1'), (r) => json(r, { open: false, allowed: true }));
  await page.route(rpc('my_dancer_edit_v1'), (r) => (shape.profile ? json(r, shape.profile) : refuse(r, 'no_profile')));
  await page.route(rpc('get_my_going_v1'), (r) => json(r, mine(shape.rows)));
  await page.route(rpc('get_calendar_events_v2'), (r) => json(r, []));
  await page.route(rpc('my_dancer_stats_v1'), (r) => json(r, stats(shape.went)));
  await page.route(rpc('my_profile_views_v1'), (r) => json(r, { profile_id: PROFILE.profile_id, total: 0, last_7_days: 0, last_30_days: 0, previous_30_days: 0, last_viewed_at: null }));
  await page.route(rpc('claim_my_dancer_profile_v1'), (r) => json(r, { ok: true, status: shape.claimStatus ?? 'no_match', profile_id: null }));
  await page.goto(path);
}

test.describe('dancer Home (Option A) 390x844', () => {
  test.use({ viewport: PHONE });

  for (const shape of SHAPES) {
    test(`home: ${shape.name}`, async ({ page }) => {
      await open(page, shape);
      if (!shape.profile) {
        await expect(page.getByTestId('home-claim-card')).toBeVisible();
        await expect(page.getByTestId('message-us')).toBeVisible();
        if (shape.name === 'unclaimed') await page.screenshot({ path: `${SHOTS}/home-unclaimed-initial.png`, fullPage: true });
        await page.getByTestId('claim-button').click();
        await expect(page.getByTestId('claim-title')).toHaveText(shape.claimTitle ?? 'No page found for this email');
        // Copy never points at a missing control.
        await expect(page.getByTestId(shape.claimStatus === 'already_linked' ? 'claim-reload' : 'claim-recheck')).toBeVisible();
      } else {
        await expect(page.getByTestId('home-list')).toBeVisible();
        for (const gone of ['home-hero', 'tile-strength', 'tile-going', 'stats-strip', 'tile-partner', 'lineup-people']) await expect(page.getByTestId(gone)).toHaveCount(0);
        const kind = shape.name === 'new' ? 'new' : shape.name === 'unfinished' ? 'unfinished' : 'complete';
        await expect(page.getByTestId(`home-a-${kind}`)).toBeVisible();
        if (kind === 'complete') await expect(page.getByTestId('home-attended-n')).toHaveText('12');
      }
      // Role strip: one profile reads Account, two read the Switch button.
      await expect(page.getByTestId(shape.organiser ? 'profile-switcher-button' : 'profile-account-button')).toBeVisible();
      await expectNoHorizontalScroll(page);
      await page.screenshot({ path: `${SHOTS}/home-${shape.name}.png`, fullPage: true });
    });
  }

  test('edit untouched: Save is off with its reason', async ({ page }) => {
    await open(page, SHAPES[2], '/app/me/edit');
    await expect(page.getByTestId('edit-save')).toBeDisabled();
    await expect(page.getByTestId('edit-save-reason')).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: `${SHOTS}/edit-untouched.png`, fullPage: true });
  });
});
