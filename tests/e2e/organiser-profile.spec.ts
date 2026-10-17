import { test, expect } from '@playwright/test';
import { ORG, PHONE, openOrganiser } from './helpers/organiserFake';

// Your page (S7, C27/C28/C28b) at /account/o/page, 390x844: the public page's facts as rows over the
// existing edit-in-place sheets, ONE Save through organiser_profile_update_p5_v1, then the shared Done
// "Saved". No review card and no status copy (D22): a Live chip is the only status mark.
// Backend: helpers/organiserFake.ts.

test.use({ viewport: PHONE });

test('a changed About is drafted, saved once, and the page lands on Done "Saved"', async ({ page }) => {
  const fake = await openOrganiser(page, '/account/o/page');
  await expect(page.getByTestId('org-page-page')).toBeVisible();
  await expect(page.getByTestId('page-name')).toHaveText('Ritmo Bachata London');
  await expect(page.getByTestId('page-live-chip')).toHaveText('Live');
  await expect(page.getByTestId('eip-bar')).toHaveCount(0);

  await page.locator('[data-eip-pencil="bio"]').click();
  await page.getByRole('dialog').getByRole('textbox').fill('Weekly bachata in Soho.');
  await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
  expect(fake.sent('organiser_profile_update_p5_v1')).toHaveLength(0);
  await page.getByTestId('eip-bar').getByRole('button', { name: 'Save' }).click();

  await expect(page.getByTestId('org-done-message')).toHaveText('Saved');
  const [save] = fake.sent('organiser_profile_update_p5_v1');
  expect(save.p_organiser_id).toBe(ORG);
  expect(save.p_patch).toMatchObject({ bio: 'Weekly bachata in Soho.' });
  expect(fake.organisers[0].bio).toBe('Weekly bachata in Soho.');
});

test('no review step anywhere on the page, for a draft organiser too', async ({ page }) => {
  await openOrganiser(page, '/account/o/page', { organiserStatus: 'draft' });
  await expect(page.getByTestId('org-page-page')).toBeVisible();
  await expect(page.getByTestId('page-live-chip')).toHaveCount(0);
  await expect(page.getByText(/send for review/i)).toHaveCount(0);
});

test('More: the owner cannot leave until they hand over, and Help lists the jobs', async ({ page }) => {
  await openOrganiser(page, '/account/o/more');
  await expect(page.getByTestId('more-leave')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByTestId('more-leave-reason')).toHaveText('Hand over first');
  await expect(page.getByTestId('more-hand-over')).toBeVisible();
  await page.getByTestId('more-help').click();
  await expect(page.getByTestId('help-rows')).toBeVisible();
});
