import { test, expect } from '@playwright/test';
import { FRIDAY, ORG, PHONE, openOrganiser } from './helpers/organiserFake';

// W5a: the old organiser URLs (/account, /account/new, /account/series/:id,
// /account/team/:organiserId) redirect (replace) into /account/o, keeping the query string and
// hash; an unknown /account/o/* path goes to Home. Real router in the dev server, fake backend.

test.use({ viewport: PHONE });

const cases: [string, RegExp, string][] = [
  ['/account?from=email#top', /\/account\/o\?from=email#top$/, 'org-page-home'],
  ['/account/new?organiser=x', /\/account\/o\/events\/new\?organiser=x$/, 'org-page-new-event'],
  [`/account/series/${FRIDAY}?tab=dates`, new RegExp(`/account/o/events/${FRIDAY}\\?tab=dates$`), 'org-event-editor'],
  [`/account/team/${ORG}`, new RegExp(`/account/o/team\\?o=${ORG}$`), 'org-page-team'],
  [`/account/team/${ORG}?o=keep`, /\/account\/o\/team\?o=keep$/, 'org-page-team'],
  ['/account/o/nope', /\/account\/o$/, 'org-page-home'],
];

for (const [from, to, page_] of cases) {
  test(`${from} lands on the new area`, async ({ page }) => {
    await openOrganiser(page, from);
    await expect(page).toHaveURL(to);
    await expect(page.getByTestId(page_)).toBeVisible();
  });
}

test('the redirect replaces history: Back does not return to the old URL', async ({ page }) => {
  await openOrganiser(page, '/auth');
  await page.goto('/account');
  await expect(page).toHaveURL(/\/account\/o$/);
  await page.goBack();
  await expect(page).not.toHaveURL(/\/account$/);
});
