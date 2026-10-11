import { test, expect, type Page } from '@playwright/test';
import { CITY, PHONE, OrganiserFake, expectNoHorizontalScroll, json } from './helpers/organiserFake';

// The dancer home (/account) and Finish your profile (/finish-profile) in a real browser at
// 390x844 and a short 390x600, against the organiser fake plus the dancer-profile reads
// (persona -> profile_complete_v1 -> dancer_profiles row). Shapes are the prod ones the
// unit matrix covers (AccountDancerHome.matrix.test.tsx); here: the commonest gap (no dance
// role, 153 of 166 rows), a no-organiser account, and an organiser.

const MIN = 44;
const SHORT = { width: 390, height: 600 };

type Row = { first_name: string | null; based_city_id: string | null; dance_role: string | null; avatar_url: string | null; archived_at: string | null };
const filled = (v: string | null) => typeof v === 'string' && v.trim() !== '';
const complete = (r: Row) => filled(r.first_name) && filled(r.based_city_id) && filled(r.dance_role) && filled(r.avatar_url);

/** The organiser fake, plus a dancer row the profile reads and save_my_dancer_profile_v1 act on. */
async function openDancer(page: Page, path: string, opts: { organiser?: boolean; row?: Row } = {}) {
  const fake = new OrganiserFake({ noOrganiser: !opts.organiser });
  const row: Row = opts.row ?? { first_name: 'Ana', based_city_id: CITY.id, dance_role: null, avatar_url: 'https://img.example/ana.jpg', archived_at: null };
  const saves: unknown[] = [];
  await fake.install(page);
  // Registered after install(), so these win for the URLs they match.
  await page.route('**/rest/v1/rpc/_my_dancer_profile_id_v1', (r) => json(r, 'persona-1'));
  await page.route('**/rest/v1/rpc/profile_complete_v1', (r) => json(r, complete(row)));
  await page.route('**/rest/v1/rpc/save_my_dancer_profile_v1', (r) => {
    const p = (r.request().postDataJSON()?.p_payload ?? {}) as Record<string, unknown>;
    saves.push(p);
    for (const k of ['first_name', 'based_city_id', 'dance_role', 'avatar_url'] as const) if (typeof p[k] === 'string' && p[k] !== '') row[k] = p[k] as string;
    return json(r, { id: 'persona-1' });
  });
  await page.route('**/rest/v1/dancer_profiles**', (r) => {
    const single = (r.request().headers()['accept'] ?? '').includes('vnd.pgrst.object');
    const out = { id: 'persona-1', ...row, city: row.based_city_id ? { name: CITY.name } : null };
    return json(r, single ? out : [out]);
  });
  await page.goto(path);
  return { fake, row, saves };
}

/** Every visible control under `root`, with its height. */
async function shortControls(page: Page, root: string) {
  return page.evaluate((sel) => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll(`${sel} a, ${sel} button, ${sel} input`))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || (el as HTMLElement).closest('[aria-hidden="true"]')) continue;
      if (r.height < 43.5) out.push(`${el.tagName}:${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)} ${r.height}`);
    }
    return out;
  }, root);
}

/**
 * What paints the page background at the left gutter, every 20px from under the header to
 * above the bottom nav. One source all the way down = no seam. The /finish-profile bug was
 * two: an opaque bg-background block 70vh tall, then GlobalLayout's wash below it.
 */
async function backgroundSources(page: Page) {
  return page.evaluate(() => {
    const out = new Set<string>();
    for (let y = 80; y < window.innerHeight - 90; y += 20) {
      const painter = document.elementsFromPoint(4, y).find((el) => {
        const cs = getComputedStyle(el);
        return cs.backgroundImage !== 'none' || !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor);
      });
      // The chrome (header, footer, bottom nav) and the sticky breadcrumb row are not the page.
      if (painter && (painter.closest('header, footer, nav') || getComputedStyle(painter).position === 'sticky')) continue;
      out.add(painter ? `${painter.tagName.toLowerCase()}.${String(painter.className).split(' ').slice(0, 3).join('.')}` : 'none');
    }
    return [...out];
  });
}

for (const viewport of [PHONE, SHORT]) {
  test.describe(`${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test('a dancer gets the dancer home, saying exactly what is missing', async ({ page }) => {
      await openDancer(page, '/account');
      await expect(page).toHaveURL(/\/account$/);
      await expect(page.getByTestId('dancer-home-completeness')).toHaveText('Add your dance role to rate parties.');
      await expect(page.getByTestId('dancer-home-name')).toHaveText('Ana');
      await expect(page.getByTestId('dancer-home-details')).toContainText('London');
      await expect(page.getByTestId('dancer-home-details')).toContainText('Dance role not set');
      await expect(page.getByRole('link', { name: 'Finish your profile' })).toHaveAttribute('href', '/finish-profile?returnTo=%2Faccount');
      await expect(page.getByRole('link', { name: /My attendance/ })).toHaveAttribute('href', '/account/attendance');
      await expect(page.getByTestId('dancer-home-organise-toggle')).toHaveAttribute('aria-expanded', 'false');
      await page.waitForTimeout(400);
      expect(await shortControls(page, '[data-testid="dancer-home"]')).toEqual([]);
      await expectNoHorizontalScroll(page);
      expect(await backgroundSources(page)).toHaveLength(1);
      await page.screenshot({ path: `test-results/dancer-home-${viewport.height}.png`, fullPage: true });
    });

    test('/finish-profile has one background all the way down', async ({ page }) => {
      await openDancer(page, '/finish-profile?returnTo=%2Faccount');
      await expect(page.getByRole('heading', { name: 'Finish your profile' })).toBeVisible();
      await expect(page.getByRole('radiogroup')).toBeVisible();
      await page.waitForTimeout(400);
      expect(await backgroundSources(page)).toHaveLength(1);
      await expectNoHorizontalScroll(page);
      await page.screenshot({ path: `test-results/finish-profile-${viewport.height}.png`, fullPage: true });
    });
  });
}

test.describe('flows @390', () => {
  test.use({ viewport: PHONE });

  test('finish from the dancer home: untouched sends nothing, a save comes back complete', async ({ page }) => {
    const { saves } = await openDancer(page, '/account');
    await page.getByRole('link', { name: 'Finish your profile' }).click();
    await expect(page).toHaveURL(/\/finish-profile\?returnTo=%2Faccount$/);
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
    await expect(page.getByText('Fill in at least one field above to save.')).toBeVisible();
    expect(saves).toEqual([]);
    await page.getByRole('radio', { name: /Leader/ }).first().click();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByTestId('dancer-home-completeness')).toHaveText('Your profile is complete. You can rate parties now.');
    await expect(page.getByTestId('dancer-home-details')).not.toContainText('Dance role not set');
    expect(saves).toHaveLength(1);
  });

  test('"I organise events" opens the unchanged onboarding', async ({ page }) => {
    await openDancer(page, '/account');
    await page.getByTestId('dancer-home-organise-toggle').click();
    await expect(page.getByTestId('org-onboarding')).toBeVisible();
    await page.getByTestId('onboarding-search').fill('Ritmo');
    await expect(page.getByTestId('onboarding-result')).toHaveCount(2);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: 'test-results/dancer-home-organise.png', fullPage: true });
  });

  test('an organiser tapping the account icon lands on the organiser home', async ({ page }) => {
    await openDancer(page, '/vendors/header-account-probe', { organiser: true });
    await page.getByTestId('header-account-link').click();
    await expect(page).toHaveURL(/\/account\/o$/);
    await expect(page.getByTestId('org-page-home')).toBeVisible();
  });

  test('a dancer tapping the account icon lands on the dancer home', async ({ page }) => {
    await openDancer(page, '/vendors/header-account-probe');
    await page.getByTestId('header-account-link').click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByTestId('dancer-home')).toBeVisible();
  });
});
