import { test, expect } from '@playwright/test';
import { PHONE, expectNoHorizontalScroll, openOrganiser } from './helpers/organiserFake';

// W4a fix 3 r2 (R2-1) walk at 390x844 on the organiser fake: More's Leave for a MANAGER follows
// canLeave. Not in the test:e2e gate list (a walk, like walk-p3-w3b1.spec.ts).

test.use({ viewport: PHONE });

test('sole manager of an ownerless page: Leave disabled, says why with Message us, no sheet, nothing sent', async ({ page }) => {
  const fake = await openOrganiser(page, '/account/o/more', {}, (f) => {
    const o = f.organisers[0];
    o.role = 'manager';
    o.team = o.team.filter((m) => m.user_id === o.team[0].user_id).map((m) => ({ ...m, member_role: 'manager' as const, is_primary: false }));
  });
  const leave = page.getByTestId('more-leave');
  await expect(leave).toHaveAttribute('aria-disabled', 'true');
  const why = page.getByTestId('more-leave-reason');
  await expect(why).toContainText('You are the only one running this page');
  await expect(why.getByRole('link', { name: 'Message us' })).toBeVisible();
  // Playwright refuses to click an aria-disabled control, so dispatch the tap the way a finger would.
  await leave.dispatchEvent('click');
  await expect(page.getByTestId('more-leave-sheet')).toHaveCount(0);
  expect(fake.sent('remove_organiser_member_v1')).toHaveLength(0);
  await expectNoHorizontalScroll(page);
});

test('manager on an owned page: the Leave sheet opens inside 390x844 without scrolling the page, and leaves once', async ({ page }) => {
  const fake = await openOrganiser(page, '/account/o/more', {}, (f) => {
    const o = f.organisers[0];
    o.role = 'manager';
    o.team = o.team.map((m, i) => (i === 0 ? { ...m, member_role: 'manager' as const, is_primary: false } : m));
  });
  const leave = page.getByTestId('more-leave');
  await expect(leave).not.toHaveAttribute('aria-disabled', 'true');
  const before = await page.evaluate(() => window.scrollY);
  await leave.click();
  const sheet = page.getByTestId('more-leave-sheet');
  await expect(page.getByTestId('more-leave-yes')).toBeVisible();
  // Polled: the sheet slides in, so its first box can still be below the fold.
  await expect.poll(async () => {
    const b = (await sheet.boundingBox())!;
    return b.x >= 0 && b.y >= 0 && b.x + b.width <= PHONE.width + 0.5 && b.y + b.height <= PHONE.height + 0.5;
  }).toBe(true);
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
  await page.screenshot({ path: 'test-results/walk-r2-leave-sheet.png' });
  await page.getByTestId('more-leave-yes').click();
  await expect(page.getByTestId('org-done-message')).toHaveText(/You left/);
  expect(fake.sent('remove_organiser_member_v1')).toHaveLength(1);
});
