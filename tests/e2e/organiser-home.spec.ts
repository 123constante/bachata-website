import { test, expect } from '@playwright/test';
import { PHONE, openOrganiser } from './helpers/organiserFake';

// The organiser Home at /account/o under rule 2 (S1, boards C1/C1b): a numbered list of the
// day's jobs (1 Change a date, 2 Add a date, 3 Cancel a date, then the problems), gold New
// event, then Team - My page, My events - More. No dates list, no strips, no section labels.
// S8 rewrites this for the full matrix. Backend: the stateful fake in helpers/organiserFake.ts.

test.use({ viewport: PHONE });

test('a running page: jobs 1-3, then the problems as further numbered rows; no stats', async ({ page }) => {
  await openOrganiser(page, '/account/o');
  await expect(page.getByTestId('org-page-home')).toBeVisible();
  const rows = page.getByTestId('home-job');
  await expect(rows.first()).toBeVisible();
  await expect(rows.nth(0)).toHaveText('1Change a date');
  await expect(rows.nth(1)).toHaveText('2Add a date');
  await expect(rows.nth(2)).toHaveText('3Cancel a date');
  // Two open join requests on the fake page: each a problem row.
  await expect(page.locator('[data-testid="home-job"][data-kind="join_request"]')).toHaveCount(2);
  await expect(page.getByTestId('home-new-event')).toHaveCount(1);
  await expect(page.getByTestId('home-small')).toHaveText(['Team', 'My page', 'My events', 'More']);
  await expect(page.getByTestId('org-page-home')).not.toContainText(/views|tickets sold|revenue|next dates/i);
});

test('every job row and button is at least 44px tall', async ({ page }) => {
  await openOrganiser(page, '/account/o');
  await expect(page.getByTestId('home-job').first()).toBeVisible();
  const heights = await page.locator('[data-testid="org-page-home"] button, [data-testid="org-page-home"] a').evaluateAll(
    (els) => els.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => e.getBoundingClientRect().height),
  );
  expect(heights.length).toBeGreaterThan(6);
  expect(heights.filter((h) => h < 44)).toEqual([]);
});

test('New event opens the new-event flow', async ({ page }) => {
  await openOrganiser(page, '/account/o');
  await page.getByTestId('home-new-event').click();
  await expect(page).toHaveURL(/\/account\/o\/new\/what$/);
});

test('a join request row opens Team', async ({ page }) => {
  await openOrganiser(page, '/account/o');
  await page.locator('[data-testid="home-job"][data-kind="join_request"]').first().click();
  await expect(page).toHaveURL(/\/account\/o\/team$/);
  await expect(page.getByTestId('org-page-team')).toBeVisible();
});

test('Change a date opens the change flow', async ({ page }) => {
  await openOrganiser(page, '/account/o');
  await page.getByTestId('home-job').first().click();
  await expect(page).toHaveURL(/\/account\/o\/change$/);
});

test('a load failure shows the error state and Retry recovers', async ({ page }) => {
  await openOrganiser(page, '/account/o', {}, (fake) => fake.refuse('organiser_home_v1', 'boom', 2));
  await expect(page.getByTestId('home-error')).toBeVisible();
  await page.getByTestId('home-error-retry').click();
  await expect(page.getByTestId('home-job').first()).toBeVisible();
});
