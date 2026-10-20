import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { FRIDAY, PHONE, OrganiserFake } from './helpers/organiserFake';

// THROWAWAY WALK SCRIPT (INT4, from walk-fix-sw1.spec.ts), NOT in the test:e2e gate list. Screenshots at 390x844 of the
// SW1 screens (series programme, line-up sheet, cast, music chips, event organisers) against the
// route-mocked organiser fake carrying PROD-SHAPED programmes (read-only survey 2026-10-18: a
// weekly with two classes + a party, a one-off party, a festival day tree). Run against the
// PRODUCTION build:
//   VITE_ENABLE_ORGANISER_SELF_SERVE=true npm run build && node scripts/_serve-build.mjs --port 4173 &
//   SW1_WALK_DIR=docs/organiser-rebuild/walk-SW1 npx playwright test tests/e2e/walk-sw1.spec.ts --project=chromium

test.use({ viewport: PHONE });
test.describe.configure({ mode: 'serial' });

const OUT = process.env.SW1_WALK_DIR ?? 'docs/organiser-rebuild/walk-INT4';
mkdirSync(OUT, { recursive: true });
const GATE_ON = process.env.SW1_GATE === 'on';

const person = (id: string, name: string, role = 'teaching', level: string | null = null, type?: string) => ({
  id: `pp-${id}`, item_id: 'x', profile_id: id, profile_type: type ?? (role === 'djing' ? 'dj' : 'teacher'), role, level, sort_order: 0, display_name: name, avatar_url: null,
});
const item = (id: string, type: string, title: string, start: string, end: string, people: unknown[] = []) => ({
  item: { id, title, type, start_time: start, end_time: end, room: null, venue_room_id: null, level_keys: type === 'class' ? ['beginner', 'improver'] : [], style: null, theme: null, track_id: null, parallel_group_id: null, sort_order: 0 },
  people,
});
const day = (id: string, sections: unknown[], idx = 0) => ({ day: { id, day_index: idx, date_offset_days: idx, label: null, sort_order: idx }, sections });
const section = (id: string, kind: string, items: unknown[]) => ({ section: { id, kind, sort_order: 0, label_override: null }, items });
const WEEKLY = [day('d1', [
  section('s1', 'classes', [
    item('i1', 'class', 'Beginner class', '19:00:00', '20:00:00', [person('p-ana', 'Ana Torres'), person('p-ben', 'Ben Okafor', 'teaching', 'beginner')]),
    item('i2', 'class', 'Improver class', '20:00:00', '21:00:00', [person('p-ana', 'Ana Torres')]),
  ]),
  section('s2', 'party', [item('i3', 'party', 'Late Social', '21:00:00', '01:00:00', [person('p-dee', 'Dee Marquez', 'djing')])]),
  section('s3', 'masterclass', []),
])];
const FESTIVAL = [
  day('d1', [section('s1', 'party', [item('i1', 'party', 'Opening party', '21:00:00', '03:00:00', [person('p-dee', 'Dee Marquez', 'djing')])])], 0),
  day('d2', [section('s2', 'classes', [item('i2', 'class', 'Workshop block', '11:00:00', '12:30:00', [person('p-ana', 'Ana Torres')])])], 1),
];
const ORGS = [
  { id: 'a0000000-0000-4000-8000-000000000001', name: 'Ritmo Bachata London', avatar_url: null },
  { id: 'a0000000-0000-4000-8000-000000000009', name: 'Salsa Crew', avatar_url: null },
];
const FEST = 'b0000000-0000-4000-8000-0000000000f1';

async function open(page: Page, path: string, program: unknown[] = WEEKLY, extra: Record<string, unknown> = {}) {
  const fake = new OrganiserFake();
  fake.addSeries(fake.organisers[0], { id: FEST, name: 'Summer Bachata Festival', format: 'festival', category: null, default_venue_id: null,
    default_start_date: '2026-10-16', recurrence_rule: null, version: 2 } as never);
  await fake.install(page);
  await page.route('**/rest/v1/rpc/admin_event_workspace_p5', async (route) => {
    const body = (route.request().postDataJSON() ?? {}) as { p_series_id?: string };
    const s = fake.series.get(String(body.p_series_id));
    if (!s) return route.fallback();
    const ws = fake.workspace(s) as { series: { series: Record<string, unknown>; program: unknown[] }; occurrences: Record<string, unknown>[] };
    ws.series.program = body.p_series_id === FEST ? FESTIVAL : program;
    ws.series.series.organiser_ids = ORGS.map((o) => o.id);
    Object.assign(ws.series.series, extra);
    if (ws.occurrences[0]) ws.occurrences[0].session_overrides_count = 1;
    if (ws.occurrences[2]) ws.occurrences[2].added_sessions_count = 2;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ws) });
  });
  await page.route('**/rest/v1/organiser_profiles**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ORGS) }));
  await page.route('**/rest/v1/rpc/organiser_series_cast_v1', (route) => route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ cast: [], recent_people: [
      { profile_id: 'p-rex', profile_type: 'teacher', display_name: 'Rex Alvarez', photo_url: null, roles: ['teaching'] },
      { profile_id: 'p-bo', profile_type: 'teacher', display_name: 'Bo Both', photo_url: null, roles: ['teaching', 'djing'] },
      { profile_id: 'p-zed', profile_type: 'dj', display_name: 'Zed NoRole', photo_url: null, roles: [] },
    ] }) }));
  // INT4: a second page the viewer MANAGES (not linked), so Link a page has one page to offer.
  fake.organisers.push({ ...fake.organisers[0], id: 'a0000000-0000-4000-8000-00000000000b', name: 'Ritmo Sundays', role: 'manager', series: [] });
  await page.goto(path);
  return fake;
}
const shot = async (page: Page, name: string) => {
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
};
const ev = (id: string) => `/account/o/events/${id}`;

const ONE = [day('d1', [section('s1', 'classes', [item('i1', 'class', 'Beginner class', '19:00:00', '20:00:00', [person('p-ana', 'Ana Torres')])])])];
const g = GATE_ON ? 'on' : 'off';

test('01 programme shapes: 0 items, 1 item, many items with per-date changes', async ({ page }) => {
  await open(page, `${ev(FRIDAY)}/programme`, []);
  await expect(page.getByTestId('prog-empty')).toBeVisible();
  await shot(page, `01-programme-empty-${g}`);
  await open(page, `${ev(FRIDAY)}/programme`, ONE);
  await expect(page.getByText('Beginner class')).toBeVisible();
  await shot(page, `02-programme-one-${g}`);
  await open(page, `${ev(FRIDAY)}/programme`);
  await expect(page.getByTestId('prog-differs-badge')).toContainText('Differs on 2 dates');
  await shot(page, `03-programme-many-override-${g}`);
});

test('02 programme locks: ended, draft, festival (admin-only)', async ({ page }) => {
  await open(page, `${ev(FRIDAY)}/programme`, WEEKLY, { lifecycle_status: 'ended' });
  await expect(page.getByText(/This event has ended/).first()).toBeVisible();
  await shot(page, `04-programme-ended-${g}`);
  await open(page, `${ev(FRIDAY)}/programme`, WEEKLY, { lifecycle_status: 'draft' });
  await expect(page.getByText('Beginner class')).toBeVisible();
  await shot(page, `05-programme-draft-${g}`);
  await open(page, `${ev(FEST)}/programme`);
  await expect(page.getByText('Festival days are edited with the platform team for now.').first()).toBeVisible();
  await shot(page, `06-programme-festival-${g}`);
});

test('03 details: cast + music chips; organisers', async ({ page }) => {
  await open(page, `${ev(FRIDAY)}/details`);
  await expect(page.getByTestId('org-detail-cast-line')).toContainText('Ana Torres');
  await shot(page, `07-details-cast-music-${g}`);
  await open(page, `${ev(FRIDAY)}/organisers`);
  await expect(page.getByTestId('org-linked-row').first()).toBeVisible();
  await shot(page, `08-organisers-${g}`);
});

test('04 gate on: Link a page offers only the viewer\'s own pages; line-up sheet with RECENT', async ({ page }) => {
  test.skip(!GATE_ON, 'needs the build with the gate flipped');
  await open(page, `${ev(FRIDAY)}/organisers`);
  await page.getByTestId('org-add').click();
  await expect(page.getByTestId('org-add-result')).toHaveCount(1);
  await expect(page.getByTestId('org-add-result')).toContainText('Ritmo Sundays');
  await expect(page.getByTestId('org-add-view')).not.toContainText('Salsa Crew');
  await shot(page, '09-organisers-add-sheet-on');
  await open(page, `${ev(FRIDAY)}/programme`);
  await page.getByText('Beginner class').first().click();
  await shot(page, '10-session-sheet-on');
});
