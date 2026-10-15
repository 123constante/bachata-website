import { test, expect, type Page } from '@playwright/test';
import { PHONE, OrganiserFake, expectNoHorizontalScroll, json } from '../helpers/organiserFake';

// /app/options in a real browser at 390x844: the gate and my_dancer_edit_v1 are mocked at the
// network layer (as reachability.spec.ts does). Screenshots land in the handover folder.

const SHOTS = 'docs/handover/dancer-rebuild-w2e';

const PROFILE = (otherRoles: string[]) => ({
  profile_id: 'b1000000-0000-4000-8000-000000000001',
  user_id: 'a1000000-0000-4000-8000-000000000001',
  display_name: 'Ana', first_name: 'Ana', surname: null, hide_surname_publicly: false,
  based_city_id: 'c1000000-0000-4000-8000-000000000001', city_name: 'London', dance_role: 'Follower',
  nationality: null, languages: [], bio: null, instagram: null, facebook: null, website_url: null,
  whatsapp: null, show_whatsapp_publicly: true, avatar_url: 'https://img.example/x.jpg',
  dance_started_year: null, favorite_styles: [], favorite_songs: [], achievements: [],
  other_roles: otherRoles, is_active: true, erase_requested_at: null, linked_from_admin: false,
  complete: true, strength: { pct: 70, next_step: 'started_year', missing: ['started_year', 'styles', 'bio_social'] },
});

async function open(page: Page, otherRoles: string[]) {
  const fake = new OrganiserFake({ noOrganiser: true });
  await fake.install(page);
  await page.route('**/rest/v1/rpc/dancer_area_gate_v1', (r) => json(r, { open: true, allowed: true }));
  await page.route('**/rest/v1/rpc/my_dancer_edit_v1', (r) => json(r, PROFILE(otherRoles)));
  await page.goto('/app/options');
  await expect(page.getByTestId('opt-share')).toBeVisible();
}

test.describe('dancer app options 390x844', () => {
  test.use({ viewport: PHONE });

  test('pure dancer: rows, disabled reasons, no horizontal scroll', async ({ page }) => {
    await open(page, []);
    await expect(page.getByTestId('opt-switch-organiser')).toBeDisabled();
    await expect(page.getByTestId('opt-why-switch-organiser')).toContainText('not on your account');
    await expect(page.getByTestId('opt-terms')).toBeDisabled();
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: `${SHOTS}/options.png` });
  });

  test('dancer + organising: "I run events" goes to /account/o', async ({ page }) => {
    await open(page, ['organising']);
    await expect(page.getByTestId('opt-switch-organiser')).toHaveText('I run events');
  });

  test('install and sign-out sheets', async ({ page }) => {
    await open(page, []);
    await page.getByTestId('opt-install').click();
    await expect(page.getByTestId('opt-install-sheet')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/install-sheet.png` });
    await page.getByRole('button', { name: 'Close' }).click();
    await page.getByTestId('opt-sign-out').click();
    await expect(page.getByTestId('opt-signout-sheet')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/signout-sheet.png` });
  });
});
