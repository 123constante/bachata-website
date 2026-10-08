import { test, expect } from '@playwright/test';
import { PHONE, openOrganiser } from './helpers/organiserFake';

// The WHOLE new organiser loop in one journey at 390x844, against ONE stateful fake
// (helpers/organiserFake.ts): a new organiser creates their organiser, sends it for review,
// the team approves it (the fake flips lifecycle_status, as the admin moderation RPCs do),
// they create an event by name, open its first date, put a teacher on the class and save,
// and Home lists the date. The other organiser-*.spec.ts files each prove one screen; this one
// proves the screens hand over to each other through the tab bar. Rewritten for /account/o
// (the old /account loop's UI is deleted).

test.use({ viewport: PHONE });

test('create an organiser, send it for review, get approved, create an event, staff a date', async ({ page }) => {
  const fake = await openOrganiser(page, '/account/o', { noOrganiser: true });

  await page.getByTestId('onboarding-create').click();
  await page.getByTestId('onboarding-create-name').fill('Salsa Nova');
  await page.getByTestId('onboarding-create-city').click();
  await page.getByTestId('onboarding-city-search').fill('Lon');
  await page.getByTestId('onboarding-city-option').first().click();
  await page.getByTestId('onboarding-create-submit').click();
  await expect(page.getByTestId('home-empty')).toBeVisible();

  await page.getByTestId('org-tab-profile').click();
  await expect(page.getByTestId('profile-status-tag')).toHaveText('Draft');
  await page.getByTestId('profile-send-review').click();
  await page.getByTestId('profile-send-yes').click();
  await expect(page.getByTestId('profile-status-tag')).toHaveText('In review');

  // The team approves it.
  fake.organisers[0].lifecycle_status = 'live';
  await page.reload();
  // A reload re-pays the lazy route chunks; under full-suite load the page can sit on the
  // bare public chrome for a while, so wait for the Profile screen before reading its tag.
  await expect(page.getByTestId('org-page-profile')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('profile-status-tag')).toHaveText('Live', { timeout: 15_000 });

  await page.getByTestId('org-tab-home').click();
  await page.getByTestId('home-new-event').click();
  await page.getByTestId('org-new-event-name').fill('Nova Thursdays');
  await page.getByTestId('org-new-event-create').click();
  await expect(page.getByTestId('org-event-editor')).toBeVisible();
  await expect(page.getByTestId('org-date-row')).toHaveCount(8);

  await page.getByTestId('org-date-row').first().click();
  await expect(page.getByTestId('org-page-date')).toBeVisible();
  const beginners = page.getByTestId('session-row').filter({ hasText: 'Beginners' });
  await beginners.getByTestId('session-row-open').click();
  await page.getByTestId('session-add-person').click();
  await page.getByTestId('people-search').fill('eva');
  await page.getByTestId('people-result').first().click();
  await page.getByTestId('date-sheet-done').click();
  await page.getByTestId('date-preview-bar-action').click();
  await expect(page.getByTestId('date-preview-bar-action')).toBeDisabled();
  await expect(beginners.getByTestId('session-row-people')).toHaveText('Ana Ruiz, Eva Sol');

  await page.getByTestId('org-tab-home').click();
  const first = page.getByTestId('home-date-row').first();
  await expect(first).toContainText('Nova Thursdays');
  await expect(first).toContainText('Draft');

  await page.getByTestId('org-tab-team').click();
  await expect(page.getByTestId('requests-empty')).toBeVisible();
  await expect(page.getByTestId('team-member')).toHaveCount(1);
});
