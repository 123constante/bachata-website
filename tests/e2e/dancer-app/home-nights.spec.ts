import { test, expect, type Page } from '@playwright/test';
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
const night = (id: string, name: string, offset: number, status = 'going') => ({
  event_id: id, status, updated_at: null, name, occurrence_date: dayKey(offset), city_name: 'Camden', start_time: '21:00:00', type: 'party', is_active: true,
});

type Shape = { name: string; profile: Record<string, unknown>; rows: unknown[] };
const SHAPES: Shape[] = [
  { name: 'empty', profile: PROFILE, rows: [] },
  // A real 70% shape has a photo (review B1: the old row was 70% with avatar_url null, which the server never returns).
  { name: 'upcoming-going', profile: { ...PROFILE, avatar_url: 'https://img.example/a.jpg', complete: true, strength: { pct: 70, next_step: 'started_year', missing: ['started_year', 'styles', 'bio_social'] } }, rows: [night('s1', 'Soho Sensual Thursdays', 4), night('s2', 'Camden Social', 9, 'interested')] },
  { name: 'past-unrated-nudge', profile: PROFILE, rows: [night('s3', 'Last Night Party', -1), night('s1', 'Soho Sensual Thursdays', 6)] },
  { name: 'paused-linked', profile: { ...PROFILE, is_active: false, linked_from_admin: true }, rows: [night('s1', 'Soho Sensual Thursdays', 4)] },
];

async function open(page: Page, path: string, shape: Shape) {
  const votes: Record<string, string> = {};
  const fake = new OrganiserFake({ noOrganiser: true });
  await fake.install(page);
  await page.route(rpc('dancer_area_gate_v1'), (r) => json(r, { open: false, allowed: true }));
  await page.route(rpc('my_dancer_edit_v1'), (r) => json(r, shape.profile));
  await page.route(rpc('get_my_event_attendance_v2'), (r) => json(r, shape.rows));
  await page.route(rpc('get_calendar_events_v2'), (r) => json(r, []));
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
      await expect(page.getByTestId('home-hero')).toBeVisible();
      // Audit L12: no "Coming soon" tiles on Home.
      await expect(page.getByTestId('tile-views')).toHaveCount(0);
      await expect(page.getByText('Coming soon')).toHaveCount(0);
      await expectNoHorizontalScroll(page);
      await page.screenshot({ path: `${SHOTS}/home-${shape.name}.png`, fullPage: true });
      await page.getByTestId('dancer-app-tab-nights').click();
      // Slice B: no nights at all shows ONE empty state (what you can do), not empty sections.
      await expect(page.getByTestId(shape.rows.length === 0 ? 'nights-empty' : 'nights-upcoming')).toBeVisible();
      await expectNoHorizontalScroll(page);
      await page.screenshot({ path: `${SHOTS}/nights-${shape.name}.png`, fullPage: true });
    });
  }

  test('the nudge leads to Nights, the vote sticks, the nudge clears', async ({ page }) => {
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
