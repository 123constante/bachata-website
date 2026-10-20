import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { FRIDAY, PHONE, openOrganiser, type OrganiserFake } from './helpers/organiserFake';

// THROWAWAY WALK SCRIPT (S-SORT), NOT in the test:e2e gate list. 390x844 shots against the route-mocked
// organiser fake and the PRODUCTION build (built with AW1_APPLIED flipped on locally so the programme can be edited;
// the flip is never committed).
//   node scripts/_serve-build.mjs --port 4173 &  then  npx playwright test tests/e2e/walk-ssort.spec.ts --project=chromium
test.use({ viewport: PHONE });
test.describe.configure({ mode: 'serial' });

const OUT = 'docs/organiser-rebuild/walk-SORT';
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

const STORED = [
  item('i3', 'party', 'Social', '21:00:00', '01:00:00'),
  item('i0', 'class', 'Warm up', '18:00:00', '18:45:00'),
];

test('(a) overnight After-party sorts LAST when entered in a shuffled order', async ({ page }) => {
  await openOrganiser(page, `/account/o/events/${FRIDAY}/programme`, {}, (f) => withProgram(f, STORED));
  await expect(page.getByTestId('prog-item').first()).toBeVisible();
  for (const [type, name, start, end] of [['party', 'After-party', '00:30', '04:00'], ['class', 'Beginners', '19:00', '20:00']]) {
    await page.getByTestId('prog-add-classes').click();
    await page.getByTestId(`prog-type-${type}`).click();
    await page.getByTestId('prog-name').fill(name);
    await page.getByTestId('prog-start').fill(start);
    await page.getByTestId('prog-end').fill(end);
    await page.getByTestId('prog-sheet-done').click();
  }
  expect(await page.getByTestId('prog-item-name').allTextContents()).toEqual(['Warm up', 'Beginners', 'Social', 'After-party']);
  await shot(page, 'a-programme-overnight-sorted');
});
