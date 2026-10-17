import { test, expect } from '@playwright/test';
import { PHONE, openOrganiser } from './helpers/organiserFake';

// Every R1 screen at 390x844 (R1-PLAN 4.11): every visible interactive element is at least
// 44px tall and 44px wide (owner rule; the site's ~13.5px root font makes rem sizes run
// small, so this is measured, not read off the classes). Backend: helpers/organiserFake.ts.
//
// ONE exemption, open for the owner (no D-number yet): the edit-in-place hero's compact
// pencils on /page are 32 wide x 44 high by design (edit-in-place/parts.tsx pencilCompact,
// shared with the public event page). They are let through on width only, never on height.

test.use({ viewport: PHONE });

const SCREENS = [
  '/account/o',
  '/account/o/switch',
  '/account/o/change',
  '/account/o/add',
  '/account/o/cancel',
  '/account/o/new/what',
  '/account/o/events',
  '/account/o/team',
  '/account/o/team/add',
  '/account/o/page',
  '/account/o/more',
  '/account/o/more/help',
];

for (const path of SCREENS) {
  test(`${path}: every control is at least 44x44`, async ({ page }) => {
    await openOrganiser(page, path);
    const content = page.getByTestId('org-content');
    await expect(content).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-testid$="-loading"]')).toHaveCount(0, { timeout: 15_000 });
    const small = await page
      .locator('[data-testid^="org-page-"] :is(button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="switch"])')
      .evaluateAll((els) =>
        els
          .filter((e) => (e as HTMLElement).offsetParent !== null)
          .map((e) => ({ e, id: e.getAttribute('data-testid') ?? e.getAttribute('aria-label') ?? e.textContent?.trim().slice(0, 30), r: e.getBoundingClientRect() }))
          .filter(({ e, r }) => r.height < 44 || (r.width < 44 && !(e.classList.contains('eip-pencil') && r.width >= 32)))
          .map(({ id, r }) => `${id} ${Math.round(r.width)}x${Math.round(r.height)}`),
      );
    expect(small).toEqual([]);
  });
}
