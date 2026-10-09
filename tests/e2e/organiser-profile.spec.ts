import { test, expect } from '@playwright/test';
import { CITY, ORG, PHONE, openOrganiser } from './helpers/organiserFake';

// Profile (W4 + F1) at /account/o/profile at 390x844: the organiser's name and links saved
// through organiser_profile_update_p5_v1 (ONE primary 'Save profile' in the preview bar), and
// the Status card's 'Send for review' (draft / changes needed only) -> confirm ->
// submit_organiser_profile_v1 -> In review. Replaces the send-for-review coverage of the old
// /account specs (deleted UI). Backend: helpers/organiserFake.ts.

test.use({ viewport: PHONE });

test('profile save sends the whole form and the page shows the saved values', async ({ page }) => {
  const fake = await openOrganiser(page, '/account/o/profile');
  await expect(page.getByTestId('org-page-profile')).toBeVisible();
  const action = page.getByTestId('profile-bar-action');
  await expect(page.getByTestId('profile-name')).toHaveValue('Ritmo Bachata London');
  await expect(page.getByTestId('profile-instagram-value')).toHaveText('@ritmo');
  await expect(action).toBeDisabled();

  await page.getByTestId('profile-name').fill('Ritmo Bachata Soho');
  await page.getByTestId('profile-instagram').click();
  await page.getByTestId('profile-field').fill('@ritmo.soho');
  await page.getByTestId('profile-sheet-done').click();
  await expect(page.getByTestId('profile-preview-name')).toHaveText('Ritmo Bachata Soho');
  await expect(action).toContainText('Save profile');
  await action.click();

  await expect(action).toContainText('Saved');
  const [save] = fake.sent('organiser_profile_update_p5_v1');
  expect(save.p_organiser_id).toBe(ORG);
  expect(save.p_patch).toMatchObject({ name: 'Ritmo Bachata Soho', city_id: CITY.id, bio: 'Weekly bachata in London.' });
  expect(String((save.p_patch as Record<string, unknown>).instagram)).toContain('ritmo.soho');
  expect(fake.organisers[0].name).toBe('Ritmo Bachata Soho');
});

test('a draft organiser is sent for review after the confirm and then reads In review', async ({ page }) => {
  const fake = await openOrganiser(page, '/account/o/profile', { organiserStatus: 'draft' });
  await expect(page.getByTestId('profile-status-tag')).toHaveText('Draft');
  await page.getByTestId('profile-send-review').click();
  await expect(page.getByTestId('profile-send-confirm')).toContainText(`Send Ritmo Bachata London to the Bachata Calendar team for review?`);
  expect(fake.sent('submit_organiser_profile_v1')).toHaveLength(0);
  await page.getByTestId('profile-send-yes').click();
  await expect(page.getByTestId('profile-status-tag')).toHaveText('In review');
  await expect(page.getByTestId('profile-send-review')).toHaveCount(0);
  expect(fake.sent('submit_organiser_profile_v1')).toEqual([{ p_organiser_id: ORG }]);
});

test('changes needed shows the team’s reason and offers to send again; live offers nothing', async ({ page }) => {
  await openOrganiser(page, '/account/o/profile', { organiserStatus: 'rejected' }, (f) => {
    f.organisers[0].latest_decision = { action: 'rejected', from_state: 'pending_review', to_state: 'rejected', reason: 'Add your Instagram', created_at: '2026-10-01T10:00:00Z' };
  });
  await expect(page.getByTestId('profile-status-tag')).toHaveText('Changes needed');
  await expect(page.getByTestId('profile-status-sentence')).toHaveText('The team asked for changes: Add your Instagram');
  await expect(page.getByTestId('profile-send-review')).toHaveText('Send for review again');
});

test('a live organiser is not offered Send for review', async ({ page }) => {
  await openOrganiser(page, '/account/o/profile');
  await expect(page.getByTestId('profile-status-tag')).toHaveText('Live');
  await expect(page.getByTestId('profile-send-review')).toHaveCount(0);
});
