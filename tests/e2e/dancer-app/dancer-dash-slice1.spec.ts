import { test, expect, type Page } from '@playwright/test';
import { NOW, PHONE, OrganiserFake, expectNoHorizontalScroll, json, refuse } from '../helpers/organiserFake';

// Dancer dashboard slice 1 (admin #1534): Option B Home (run with VITE_ENABLE_DANCER_DASH_B=true) at 390x844 against the organiser fake (session + REST) with the dancer RPCs
// answered at the network layer. Screenshots of four shapes go to docs/handover/dancer-rebuild-w2b/.

const SHOTS = 'docs/handover/dancer-dash-slice1';
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

type Shape = { fail?: boolean; name: string; profile: Record<string, unknown> | null; rows: GoingNight[]; went: number; organiser: boolean; claim?: boolean; claimStatus?: string; claimTitle?: string };
const SHAPES: Shape[] = [
  { name: 'new', profile: NEW, rows: [], went: 0, organiser: false },
  { name: 'partial', profile: UNFINISHED, rows: [], went: 0, organiser: false },
  { name: 'complete-night', profile: FULL, rows: [night('s1', 'Soho Sensual Thursdays', 4), night('s2', 'Camden Social', 9)], went: 12, organiser: false },
  { name: 'complete-empty', profile: FULL, rows: [], went: 0, organiser: false },
  { name: 'unclaimed', profile: null, rows: [], went: 0, organiser: false },
  { name: 'error', profile: null, rows: [], went: 0, organiser: false, fail: true },
];

async function open(page: Page, shape: Shape, path = '/app/home') {
  const fake = new OrganiserFake({ noOrganiser: !shape.organiser, dancerProfile: shape.profile ? 'complete' : 'none' });
  await fake.install(page);
  await page.route(rpc('dancer_area_gate_v1'), (r) => json(r, { open: false, allowed: true }));
  await page.route(rpc('my_dancer_edit_v1'), (r) => (shape.fail ? r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' }) : shape.profile ? json(r, shape.profile) : refuse(r, 'no_profile')));
  await page.route(rpc('get_my_going_v1'), (r) => json(r, mine(shape.rows)));
  await page.route(rpc('get_calendar_events_v2'), (r) => json(r, []));
  await page.route(rpc('my_dancer_stats_v1'), (r) => json(r, stats(shape.went)));
  await page.route(rpc('my_profile_views_v1'), (r) => json(r, { profile_id: PROFILE.profile_id, total: 0, last_7_days: 0, last_30_days: 0, previous_30_days: 0, last_viewed_at: null }));
  await page.route(rpc('claim_my_dancer_profile_v1'), (r) => json(r, { ok: true, status: shape.claimStatus ?? 'no_match', profile_id: null }));
  await page.goto(path);
}


test.describe('dancer Home (Option B) 390x844', () => {
  test.use({ viewport: PHONE });
  // The flag is a build-time switch (default off): this walk only means something with it on.
  test.skip(process.env.VITE_ENABLE_DANCER_DASH_B !== 'true', 'Option B is behind VITE_ENABLE_DANCER_DASH_B; run with it set to true');
  for (const shape of SHAPES) {
    test(`home-b: ${shape.name}`, async ({ page }) => {
      await open(page, shape);
      if (shape.fail) {
        await expect(page.getByTestId('home-b-error')).toBeVisible();
        await expect(page.getByTestId('home-b-retry')).toBeVisible();
        await expect(page.getByTestId('message-us')).toBeVisible();
      } else if (!shape.profile) {
        await expect(page.getByTestId('home-claim-card')).toBeVisible();
      } else {
        await expect(page.getByTestId('home-b-focus')).toBeVisible();
        await expect(page.getByTestId('home-b-cta')).toBeVisible();
      }
      await expectNoHorizontalScroll(page);
      const small = await page.evaluate(() => Array.from(document.querySelectorAll('main a, main button')).filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 43.5 && !(el as HTMLElement).closest('[aria-hidden="true"]'); }).map((el) => (el.textContent || '').trim().slice(0, 30)));
      expect(small).toEqual([]);
      await page.screenshot({ path: `${SHOTS}/home-b-${shape.name}.png`, fullPage: true });
    });
  }
});
