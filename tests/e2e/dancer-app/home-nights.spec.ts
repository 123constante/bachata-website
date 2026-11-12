import { test, expect, type Page } from '@playwright/test';
import { GOING_CHECKIN_ENABLED } from '../../../src/lib/goingCheckin';
import { NOW, PHONE, OrganiserFake, expectNoHorizontalScroll, json } from '../helpers/organiserFake';

// W2b: Home and Nights at 390x844 against the organiser fake (session + REST) with the dancer RPCs
// answered at the network layer. Screenshots of four shapes go to docs/handover/dancer-rebuild-w2b/.

const SHOTS = 'docs/handover/dancer-rebuild-w2b';
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

type Shape = { name: string; profile: Record<string, unknown>; rows: GoingNight[]; stats: ReturnType<typeof stats> };
const SHAPES: Shape[] = [
  { name: 'empty', profile: PROFILE, rows: [], stats: stats(0) },
  // A real 70% shape has a photo (review B1: the old row was 70% with avatar_url null, which the server never returns).
  { name: 'upcoming-going', profile: { ...PROFILE, avatar_url: 'https://img.example/a.jpg', complete: true, strength: { pct: 70, next_step: 'started_year', missing: ['started_year', 'styles', 'bio_social'] } }, rows: [night('s1', 'Soho Sensual Thursdays', 4), night('s2', 'Camden Social', 9)], stats: stats(0) },
  { name: 'past-unrated-nudge', profile: PROFILE, rows: [night('s3', 'Last Night Party', -1), night('s1', 'Soho Sensual Thursdays', 6)], stats: stats(1) },
  { name: 'paused-linked', profile: { ...PROFILE, is_active: false, linked_from_admin: true }, rows: [night('s1', 'Soho Sensual Thursdays', 4)], stats: stats(0) },
];

async function open(page: Page, path: string, shape: Shape) {
  const votes: Record<string, string> = {};
  const fake = new OrganiserFake({ noOrganiser: true });
  await fake.install(page);
  await page.route(rpc('dancer_area_gate_v1'), (r) => json(r, { open: false, allowed: true }));
  await page.route(rpc('my_dancer_edit_v1'), (r) => json(r, shape.profile));
  await page.route(rpc('get_my_going_v1'), (r) => json(r, mine(shape.rows)));
  await page.route(rpc('get_calendar_events_v2'), (r) => json(r, []));
  await page.route(rpc('my_dancer_stats_v1'), (r) => json(r, shape.stats));
  await page.route(rpc('my_profile_views_v1'), (r) => json(r, VIEWS));
  await page.route(rpc('my_feature_interest_v1'), (r) => json(r, { features: [] }));
  await page.route(rpc('series_level_summary_p5_v1'), (r) => {
    const id = JSON.parse(r.request().postData() ?? '{}').p_series_id as string;
    return json(r, { series_id: id, vote_count: 1, threshold: 7, counts: null, derived_level: null, my_level: votes[id] ?? null });
  });
  await page.route(rpc('rate_series_level_p5_v1'), (r) => {
    const b = JSON.parse(r.request().postData() ?? '{}');
    votes[b.p_series_id] = b.p_level;
    return json(r, null);
  });
  await page.goto(path);
}

test.describe('dancer app home + nights 390x844', () => {
  test.use({ viewport: PHONE });

  for (const shape of SHAPES) {
    test(`home and nights: ${shape.name}`, async ({ page }) => {
      await open(page, '/app/home', shape);
      // Calm Home (continuation 3): ONE main card. The hero, views tile, numbers strip, partner tile
      // and going tile are gone; assert the card is there and the old tiles stay away.
      await expect(page.getByTestId('home-main')).toBeVisible();
      for (const gone of ['home-hero', 'tile-views', 'stats-strip', 'tile-partner', 'tile-going']) {
        await expect(page.getByTestId(gone)).toHaveCount(0);
      }
      await expect(page.getByText(/^Coming soon\.?$/)).toHaveCount(0);
      await expectNoHorizontalScroll(page);
      await page.screenshot({ path: `${SHOTS}/home-${shape.name}.png`, fullPage: true });
      await page.getByTestId('dancer-app-tab-nights').click();
      // Slice B: no nights at all shows ONE empty state (what you can do), not empty sections.
      // Going P2: with the going switch off no going read runs, so Nights is always that empty state.
      await expect(page.getByTestId(shape.rows.length === 0 || !GOING_CHECKIN_ENABLED ? 'nights-empty' : 'nights-upcoming')).toBeVisible();
      await expectNoHorizontalScroll(page);
      await page.screenshot({ path: `${SHOTS}/nights-${shape.name}.png`, fullPage: true });
    });
  }

  test('the nudge leads to Nights, the vote sticks, the nudge clears', async ({ page }) => {
    // The nudge is built from the going list (get_my_going_v1), which only runs while the going switch is on.
    test.skip(!GOING_CHECKIN_ENABLED, 'the going switch is off: no going read, so no past night to nudge');
    await open(page, '/app/home', SHAPES[2]);
    await page.getByTestId('rate-nudge').click();
    await expect(page).toHaveURL(/\/app\/nights\?focus=s3$/);
    await page.getByRole('radio', { name: 'Mixed' }).click();
    await expect(page.getByText('You said: Mixed')).toBeVisible();
    await page.getByTestId('dancer-app-tab-home').click();
    await expect(page.getByTestId('home-hero')).toBeVisible();
    await expect(page.getByTestId('rate-nudge')).toHaveCount(0);
  });
});
