import { test, expect, type Page } from '@playwright/test';
import { PHONE, OrganiserFake, expectNoHorizontalScroll, json } from '../helpers/organiserFake';

// Layout C slice S2 walk at 390x844 (brief dancer-layout-c-s2). Needs the dev server built with
// VITE_ENABLE_DANCER_LAYOUT_C=true; skipped otherwise. Gate + my_dancer_edit_v1 mocked as options.spec.ts does.
const SHOTS = process.env.LAYOUT_C_SHOTS || 'test-results/layout-c';
const ON = process.env.VITE_ENABLE_DANCER_LAYOUT_C === 'true';

const PROFILE = (over: Record<string, unknown> = {}) => ({
  profile_id: 'b1000000-0000-4000-8000-000000000001',
  user_id: 'a1000000-0000-4000-8000-000000000001',
  display_name: 'Ana', first_name: 'Ana', surname: null, hide_surname_publicly: false,
  based_city_id: 'c1000000-0000-4000-8000-000000000001', city_name: 'London', dance_role: 'Follower',
  nationality: null, languages: [], bio: null, instagram: null, facebook: null, website_url: null,
  whatsapp: null, show_whatsapp_publicly: true, avatar_url: null,
  dance_started_year: null, favorite_styles: [], favorite_songs: [], achievements: [],
  other_roles: [], is_active: true, erase_requested_at: null, linked_from_admin: false,
  complete: true, strength: { pct: 70, next_step: 'started_year', missing: ['started_year', 'styles', 'bio_social'] },
  ...over,
});

async function open(page: Page, path: string, over: Record<string, unknown> = {}) {
  const fake = new OrganiserFake({ noOrganiser: true });
  await fake.install(page);
  await page.route('**/rest/v1/rpc/dancer_area_gate_v1', (r) => json(r, { open: true, allowed: true }));
  await page.route('**/rest/v1/rpc/my_dancer_edit_v1', (r) => json(r, PROFILE(over)));
  await page.goto(path);
}

test.describe('dancer layout C shell + Me 390x844', () => {
  test.skip(!ON, 'needs VITE_ENABLE_DANCER_LAYOUT_C=true');
  test.use({ viewport: PHONE });

  test('three tabs, Me with Settings, no Sign out, no horizontal scroll', async ({ page }) => {
    await open(page, '/app/me');
    await expect(page.getByTestId('me-settings')).toBeVisible();
    await expect(page.locator('[data-testid^="dancer-app-tab-"]')).toHaveCount(3);
    await expect(page.getByText('Sign out')).toHaveCount(0);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: `${SHOTS}/me-top.png` });
    await page.getByTestId('me-back-to-site').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/me-bottom.png` });
    // Last row is not under the tab bar.
    const back = await page.getByTestId('me-back-to-site').boundingBox();
    const tabs = await page.getByTestId('dancer-app-tabs').boundingBox();
    expect(back!.y + back!.height).toBeLessThanOrEqual(tabs!.y + 1);
    for (const id of ['me-set-account', 'me-set-areas', 'me-set-terms', 'dancer-app-tab-me']) {
      const b = await page.getByTestId(id).boundingBox();
      expect(b!.height).toBeGreaterThanOrEqual(44);
    }
    await page.getByTestId('me-set-install').click();
    await expect(page.getByTestId('opt-install-sheet')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/me-install-sheet.png` });
  });

  test('/app/options -> /app/me, /app/tickets -> /app/home', async ({ page }) => {
    await open(page, '/app/options');
    await expect(page).toHaveURL(/\/app\/me$/);
    await page.goto('/app/tickets');
    await expect(page).toHaveURL(/\/app\/home$/);
  });

  test('organiser + hidden profile shapes', async ({ page }) => {
    await open(page, '/app/me', { other_roles: ['organising'], is_active: false });
    await expect(page.getByTestId('me-set-switch-organiser')).toContainText('I run events');
    await expect(page.getByTestId('me-public-page-reason')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/me-organiser-hidden.png`, fullPage: true });
  });
});
