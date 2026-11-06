import { test, expect, type Page } from '@playwright/test';
import { ORG, ORG_NAME, OrganiserFake, PHONE, json } from './helpers/organiserFake';

// PR #1251 fix round (review r1 "Not verified"): the overlays of wt-states at 390x844, in the real
// app against the organiser fake. Status sheet and its Remove confirm (F-22): sheet, Close and both
// confirm buttons inside the viewport, opening scrolls nothing; Remove lands on Events with the
// toast inside the viewport. An archived event (owner 2026-11-01) opens a Finished card, never
// "removed". Runs only in the P3 gate:
//   VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true npx playwright test tests/e2e/walk-p3-wt-states.spec.ts --project=chromium
// No test.skip: with the flags off the page does not mount and every test FAILS (scripts/check-p3-specs-not-skipped.mjs).

const LIVE = 'b0000000-0000-4000-8000-000000000a01';
const ARCHIVED = 'b0000000-0000-4000-8000-000000000a02';

async function open(page: Page, id: string, lifecycle: string) {
  const fake = new OrganiserFake({});
  await fake.install(page);
  fake.addSeries(fake.organisers[0], { id, name: 'States walk', category: 'party', format: 'recurring', lifecycle_status: lifecycle });
  await page.route('**/rest/v1/rpc/organiser_onboarding_status_v1*', (r) =>
    json(r, {
      v: 1, gate_on: false, is_admin: false, complete: true,
      person: { complete: true, missing: [] },
      organisers: [{ id: ORG, name: ORG_NAME, role: 'owner', lifecycle: 'live', complete: true, missing: [], about: { done: true, skipped: false } }],
    }));
  await page.goto(`/account/p3/events/${id}?o=${ORG}`);
  return fake;
}

async function settled(page: Page) {
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))));
}

async function inViewport(loc: ReturnType<Page['locator']>, what: string) {
  const b = await loc.boundingBox();
  expect(b, `${what} has a box`).not.toBeNull();
  expect(b!.x, `${what} left`).toBeGreaterThanOrEqual(-0.5);
  expect(b!.y, `${what} top`).toBeGreaterThanOrEqual(-0.5);
  expect(b!.x + b!.width, `${what} right`).toBeLessThanOrEqual(PHONE.width + 0.5);
  expect(b!.y + b!.height, `${what} bottom`).toBeLessThanOrEqual(PHONE.height + 0.5);
}

const scrolled = (page: Page) => page.evaluate(() => [window.scrollY, document.querySelector('.p3-main')?.scrollTop ?? 0]);

test.use({ viewport: PHONE });

test('status sheet + Remove confirm fit at 390x844, open without scrolling; Remove lands on Events with the toast', async ({ page }) => {
  await open(page, LIVE, 'live');
  await expect(page.getByTestId('p3-event')).toBeVisible({ timeout: 20_000 });
  await settled(page);

  const before = await scrolled(page);
  await page.getByTestId('p3-open-status').click();
  const sheet = page.getByTestId('p3-sheet');
  await expect(sheet).toBeVisible();
  await settled(page);
  expect(await scrolled(page), 'opening the status sheet scrolled the page').toEqual(before);
  await inViewport(sheet, 'status sheet');
  await inViewport(sheet.getByRole('button', { name: 'Close' }), 'Close');

  await page.getByTestId('p3-status-row-remove').click();
  await settled(page);
  const confirm = page.getByTestId('p3-remove-confirm');
  await expect(confirm).toBeVisible();
  await inViewport(confirm, 'Yes, remove it');
  await inViewport(page.getByRole('button', { name: 'Keep it' }), 'Keep it');
  expect(await scrolled(page), 'the confirm step scrolled the page').toEqual(before);

  await confirm.click();
  await expect(page).toHaveURL(/\/account\/p3\/events(\?|$)/);
  const toast = page.getByTestId('p3-toast');
  await expect(toast).toHaveText('Removed from your events.');
  await inViewport(toast, 'toast');
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflowX, 'no sideways page scroll').toBeLessThanOrEqual(0);
});

test('an archived event opens the Finished card inside the viewport, never "removed"', async ({ page }) => {
  await open(page, ARCHIVED, 'archived');
  const card = page.getByTestId('p3-event-archived');
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('p3-status')).toHaveText('Finished');
  await expect(card).not.toContainText(/remov/i);
  await inViewport(card, 'Finished card');
  await inViewport(card.getByRole('link', { name: 'See your events' }), 'See your events');
});
