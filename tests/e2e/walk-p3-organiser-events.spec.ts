import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { PHONE, openOrganiser, expectNoHorizontalScroll, ORG, FRIDAY, json } from './helpers/organiserFake';

// THROWAWAY WALK SCRIPT (organiser Events tab), NOT in the test:e2e gate list. 390x844 against the
// route-mocked organiser fake. Needs the flags ON in the dev server:
//   VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true VITE_ENABLE_ORGANISER_DASH=true \
//   npx playwright test tests/e2e/walk-p3-organiser-events.spec.ts --project=chromium
test.use({ viewport: PHONE });
const OUT = process.env.P3_WALK_DIR ?? 'docs/design/profile-dash/shots';
mkdirSync(OUT, { recursive: true });
const PATH = '/account/p3/events';
const shot = (page: import('@playwright/test').Page, name: string) => page.screenshot({ path: `${OUT}/organiser-events-walk-${name}.png` });

test('normal', async ({ page }) => {
  await openOrganiser(page, PATH);
  await expect(page.getByTestId('p3-events-dash')).toBeVisible();
  await expect(page.getByTestId('ev-night').first()).toBeVisible();
  await expectNoHorizontalScroll(page);
  await shot(page, 'normal');
});

test('empty', async ({ page }) => {
  await openOrganiser(page, PATH, {}, (fake) => { fake.organisers[0].series = []; });
  await expect(page.getByTestId('ev-empty')).toBeVisible();
  await expectNoHorizontalScroll(page);
  await shot(page, 'empty');
});

test('huge', async ({ page }) => {
  await openOrganiser(page, PATH, {}, (fake) => {
    const org = fake.organisers[0];
    for (let i = 0; i < 45; i++) fake.addSeries(org, { id: `d${String(i).padStart(7, '0')}-0000-4000-8000-000000000001`, name: `Night series ${i + 1}`, default_start_date: '2026-10-12', recurrence_rule: { mode: 'weekly', weekdays: [1], end: { kind: 'until_date', date: '2027-03-01' } } });
  });
  await expect(page.getByTestId('ev-more')).toBeVisible();
  await expectNoHorizontalScroll(page);
  await shot(page, 'huge');
});

test('error', async ({ page }) => {
  const fake = await openOrganiser(page, '/account/p3', {}, (f) => f.refuse('organiser_home_v1', 'boom', 20));
  void fake;
  await page.goto(PATH);
  await page.waitForTimeout(2500);
  await expectNoHorizontalScroll(page);
  await shot(page, 'error');
});

test('conflict', async ({ page }) => {
  const fake = await openOrganiser(page, PATH);
  await page.route('**/rest/v1/rpc/admin_bulk_occurrence_command_p5', (route) => json(route, { code: 'P0001', message: 'version_conflict: expected 3, found 4', details: null, hint: null }, 400));
  await page.getByTestId('ev-night').first().click();
  await page.getByTestId('ev-cancel').click();
  await page.getByTestId('ev-scope-all').click();
  await expect(page.getByTestId('ev-every-confirm')).toBeVisible();
  await shot(page, 'every-night-confirm');
  await page.getByTestId('ev-every-confirm').click();
  await expect(page.getByTestId('ev-every-conflict')).toBeVisible();
  await shot(page, 'conflict');
  // Someone else changed the event meanwhile: the version moves on and one coming night is cancelled,
  // so the refetched confirm names a different count than the one shown before the conflict.
  for (const s of fake.series.values()) {
    s.version += 1;
    const d = fake.upcoming(s)[1] ?? fake.upcoming(s)[0];
    if (d) s.cancelled[d] = 'Rain';
  }
  await page.getByTestId('ev-every-conflict-reload').click();
  await expect(page.getByTestId('ev-every-confirm')).toBeVisible();
  await shot(page, 'conflict-after-reload');
});
void ORG; void FRIDAY;
