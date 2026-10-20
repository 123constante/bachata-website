import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { FRIDAY, PHONE, OrganiserFake } from './helpers/organiserFake';

// THROWAWAY WALK SCRIPT (FIX-SW1, from walk-sw1.spec.ts), NOT in the test:e2e gate list. Screenshots at 390x844 of the
// SW1 screens (series programme, line-up sheet, cast, music chips, event organisers) against the
// route-mocked organiser fake carrying PROD-SHAPED programmes (read-only survey 2026-10-18: a
// weekly with two classes + a party, a one-off party, a festival day tree). Run against the
// PRODUCTION build:
//   VITE_ENABLE_ORGANISER_SELF_SERVE=true npm run build && node scripts/_serve-build.mjs --port 4173 &
//   SW1_WALK_DIR=docs/organiser-rebuild/walk-SW1 npx playwright test tests/e2e/walk-sw1.spec.ts --project=chromium

test.use({ viewport: PHONE });
test.describe.configure({ mode: 'serial' });

const OUT = process.env.SW1_WALK_DIR ?? 'docs/organiser-rebuild/walk-FIX-SW1';
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
  await page.goto(path);
  return fake;
}
const shot = async (page: Page, name: string) => {
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
};
const ev = (id: string) => `/account/o/events/${id}`;

test('01 Details: cast row clamped / empty state reason', async ({ page }) => {
  await open(page, `${ev(FRIDAY)}/details`);
  await expect(page.getByTestId('org-detail-cast-line')).toContainText('Ana Torres (Teacher)');
  await shot(page, `01-details${GATE_ON ? '-gate-on' : ''}`);
  await open(page, `${ev(FRIDAY)}/details`, []);
  await expect(page.getByTestId('org-detail-cast-line')).toHaveText(GATE_ON ? 'Add a teacher to a class to show them here.' : 'Needs the next platform update');
  await shot(page, `01-details-empty${GATE_ON ? '-gate-on' : ''}`);
});

test('02 programme: weekly with per-date changes, level chips with words', async ({ page }) => {
  await open(page, `${ev(FRIDAY)}/programme`);
  await expect(page.getByTestId('prog-differs-badge')).toContainText('Differs on 2 dates');
  await expect(page.getByTestId('prog-item-levels').first()).toHaveText(/B\s*Beginner\s*IM\s*Improver/);
  await shot(page, `02-programme${GATE_ON ? '-gate-on' : ''}`);
});

test('03 gate on: sheet roles, RECENT by type, delete confirm, rename Save keeps every id', async ({ page }) => {
  test.skip(!GATE_ON, 'needs the build with the gate flipped');
  const fake = await open(page, `${ev(FRIDAY)}/programme`);
  const sent = () => fake.sent('series_command_p5');
  await page.getByTestId('prog-item-open').first().click();
  await expect(page.getByTestId('prog-session-view')).toBeVisible();
  await expect(page.getByTestId('prog-role-djing')).toHaveCount(0);
  await shot(page, '03-session-sheet');
  await page.getByTestId('prog-add-person').click();
  await expect(page.getByTestId('prog-recent-person')).toHaveCount(2);
  await shot(page, '04-recent-teachers');
  await page.getByTestId('prog-recent-person').first().locator('button').first().click();
  await page.getByTestId('prog-name').fill('Beginner class (renamed)');
  await page.getByTestId('prog-sheet-done').click();
  await page.getByTestId('prog-delete').nth(1).click();
  await expect(page.getByTestId('prog-delete-copy')).toContainText('loses that change too');
  await shot(page, '05-delete-confirm');
  await page.getByTestId('prog-delete-keep').click();
  await page.getByTestId('prog-save').click();
  await expect.poll(() => sent().length).toBeGreaterThan(0);
  const days = JSON.stringify(sent()[0]);
  for (const id of ['"id":"d1"', '"id":"s1"', '"id":"s2"', '"id":"s3"', '"id":"i1"', '"id":"i2"', '"id":"i3"']) expect(days).toContain(id);
  expect(days).toContain('"profile_id":"p-rex","profile_type":"teacher","role":"teaching"');
  await shot(page, '06-after-save');
});
