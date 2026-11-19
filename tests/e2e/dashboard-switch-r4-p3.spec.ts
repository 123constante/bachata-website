import { test, expect, type Page } from '@playwright/test';
import { OrganiserFake, PHONE, expectNoHorizontalScroll, json } from './helpers/organiserFake';

// Dashboard switch, Round-4 everywhere -- the P3 / R4 organiser area part (runs in test:e2e:p3 with VITE_ENABLE_ORGANISER_P3=true).
// Dashboard switch, Round-4 everywhere (docs/briefs/dashboard-switch-build.md) at 390x844 on the real app over the
// route-mocked organiser fake. Flag OFF (the CI default) asserts today's screens are unchanged; flag ON asserts the
// new look. Shots for the PR: DASH_SWITCH_SHOTS=<folder> (before-* with the flag off, after-* with it on):
//   VITE_ENABLE_DASHBOARD_SWITCH_R4=true VITE_ENABLE_ORGANISER_P3=true npx playwright test tests/e2e/dashboard-switch-r4-p3.spec.ts
// Shapes (prod, 2026-11-19): one organiser page is the common case (20 of 22 organisers); a dancer + organiser
// account; Teacher picked at sign-up (10 accounts) vs Teacher merely held (127 active teaching roles).

const ON = process.env.VITE_ENABLE_DASHBOARD_SWITCH_R4 === 'true';
const P3_ON = process.env.VITE_ENABLE_ORGANISER_P3 === 'true';
const SHOTS = process.env.DASH_SWITCH_SHOTS;
const shot = async (page: Page, name: string, fullPage = false) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${ON ? 'after' : 'before'}-${name}.png`, fullPage });
};
const row = (role: string, active: boolean) => ({ role, active, complete: active });

async function fake(page: Page, opts: { organiser: boolean; picked: string[] }) {
  await new OrganiserFake({ noOrganiser: !opts.organiser, dancerProfile: 'complete' }).install(page);
  // Teacher HELD (active role) in every shape: with the flag on it must not show unless also picked.
  await page.route('**/rest/v1/rpc/my_roles_v1*', (r) => json(r, [row('dancer', true), row('organiser', opts.organiser), row('teacher', true), row('dj', false)]));
  await page.route('**/rest/v1/rpc/my_role_intent_v1*', (r) => json(r, { roles: ['dancer', ...opts.picked], declined: [] }));
  await page.route('**/rest/v1/rpc/my_profile_progress_v1*', (r) => json(r, { percent: 100, required_left: 0, publish_ready: true, steps: [{ area: 'teacher', field: 'teaching_styles', required: true, done: true }], declined: [] }));
  await page.route('**/rest/v1/rpc/dancer_area_gate_v1*', (r) => json(r, { open: false, allowed: true }));
}

test.describe('dashboard switch, P3 area 390x844', () => {
  test.use({ viewport: PHONE });

  test('R4 organiser header and sheet', async ({ page }) => {
    test.skip(!P3_ON, 'needs VITE_ENABLE_ORGANISER_P3=true (the P3 walks run it)');
    await fake(page, { organiser: true, picked: [] });
    await page.goto('/account/p3');
    await expect(page.getByTestId('r4-header')).toBeVisible();
    const btn = page.getByTestId('profile-switcher-button');
    if (!ON) {
      // Today the Round-4 organiser header has no Switch profile sheet (only the page name, which opens Switch page).
      await expect(btn).toHaveCount(0);
      await shot(page, 'organiser-header');
      return;
    }
    await expect(btn).toBeVisible();
    await shot(page, 'organiser-header');
    await btn.click();
    await expect(page.getByTestId('profile-switcher-sheet')).toHaveAttribute('data-look', 'r4');
    await expect(page.getByTestId('profile-switcher-add')).toBeVisible();
    await expect(page.getByTestId('profile-switcher-your-areas')).toBeVisible();
    await expect(page.getByTestId('profile-switcher-sign-out')).toHaveCount(0);
    await shot(page, 'organiser-sheet');
    await expectNoHorizontalScroll(page);
  });

  test('organiser Switch page (P3 area)', async ({ page }) => {
    test.skip(!P3_ON, 'needs VITE_ENABLE_ORGANISER_P3=true (the P3 walks run it)');
    await fake(page, { organiser: true, picked: ['teacher'] });
    await page.goto('/account/p3/you/switch');
    await expect(page.getByTestId('switch-list')).toBeVisible();
    await expect(page.getByTestId('switch-add-page')).toBeVisible();
    if (ON) {
      await expect(page.getByTestId('switch-soon-teacher')).toBeVisible();
      await expect(page.getByTestId('switch-area-teacher')).toHaveCount(0);
      await expect(page.getByTestId('add-profile-card')).toHaveCount(0);
    } else {
      await expect(page.getByTestId('switch-area-teacher')).toBeVisible();
    }
    await shot(page, 'switch-page');
    await expectNoHorizontalScroll(page);
  });
});
