import { test, expect } from '@playwright/test';
import { ORG, PHONE, openOrganiser } from './helpers/organiserFake';

// Team (R1 S6) at 390x844: the join request sits above the list and Add as Manager is ONE add call;
// the faces wall adds with one tap; a person opens by user_id and is removed from there (Done offers
// "Add them back", no Undo). Each write is asserted by the exact body sent (helpers/organiserFake.ts).

test.use({ viewport: PHONE });

const ANA = '33333333-3333-4333-8333-333333333333';
const MARIA = '44444444-4444-4444-8444-444444444444';

test('the join request is above the list; Add as Manager sends one add and the member appears', async ({ page }) => {
  const fake = await openOrganiser(page, '/account/o/team');
  await expect(page.getByTestId('org-page-team')).toBeVisible();
  await expect(page.getByTestId('team-member')).toHaveCount(3);
  const maria = page.getByTestId('join-request').filter({ hasText: 'maria.k@example.com' });
  await expect(maria.getByTestId('join-request-message')).toContainText('I run the Sunday party with Diego');
  await maria.getByTestId('join-request-add').click();
  await expect(page.getByTestId('team-member')).toHaveCount(4);
  expect(fake.sent('organiser_team_add_member_by_profile_v1')).toEqual([{ p_organiser_id: ORG, p_profile_id: MARIA, p_member_role: 'manager', p_reason: null }]);
  await expect(page.getByTestId('join-request')).toHaveCount(1);
  expect(fake.sent('resolve_organiser_access_request_v1')).toHaveLength(0); // the add alone closes the request (REVIEW-S6 S1)
});

test('Decline answers the other request without adding anyone', async ({ page }) => {
  const fake = await openOrganiser(page, '/account/o/team');
  await page.getByTestId('join-request').filter({ hasText: 'tom.b@example.com' }).getByTestId('join-request-decline').click();
  await expect(page.getByTestId('join-request')).toHaveCount(1);
  expect(fake.sent('resolve_organiser_access_request_v1')[0]).toEqual({ p_request_id: 'r0000000-0000-4000-8000-000000000002', p_decision: 'decline' });
  expect(fake.sent('organiser_team_add_member_by_profile_v1')).toHaveLength(0);
});

test('the faces wall: a face that can be added is one tap, Done names them', async ({ page }) => {
  const fake = await openOrganiser(page, '/account/o/team/add');
  await expect(page.getByTestId('add-face')).toHaveCount(2);
  await page.getByTestId('add-face').filter({ hasText: 'Priya S.' }).click();
  await expect(page.getByTestId('org-done-message')).toHaveText('Priya S. is a Manager');
  expect(fake.sent('organiser_team_add_member_by_profile_v1')).toHaveLength(1);
});

test('an owner opens a manager and removes them; Done offers Add them back', async ({ page }) => {
  const fake = await openOrganiser(page, `/account/o/team/${ANA}`);
  await expect(page.getByTestId('person-role')).toHaveText('Manager');
  await page.getByTestId('person-remove').click();
  await page.getByTestId('person-remove-yes').click();
  await expect(page.getByTestId('org-done-message')).toHaveText('Removed from the team');
  expect(fake.sent('remove_organiser_member_v1')).toEqual([{ p_organiser_id: ORG, p_user_id: ANA }]);
  await page.getByTestId('org-done-next').click();
  await expect(page.getByTestId('org-page-team-add')).toBeVisible();
});

test('a manager sees the role but not the change control, with the reason', async ({ page }) => {
  await openOrganiser(page, `/account/o/team/${ANA}`, {}, (f) => { f.organisers[0].role = 'manager'; });
  await expect(page.getByTestId('person-change-role')).toBeDisabled();
  await expect(page.getByTestId('person-role-reason')).toHaveText('Only the owner changes roles or removes people');
  await expect(page.getByTestId('person-remove')).toHaveCount(0);
});
