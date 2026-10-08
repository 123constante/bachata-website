import { test, expect } from '@playwright/test';
import { ORG, PHONE, openOrganiser } from './helpers/organiserFake';

// Team (W4) at /account/o/team at 390x844: requests to join are approved (Add as manager,
// after a plain-words confirm) or declined in one tap; members are listed with their roles and
// a manager can be removed after a confirm. Each write is asserted by the exact body sent, then
// the page is checked to re-read the result (helpers/organiserFake.ts). Replaces the old
// /account/team/:id spec (deleted UI).

test.use({ viewport: PHONE });

test('an owner approves one request and declines the other; the team re-reads', async ({ page }) => {
  const fake = await openOrganiser(page, '/account/o/team');
  await expect(page.getByTestId('org-page-team')).toBeVisible();
  await expect(page.getByTestId('team-member')).toHaveCount(3);
  const requests = page.getByTestId('access-request');
  await expect(requests).toHaveCount(2);

  const maria = requests.filter({ hasText: 'maria.k@example.com' });
  await expect(maria.getByTestId('request-message')).toContainText('I run the Sunday party with Diego');
  await maria.getByTestId('request-grant').click();
  await expect(page.getByTestId('request-grant-confirm')).toContainText('Add maria.k@example.com as a manager?');
  expect(fake.sent('resolve_organiser_access_request_v1')).toHaveLength(0);
  await page.getByTestId('request-grant-confirm-yes').click();
  await expect(page.getByTestId('team-confirmation')).toContainText('maria.k@example.com can now edit');
  expect(fake.sent('resolve_organiser_access_request_v1')).toEqual([
    { p_request_id: 'r0000000-0000-4000-8000-000000000001', p_decision: 'grant', p_member_role: 'manager' },
  ]);
  await expect(requests).toHaveCount(1);

  await requests.filter({ hasText: 'tom.b@example.com' }).getByTestId('request-decline').click();
  await expect(page.getByTestId('team-confirmation')).toHaveText('Declined. tom.b@example.com can ask again later.');
  expect(fake.sent('resolve_organiser_access_request_v1')[1]).toEqual({ p_request_id: 'r0000000-0000-4000-8000-000000000002', p_decision: 'decline' });
  await expect(page.getByTestId('requests-empty')).toBeVisible();
});

const GRANT_BUG =
  'BUG: Team: after "Add as manager" the new manager is not listed under Team until a reload ' +
  '(the grant re-reads only the requests list, never organiser_home_v1). Repro: /account/o/team, ' +
  'Add as manager -> Yes on a request: the request goes, the Team card still lists 3 members.';

test.fixme('approving a request lists the new manager under Team (' + GRANT_BUG + ')', async ({ page }) => {
  await openOrganiser(page, '/account/o/team');
  await expect(page.getByTestId('team-member')).toHaveCount(3);
  await page.getByTestId('access-request').filter({ hasText: 'maria.k@example.com' }).getByTestId('request-grant').click();
  await page.getByTestId('request-grant-confirm-yes').click();
  await expect(page.getByTestId('team-confirmation')).toContainText('maria.k@example.com can now edit');
  await expect(page.getByTestId('team-member')).toHaveCount(4);
  await expect(page.getByTestId('team-member').filter({ hasText: 'maria.k@example.com' })).toHaveAttribute('data-role', 'manager');
});

test('a refused answer reads as plain words and keeps the request', async ({ page }) => {
  await openOrganiser(page, '/account/o/team', {}, (f) => f.refuse('resolve_organiser_access_request_v1', 'request_not_open'));
  await page.getByTestId('request-decline').first().click();
  await expect(page.getByTestId('request-error')).toHaveText('That request was already answered. Reload the page.');
  await expect(page.getByTestId('access-request')).toHaveCount(2);
});

test('an owner removes a manager after the confirm', async ({ page }) => {
  const fake = await openOrganiser(page, '/account/o/team');
  await page.getByTestId('team-member').filter({ hasText: 'Ana M.' }).getByTestId('member-remove').click();
  await expect(page.getByTestId('member-confirm')).toContainText('Remove Ana M.? They will no longer see or edit these events.');
  await page.getByTestId('member-confirm-yes').click();
  await expect(page.getByTestId('team-confirmation')).toHaveText('Ana M. no longer has access.');
  expect(fake.sent('remove_organiser_member_v1')).toEqual([{ p_organiser_id: ORG, p_user_id: '33333333-3333-4333-8333-333333333333' }]);
  await expect(page.getByTestId('team-member')).toHaveCount(2);
});

test('a manager sees the requests but Add and Decline are off, with the reason', async ({ page }) => {
  await openOrganiser(page, '/account/o/team', {}, (f) => { f.organisers[0].role = 'manager'; });
  await expect(page.getByTestId('request-grant').first()).toBeDisabled();
  await expect(page.getByTestId('request-decline').first()).toBeDisabled();
  await expect(page.getByTestId('requests-owner-only').first()).toHaveText('Only an owner can add or decline people.');
});
