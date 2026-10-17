import { test, expect } from '@playwright/test';
import { PHONE, openOrganiser } from './helpers/organiserFake';

// The WHOLE R1 organiser loop in one journey at 390x844, against ONE stateful fake
// (helpers/organiserFake.ts). There is no tab bar any more: every screen is reached from
// Home and comes back to it. A new organiser creates their page (live at create, A1b), Home
// shows the first jobs, New event walks to the venue step, My events lists the draft, and
// Team shows the one owner. The other organiser-*.spec.ts files each prove one screen; this
// one proves they hand over to each other through Home.

test.use({ viewport: PHONE });

test('create a page, Home, New event, My events lists it, Team, back to Home each time', async ({ page }) => {
  const fake = await openOrganiser(page, '/account/o', { noOrganiser: true });

  await page.getByTestId('onboarding-create').click();
  await page.getByTestId('onboarding-create-name').fill('Salsa Nova');
  await page.getByTestId('onboarding-create-next').click();
  await page.getByTestId('onboarding-city-search').fill('Lon');
  // Picking the city is the create (S9: name, then city).
  await page.getByTestId('onboarding-city-option').first().click();
  await expect(page.getByTestId('home-jobs')).toBeVisible();
  await expect(page.getByTestId('org-tabbar')).toHaveCount(0);
  expect(fake.organisers[0].lifecycle_status).toBe('live');

  await page.getByTestId('home-new-event').click();
  await expect(page).toHaveURL(/\/account\/o\/new\/what$/);
  await page.getByTestId('org-new-format-recurring').click();
  await page.getByTestId('org-new-name').fill('Nova Thursdays');
  await page.getByTestId('org-new-next').click();
  await expect(page).toHaveURL(/\/account\/o\/new\/[0-9a-f-]{36}\/venue$/);
  expect(fake.envelopes().map((e) => e.command.kind)).toEqual(['series.upsert']);

  await page.goto('/account/o');
  await expect(page.getByTestId('home-jobs')).toBeVisible();
  await page.getByTestId('home-small').filter({ hasText: 'My events' }).click();
  await expect(page.getByTestId('org-event-row').filter({ hasText: 'Nova Thursdays' })).toHaveCount(1);
  await page.getByTestId('org-back').click();
  await expect(page.getByTestId('home-jobs')).toBeVisible();

  await page.getByTestId('home-small').filter({ hasText: 'Team' }).click();
  await expect(page.getByTestId('org-page-team')).toBeVisible();
  await expect(page.getByTestId('join-request')).toHaveCount(0);
  await expect(page.getByTestId('team-member')).toHaveCount(1);
  await page.getByTestId('org-back').click();
  await expect(page.getByTestId('home-jobs')).toBeVisible();
});
