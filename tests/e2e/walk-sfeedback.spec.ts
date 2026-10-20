import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { FRIDAY, PHONE, openOrganiser, type OrganiserFake } from './helpers/organiserFake';

// THROWAWAY WALK SCRIPT (S-FEEDBACK), NOT in the test:e2e gate list. 390x844 shots against the route-mocked
// organiser fake and the PRODUCTION build (built with AW1_APPLIED flipped on locally so the programme can be edited;
// the flip is never committed).
//   node scripts/_serve-build.mjs --port 4173 &  then  npx playwright test tests/e2e/walk-sfeedback.spec.ts --project=chromium
test.use({ viewport: PHONE });
test.describe.configure({ mode: 'serial' });

const OUT = 'docs/organiser-rebuild/walk-SFB';
mkdirSync(OUT, { recursive: true });
const shot = (page: Page, name: string) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
const ENDED = 'b0000000-0000-4000-8000-0000000000e1';
const PAST = 'b0000000-0000-4000-8000-0000000000e2';
const NOTHING = 'b0000000-0000-4000-8000-0000000000e3';
const PNG = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="112" height="112"><rect width="112" height="112" fill="#c9843a"/><circle cx="56" cy="44" r="20" fill="#fde7c8"/><rect x="24" y="70" width="64" height="42" rx="20" fill="#fde7c8"/></svg>');

const item = (id: string, type: string, title: string, start: string | null, end: string | null, levels: string[] = []) =>
  ({ item: { id, type, title, start_time: start, end_time: end, level_keys: levels, room: null, venue_room_id: null, style: null, theme: null, track_id: null, parallel_group_id: null, sort_order: 0 }, people: [] });
const program = (items: unknown[]) => [{ day: { id: 'd0', day_index: 0, date_offset_days: 0, label: null, sort_order: 0 }, sections: [{ section: { id: 's0', kind: 'classes', sort_order: 0, label_override: null }, items }] }];

/** Give the fake's workspace a real programme (the fake only holds type + start). */
function withProgram(fake: OrganiserFake, items: unknown[]) {
  const orig = fake.workspace.bind(fake);
  fake.workspace = ((s: Parameters<typeof orig>[0]) => {
    const w = orig(s);
    return s.id === FRIDAY ? { ...w, series: { ...w.series, program: program(items) } } : w;
  }) as typeof fake.workspace;
}

const FRIDAY_ITEMS = [
  item('i2', 'class', 'Improvers', '20:00:00', '21:00:00', ['improver', 'intermediate']),
  item('i1', 'class', 'Beginners', '19:00:00', '20:00:00', ['beginner']),
  item('i3', 'party', 'Social', '21:00:00', '01:00:00'),
];

test('(a) event page rows', async ({ page }) => {
  await openOrganiser(page, `/account/o/events/${FRIDAY}/details`, {}, (f) => withProgram(f, FRIDAY_ITEMS));
  await expect(page.getByTestId('org-detail-rows')).toBeVisible();
  for (const k of ['ends', 'level', 'instagram', 'prices']) await expect(page.getByTestId(`org-detail-${k}`)).toHaveCount(0);
  await expect(page.getByTestId('org-detail-cover')).toContainText('Flyer');
  await shot(page, 'a-event-page-rows');
});

test('(b) session sheet chips are words', async ({ page }) => {
  const fake = await openOrganiser(page, '/account/o', {}, (f) => withProgram(f, FRIDAY_ITEMS));
  const s = fake.series.get(FRIDAY)!;
  const occ = fake.occId(s, '2026-10-09');
  await page.goto(`/account/o/change/${FRIDAY}/${occ}/lineup`);
  await page.getByTestId('session-row-open').first().click();
  await expect(page.getByTestId('session-levels')).toBeVisible();
  const chips = await page.getByTestId('level-text').allTextContents();
  console.log('LEVEL CHIPS', JSON.stringify(chips));
  for (const c of chips) expect(c).toMatch(/^(Beginner|Improver|Intermediate|Advanced|Open level)$/);
  await shot(page, 'b-session-sheet-chips');
});

test('(c) programme: sorted, no arrows, then two sessions entered out of order', async ({ page }) => {
  await openOrganiser(page, `/account/o/events/${FRIDAY}/programme`, {}, (f) => withProgram(f, FRIDAY_ITEMS));
  await expect(page.getByTestId('prog-item').first()).toBeVisible();
  expect(await page.getByTestId('prog-item-name').allTextContents()).toEqual(['Beginners', 'Improvers', 'Social']);
  await expect(page.getByTestId('prog-up')).toHaveCount(0);
  await expect(page.getByTestId('prog-save')).toHaveAttribute('aria-disabled', 'true');
  await shot(page, 'c1-programme-sorted-no-arrows');
  // Enter a late session first, then an early one: the early one lands first.
  for (const [name, start, end] of [['Late drill', '22:30', '23:30'], ['Warm up', '18:00', '18:45']]) {
    await page.getByTestId('prog-add-classes').click();
    await page.getByTestId('prog-type-class').click();
    await page.getByTestId('prog-name').fill(name);
    await page.getByTestId('prog-start').fill(start);
    await page.getByTestId('prog-end').fill(end);
    await page.getByTestId('prog-sheet-done').click();
  }
  expect(await page.getByTestId('prog-item-name').allTextContents()).toEqual(['Warm up', 'Beginners', 'Improvers', 'Social', 'Late drill']);
  await shot(page, 'c2-programme-two-entered-out-of-order');
});

test('(d) finished event shows only See it live; a live one keeps the full set', async ({ page }) => {
  await openOrganiser(page, `/account/o/events/${PAST}`, {}, (f) => {
    const org = f.organisers[0];
    f.addSeries(org, { id: ENDED, name: 'Picnic Social', lifecycle_status: 'ended', format: 'recurring', category: 'party', default_start_date: '2026-08-02', recurrence_rule: { mode: 'weekly', weekdays: [0], end: { kind: 'until_date', date: '2026-09-06' } }, ended_on: '2026-09-06' } as never);
    f.addSeries(org, { id: PAST, name: 'Summer Warehouse Night', lifecycle_status: 'live', format: 'one_off', category: 'party', default_start_date: '2026-09-12', recurrence_rule: null } as never);
    f.addSeries(org, { id: NOTHING, name: 'Tuesday Social', lifecycle_status: 'live', format: 'recurring', category: 'party', default_start_date: '2026-08-04', recurrence_rule: null } as never);
  });
  await expect(page.getByTestId('org-life-seelive')).toBeVisible();
  await expect(page.getByTestId('org-event-pause')).toHaveCount(0);
  await expect(page.getByTestId('org-event-end')).toHaveCount(0);
  await shot(page, 'd1-finished-past-dates-only');
  await page.goto(`/account/o/events/${NOTHING}`);
  await expect(page.getByTestId('org-life-seelive')).toBeVisible();
  await expect(page.getByTestId('org-event-pause')).toHaveCount(0);
  await shot(page, 'd2-nothing-coming-up');
  await page.goto(`/account/o/events/${ENDED}`);
  await expect(page.getByTestId('org-page-event')).toBeVisible();
  await shot(page, 'd3-ended-unchanged');
  await page.goto(`/account/o/events/${FRIDAY}`);
  await expect(page.getByTestId('org-event-pause')).toBeVisible();
  await expect(page.getByTestId('org-event-end')).toBeVisible();
  await expect(page.getByTestId('org-life-seelive')).toBeVisible();
  await shot(page, 'd4-live-full-set');
});

test('(e) team of 20 full: photos and initials, disabled', async ({ page }) => {
  await openOrganiser(page, '/account/o', {}, (f) => {
    const org = f.organisers[0];
    for (let i = org.team.length; i < 20; i++) org.team.push({ user_id: `aaaaaaaa-0000-4000-8000-${String(i).padStart(12, '0')}`, member_role: 'manager', is_primary: false, email: `m${i}@x.example`, display_name: `Member ${i}` });
  });
  await page.route('**/rest/v1/rpc/organiser_team_browse_people_v1', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([
      { profile_id: '66666666-6666-4666-8666-666666666666', display_name: 'Priya Sharma', photo_url: PNG, fact: 'attended:3', can_add: true },
      { profile_id: '77777777-7777-4777-8777-777777777777', display_name: 'Lena Voss', photo_url: null, fact: null, can_add: false },
      { profile_id: '88888888-8888-4888-8888-888888888888', display_name: 'Tomas Reid', photo_url: PNG, fact: 'dj', can_add: true },
    ]),
  }));
  await page.goto('/account/o/team/add');
  await expect(page.getByTestId('add-full')).toBeVisible();
  await expect(page.locator('[data-testid="add-face"] img')).toHaveCount(2);
  await expect(page.getByTestId('avatar-initials')).toHaveCount(1);
  for (const b of await page.getByTestId('add-face').all()) await expect(b).toBeDisabled();
  await expect(page.getByTestId('add-invite')).toBeEnabled();
  await shot(page, 'e-team-full-photos');
});
