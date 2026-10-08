import { test, expect } from '@playwright/test';
import { FRIDAY, PHONE, SUNDAY, openOrganiser } from './helpers/organiserFake';

// The organiser Home at /account/o (W1): 'Next dates' soonest first, ONE New event button, no
// stats, and each strip only when needed (team requests, runway 'dates listed until', dates
// with no teacher or DJ). Replaces the old /account home spec (deleted UI). Backend: the
// stateful fake in helpers/organiserFake.ts (every call answered in the browser).

test.use({ viewport: PHONE });

test('next dates soonest first, one New event button, no stats', async ({ page }) => {
  await openOrganiser(page, '/account/o');
  await expect(page.getByTestId('org-page-home')).toBeVisible();
  const rows = page.getByTestId('home-date-row');
  await expect(rows.first()).toBeVisible();
  const dates = await rows.evaluateAll((els) => els.map((e) => e.getAttribute('data-occurrence') ?? ''));
  // Fri 9, Sun 11, Fri 16, Sun 18, Fri 23 ... (occurrence ids end in the yyyymmdd date).
  const keys = dates.map((id) => id.split('-').pop()!.slice(0, 8));
  expect(keys).toEqual([...keys].sort());
  expect(keys.slice(0, 4)).toEqual(['20261009', '20261011', '20261016', '20261018']);
  await expect(rows.first()).toContainText('Friday Bachata');
  await expect(rows.first()).toContainText('Studio One');
  await expect(rows.first()).toContainText('Live');
  await expect(page.getByTestId('home-new-event')).toHaveCount(1);
  await expect(page.getByTestId('org-page-home')).not.toContainText(/views|tickets sold|revenue/i);

  await rows.first().click();
  await expect(page).toHaveURL(new RegExp(`/account/o/events/${FRIDAY}/dates/`));
});

test('New event opens the name-only create', async ({ page }) => {
  await openOrganiser(page, '/account/o');
  await page.getByTestId('home-new-event').click();
  await expect(page).toHaveURL(/\/account\/o\/events\/new$/);
  await expect(page.getByTestId('org-new-event-name')).toBeVisible();
});

test('team strip: requests waiting opens Team', async ({ page }) => {
  await openOrganiser(page, '/account/o');
  const strip = page.getByTestId('home-strip-team');
  await expect(strip).toContainText('2 team requests are waiting');
  await strip.click();
  await expect(page).toHaveURL(/\/account\/o\/team/);
  await expect(page.getByTestId('org-page-team')).toBeVisible();
});

test('runway strip: a series running short says until when, and opens its event', async ({ page }) => {
  await openOrganiser(page, '/account/o');
  const strip = page.getByTestId('home-strip-runway');
  await expect(strip).toContainText('Sunday Party: dates listed until Sun 18 Oct.');
  await expect(strip).toContainText('Extend');
  await strip.click();
  await expect(page).toHaveURL(new RegExp(`/account/o/events/${SUNDAY}$`));
  await expect(page.getByTestId('org-event-editor')).toBeVisible();
});

test('line-up strip: counts dates with no teacher or DJ and opens the first', async ({ page }) => {
  await openOrganiser(page, '/account/o');
  const strip = page.getByTestId('home-strip-lineup');
  await expect(strip).toContainText('2 dates have no teacher or DJ yet');
  await strip.click();
  await expect(page).toHaveURL(new RegExp(`/account/o/events/${SUNDAY}/dates/c0000002-0000-4000-8000-202610110000$`));
  await expect(page.getByTestId('org-page-date')).toBeVisible();
});

test('no strips when nothing needs the organiser', async ({ page }) => {
  await openOrganiser(page, '/account/o', {}, (fake) => {
    fake.organisers[0].requests = [];
    fake.emptyLineup.clear();
    fake.organisers[0].series = [FRIDAY];
  });
  await expect(page.getByTestId('home-date-row').first()).toBeVisible();
  // The strips' reads run after the list; give them the time they take, then expect none.
  await page.waitForLoadState('networkidle');
  await expect(page.getByTestId('home-strips')).toHaveCount(0);
});

test('a load failure shows the error state and Retry recovers', async ({ page }) => {
  await openOrganiser(page, '/account/o', {}, (fake) => fake.refuse('organiser_home_v1', 'boom', 2));
  await expect(page.getByTestId('home-error')).toBeVisible();
  await page.getByTestId('home-error-retry').click();
  await expect(page.getByTestId('home-date-row').first()).toBeVisible();
});
