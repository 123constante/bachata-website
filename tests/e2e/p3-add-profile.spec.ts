import { test, expect, type Locator, type Page } from '@playwright/test';
import { ME, OrganiserFake, PHONE, expectNoHorizontalScroll, json } from './helpers/organiserFake';

// Slice 1c: the Switch page's "Add a profile" card at 390x844 with a FLOWING clock, on the real app over the
// route-mocked organiser fake (one organiser page). Runs only with the P3 flags, as the other test:e2e:p3 walks do:
//   VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true \
//     npx playwright test tests/e2e/p3-add-profile.spec.ts --project=chromium
// Shape: dancer + organiser (6 accounts on prod, 2026-11-09 survey): the card offers Teacher and DJ.
// Asserts: the card and the Hidden toast sit inside the viewport and a tap reaches Undo (the toast once drew BEHIND
// the P3 frame); Not now does not scroll the page; every focus() passes preventScroll; no sideways scroll; rows 56 px.

const P3_ON = process.env.VITE_ENABLE_ORGANISER_P3 === 'true';
const SHOTS = process.env.ADD_PROFILE_SHOTS; // a folder: screenshots for the PR

type Box = { x: number; y: number; width: number; height: number };
async function inView(el: Locator, what: string) {
  const b = (await el.boundingBox()) as Box | null;
  expect(b, `${what} has a box`).not.toBeNull();
  expect(b!.x, `${what} left`).toBeGreaterThanOrEqual(0);
  expect(b!.y, `${what} top`).toBeGreaterThanOrEqual(0);
  expect(b!.x + b!.width, `${what} right`).toBeLessThanOrEqual(PHONE.width + 0.5);
  expect(b!.y + b!.height, `${what} bottom`).toBeLessThanOrEqual(PHONE.height + 0.5);
}
const scrolls = (page: Page) => page.evaluate(() => [window.scrollY, document.querySelector('.p3-main')?.scrollTop ?? 0]);

async function open(page: Page, scheme: 'light' | 'dark') {
  await page.emulateMedia({ colorScheme: scheme });
  await page.clock.install({ time: new Date('2026-10-30T18:30:00Z') });
  await new OrganiserFake().install(page);
  await page.addInitScript(() => {
    const w = window as unknown as { __focus: boolean[] };
    w.__focus = [];
    const orig = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function focus(this: HTMLElement, o?: FocusOptions) {
      if (this.closest('[data-testid="add-profile-card"],[data-testid="add-profile-undo"]')) w.__focus.push(o?.preventScroll === true);
      return orig.call(this, o);
    };
  });
  const row = (role: string, active: boolean, complete = active) => ({ role, active, complete });
  await page.route('**/rest/v1/rpc/my_roles_v1*', (r) => json(r, [row('dancer', true), row('organiser', true), row('teacher', false), row('dj', false)]));
  await page.route('**/rest/v1/rpc/my_profile_progress_v1*', (r) => json(r, { percent: 100, required_left: 0, publish_ready: true, steps: [], declined: [] }));
  await page.goto('/account/p3/you/switch');
  await expect(page.getByTestId('add-profile-card')).toBeVisible();
}

test.describe('P3 Add a profile card (390x844)', () => {
  test.skip(!P3_ON, 'needs VITE_ENABLE_ORGANISER_P3=true in the dev server');
  test.use({ viewport: PHONE });

  for (const scheme of ['light', 'dark'] as const) {
    test(`${scheme}: card fits, Not now -> toast in view and tappable, Undo restores, reload keeps it hidden`, async ({ page }) => {
      await open(page, scheme);
      const card = page.getByTestId('add-profile-card');
      await expect(page.locator('[data-testid^="add-profile-row-"]')).toHaveCount(2);
      await expect(page.getByTestId('add-profile-row-teacher')).toHaveAttribute('href', '/account/t');
      await expect(page.getByTestId('add-profile-row-dj')).toHaveAttribute('href', '/account/dj');
      await card.scrollIntoViewIfNeeded();
      await page.clock.runFor(1000);
      await inView(card, 'add card');
      for (const id of ['add-profile-row-teacher', 'add-profile-row-dj']) {
        const b = (await page.getByTestId(id).boundingBox())!;
        expect(b.height, `${id} is at least 56 px`).toBeGreaterThanOrEqual(56);
      }
      expect((await page.getByTestId('add-profile-not-now').boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await expectNoHorizontalScroll(page);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/add-profile-${scheme}.png` });

      const before = await scrolls(page);
      await page.getByTestId('add-profile-not-now').click();
      const toast = page.getByTestId('add-profile-undo');
      await expect(toast).toContainText('Hidden. We will remember this.');
      await page.clock.runFor(1000);
      await inView(toast, 'Hidden toast');
      const undo = page.getByTestId('add-profile-undo-button');
      const hit = await undo.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const top = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
        return top === el || el.contains(top);
      });
      expect(hit, 'a tap on Undo reaches it (nothing drawn over the toast)').toBe(true);
      expect((await undo.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await expectNoHorizontalScroll(page);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/add-profile-toast-${scheme}.png` });
      const after = await scrolls(page);
      expect(after[0], 'Not now did not scroll the window').toBe(before[0]);

      await undo.click();
      await expect(card).toBeVisible();
      const focus = await page.evaluate(() => (window as unknown as { __focus: boolean[] }).__focus);
      expect(focus.length, 'Undo moved focus into the toast and back to the card').toBeGreaterThan(0);
      expect(focus.every(Boolean), 'every focus() passes preventScroll').toBe(true);

      await page.getByTestId('add-profile-not-now').click();
      expect(await page.evaluate((id) => window.localStorage.getItem(`bc.addProfile.hidden.${id}`), ME)).toBe('1');
      await page.reload();
      await expect(page.getByTestId('switch-row').first()).toBeVisible();
      await page.clock.runFor(1000);
      await expect(page.getByTestId('add-profile-card')).toHaveCount(0);
    });
  }
});
