import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { FRIDAY, PHONE, openOrganiser, type OrganiserFake } from './helpers/organiserFake';

// THROWAWAY WALK SCRIPT (S-PERF), NOT in the test:e2e gate list. 390x844 against the route-mocked organiser fake and the
// PRODUCTION build (built with AW1_APPLIED flipped on locally; the flip is never committed).
test.use({ viewport: PHONE });

const OUT = 'docs/organiser-rebuild/walk-PERF';
mkdirSync(OUT, { recursive: true });
const shot = (page: Page, name: string) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
const item = (id: string, type: string, title: string, start: string | null, end: string | null, levels: string[] = []) =>
  ({ item: { id, type, title, start_time: start, end_time: end, level_keys: levels, room: null, venue_room_id: null, style: null, theme: null, track_id: null, parallel_group_id: null, sort_order: 0 }, people: [] });
const program = (items: unknown[]) => [{ day: { id: 'd0', day_index: 0, date_offset_days: 0, label: null, sort_order: 0 }, sections: [{ section: { id: 's0', kind: 'classes', sort_order: 0, label_override: null }, items }] }];
function withProgram(fake: OrganiserFake, items: unknown[]) {
  const orig = fake.workspace.bind(fake);
  fake.workspace = ((s: Parameters<typeof orig>[0]) => {
    const w = orig(s);
    return s.id === FRIDAY ? { ...w, series: { ...w.series, program: program(items) } } : w;
  }) as typeof fake.workspace;
}

test('(a) three Add buttons and a performance row', async ({ page }) => {
  await openOrganiser(page, `/account/o/events/${FRIDAY}/programme`, {}, (f) => withProgram(f, [item('i0', 'class', 'Warm up', '18:00:00', '18:45:00', ['beginner'])]));
  await expect(page.getByTestId('prog-item').first()).toBeVisible();
  await page.getByTestId('prog-add-performance').click();
  await expect(page.getByTestId('prog-level-beginner')).toHaveCount(0);
  await expect(page.getByTestId('prog-add-person')).toBeDisabled();
  await page.getByTestId('prog-name').fill('Opening show');
  await page.getByTestId('prog-start').fill('20:00');
  await page.getByTestId('prog-end').fill('20:20');
  await page.getByTestId('prog-sheet-done').click();
  await expect(page.getByTestId('prog-add-performance')).toBeVisible();
  expect(await page.getByTestId('prog-item-name').allTextContents()).toEqual(['Warm up', 'Opening show']);
  await shot(page, 'a-programme-add-performance');
});
