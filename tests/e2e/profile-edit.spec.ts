/**
 * Profile edit — Dancer + Organiser profile field updates round-trip.
 *
 * Reference: ~/.claude/plans/repo-bachata-admin-11april-phases-0-3-adaptive-pebble.md
 * (section 4.E — E2E coverage backfill. Phase 4.D consolidated dancer/organiser
 * RLS policies; this spec is the regression gate ensuring authenticated users
 * can still update their own profile rows after policy collapse.)
 *
 * TODO (human, before un-fixme'ing):
 *   1. Provide signed-in storage state for two roles:
 *        - tests/e2e/.auth/dancer.json   (sb-…-auth-token in localStorage)
 *        - tests/e2e/.auth/organiser.json
 *      OR adopt the init-script pattern from dancer-dashboard-concept-b-smoke.spec.ts
 *      (look at setupMockAuth there).
 *   2. Confirm the dancer profile route. Current candidates:
 *        - /profile/dancer
 *        - /dancers/:id/edit
 *        - /account
 *      Update DANCER_PROFILE_PATH below.
 *   3. Confirm the organiser profile route. Current candidates:
 *        - /organiser/profile
 *        - /organisers/:id/edit
 *      Update ORGANISER_PROFILE_PATH below.
 *   4. Confirm field selectors (data-testid preferred):
 *        - data-testid='profile-bio-input'
 *        - data-testid='profile-instagram-input'
 *        - data-testid='profile-save-button'
 *      Adjust if the actual testids differ.
 *   5. Decide on cleanup: either restore prior values in afterEach, or accept
 *      that the seed dancer/organiser is throw-away and let writes accumulate.
 *   6. Confirm the toast text on save (currently /saved|updated/i).
 */

import { test, expect } from '@playwright/test';

const DANCER_PROFILE_PATH = '/profile/dancer'; // TODO: confirm route
const ORGANISER_PROFILE_PATH = '/organiser/profile'; // TODO: confirm route
const BASE = 'http://127.0.0.1:4173';

test.describe('dancer profile edit', () => {
  test.fixme('dancer can update bio and persist across reload', async ({ page }) => {
    // Golden path:
    // 1. Sign in as dancer (storageState).
    // 2. Navigate to DANCER_PROFILE_PATH.
    // 3. Fill data-testid='profile-bio-input' with a timestamped string.
    // 4. Click data-testid='profile-save-button'.
    // 5. Expect /saved|updated/i toast.
    // 6. Reload page; verify the bio input still has the new value.
    const newBio = `PW dancer bio ${Date.now()}`;
    await page.goto(`${BASE}${DANCER_PROFILE_PATH}`);
    const bio = page.getByTestId('profile-bio-input');
    await bio.fill(newBio);
    await page.getByTestId('profile-save-button').click();
    await expect(page.getByText(/saved|updated/i)).toBeVisible();
    await page.reload();
    await expect(bio).toHaveValue(newBio);
  });

  test.fixme('dancer can update instagram handle and persist', async ({ page }) => {
    // 1. Sign in as dancer.
    // 2. Navigate to DANCER_PROFILE_PATH.
    // 3. Fill data-testid='profile-instagram-input' with '@pw_dancer_<ts>'.
    // 4. Save and assert toast.
    // 5. Reload and verify persisted value.
    const handle = `@pw_dancer_${Date.now()}`;
    await page.goto(`${BASE}${DANCER_PROFILE_PATH}`);
    await page.getByTestId('profile-instagram-input').fill(handle);
    await page.getByTestId('profile-save-button').click();
    await expect(page.getByText(/saved|updated/i)).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('profile-instagram-input')).toHaveValue(handle);
  });

  test.fixme('dancer cannot edit another dancer profile (RLS gate)', async ({ page }) => {
    // Edge case — verifies Phase 4.D's consolidated dancer UPDATE policy still
    // restricts WITH CHECK to user_id = auth.uid().
    // 1. Sign in as dancer A.
    // 2. Navigate to /dancers/<dancer-B-id>/edit (or whatever the public route is).
    // 3. Either:
    //      a) the page redirects away / shows a "not yours" message, OR
    //      b) the save button is disabled.
    // 4. If a save attempt is made, expect a 403/permission error from the RPC.
    await page.goto(`${BASE}/dancers/00000000-0000-0000-0000-000000000bbb/edit`);
    await expect(page.getByText(/not authorised|cannot edit|forbidden/i)).toBeVisible();
  });
});

test.describe('organiser profile edit', () => {
  test.fixme('organiser can update display name and persist', async ({ page }) => {
    // Golden path for organiser:
    // 1. Sign in as organiser (storageState).
    // 2. Navigate to ORGANISER_PROFILE_PATH.
    // 3. Fill data-testid='organiser-name-input' with timestamped value.
    // 4. Save; assert toast.
    // 5. Reload and verify.
    // 6. Bonus: hit /organisers/:id and verify the public listing reflects
    //    the new name (bypasses cache via cache-busting query string if needed).
    const newName = `PW Organiser ${Date.now()}`;
    await page.goto(`${BASE}${ORGANISER_PROFILE_PATH}`);
    await page.getByTestId('organiser-name-input').fill(newName);
    await page.getByTestId('profile-save-button').click();
    await expect(page.getByText(/saved|updated/i)).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('organiser-name-input')).toHaveValue(newName);
  });
});
