import { test, expect, type Page } from '@playwright/test';
import { CITY, PHONE, OrganiserFake, expectNoHorizontalScroll, json } from './helpers/organiserFake';

// The dancer home (/account) and Finish your profile (/finish-profile) in a real browser at
// 390x844 and a short 390x600, against the organiser fake plus the dancer-profile reads
// (persona -> profile_complete_v1 -> dancer_profiles row). Shapes are the prod ones the
// unit matrix covers (DancerFirstGate.matrix.test.tsx); here: the commonest gap (no dance
// role, 153 of 166 rows), a brand-new stub, a no-organiser account, and an organiser. Every
// account page sits behind the dancer-first gate (owner decision 2026-10-11).

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

const COMPLETE: Row = { first_name: 'Ana', based_city_id: CITY.id, dance_role: 'Follower', avatar_url: 'https://img.example/ana.jpg', archived_at: null };
const STUB: Row = { first_name: null, based_city_id: null, dance_role: null, avatar_url: null, archived_at: null };
const GATE_REASON = 'Finish your dancer profile first, then you can set up your organiser page.';

/** The gated Finish screen on the way to `target`: says why, offers no Skip. */
async function expectGated(page: Page, target: string) {
  await expect(page).toHaveURL(new RegExp(`/finish-profile\\?returnTo=${encodeURIComponent(target).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
  await expect(page.getByTestId('finish-profile-gate-reason')).toHaveText(GATE_REASON);
  await expect(page.getByRole('button', { name: /Skip for now/ })).toHaveCount(0);
  await expect(page.getByTestId('org-page-home')).toHaveCount(0);
  await expect(page.getByTestId('dancer-home')).toHaveCount(0);
}

for (const viewport of [PHONE, SHORT]) {
  test.describe(`${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test('an unfinished dancer profile: /account is the gated Finish screen', async ({ page }) => {
      await openDancer(page, '/account');
      await expectGated(page, '/account');
      await expect(page.getByText('Still to add: dance role.')).toBeVisible();
      await expect(page.getByRole('radiogroup')).toBeVisible();
      await page.waitForTimeout(400);
      expect(await shortControls(page, 'main form')).toEqual([]);
      await expectNoHorizontalScroll(page);
      expect(await backgroundSources(page)).toHaveLength(1);
      await page.screenshot({ path: `test-results/dancer-gate-${viewport.height}.png`, fullPage: false });
    });

    test('a finished dancer gets the dancer home', async ({ page }) => {
      await openDancer(page, '/account', { row: { ...COMPLETE } });
      await expect(page).toHaveURL(/\/account$/);
      await expect(page.getByTestId('dancer-home-completeness')).toHaveText('Your profile is complete. You can rate parties now.');
      await expect(page.getByTestId('dancer-home-name')).toHaveText('Ana');
      await expect(page.getByTestId('dancer-home-details')).toContainText('London');
      await expect(page.getByRole('link', { name: /My attendance/ })).toHaveAttribute('href', '/account/attendance');
      await expect(page.getByTestId('dancer-home-organise-toggle')).toHaveAttribute('aria-expanded', 'false');
      await page.waitForTimeout(400);
      expect(await shortControls(page, '[data-testid="dancer-home"]')).toEqual([]);
      await expectNoHorizontalScroll(page);
      expect(await backgroundSources(page)).toHaveLength(1);
      await page.screenshot({ path: `test-results/dancer-home-${viewport.height}.png`, fullPage: false });
    });

    test('/finish-profile has one background all the way down', async ({ page }) => {
      await openDancer(page, '/finish-profile?returnTo=%2Fevent%2Fe1');
      await expect(page.getByRole('heading', { name: 'Finish your profile' })).toBeVisible();
      await expect(page.getByRole('radiogroup')).toBeVisible();
      // Not gated (the rating card's way in): Skip stays.
      await expect(page.getByRole('button', { name: 'Skip for now' })).toBeVisible();
      await page.waitForTimeout(400);
      expect(await backgroundSources(page)).toHaveLength(1);
      await expectNoHorizontalScroll(page);
      await page.screenshot({ path: `test-results/finish-profile-${viewport.height}.png`, fullPage: false });
    });
  });
}

test.describe('flows @390', () => {
  test.use({ viewport: PHONE });

  test('gated dancer: untouched sends nothing; a save lands on the dancer home, complete', async ({ page }) => {
    const { saves } = await openDancer(page, '/account');
    await expectGated(page, '/account');
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
    await expect(page.getByText('Fill in at least one field above to save.')).toBeVisible();
    expect(saves).toEqual([]);
    await page.getByRole('radio', { name: /Leader/ }).first().click();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByTestId('dancer-home-completeness')).toHaveText('Your profile is complete. You can rate parties now.');
    expect(saves).toHaveLength(1);
  });

  test('"I organise events" opens the unchanged onboarding', async ({ page }) => {
    await openDancer(page, '/account', { row: { ...COMPLETE } });
    await page.getByTestId('dancer-home-organise-toggle').click();
    await expect(page.getByTestId('org-onboarding')).toBeVisible();
    await page.getByTestId('onboarding-search').fill('Ritmo');
    await expect(page.getByTestId('onboarding-result')).toHaveCount(2);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: 'test-results/dancer-home-organise.png', fullPage: false });
  });

  test('an organiser tapping the account icon lands on the organiser home', async ({ page }) => {
    await openDancer(page, '/vendors/header-account-probe', { organiser: true, row: { ...COMPLETE } });
    await page.getByTestId('header-account-link').click();
    await expect(page).toHaveURL(/\/account\/o$/);
    await expect(page.getByTestId('org-page-home')).toBeVisible();
  });

  // Dancer first, then organiser (owner decision 2026-10-11): no skippable row any more.
  test('unfinished organiser hitting /account/o: the gate, then back on the organiser home', async ({ page }) => {
    const { saves } = await openDancer(page, '/account/o', { organiser: true });
    await expectGated(page, '/account/o');
    await page.waitForTimeout(400); // the page transition's slide-in
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: 'test-results/organiser-dancer-gate.png', fullPage: false });
    await page.getByRole('radio', { name: /Follower/ }).first().click();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/account\/o$/);
    await expect(page.getByTestId('org-page-home')).toBeVisible();
    await expect(page.getByTestId('org-dancer-row')).toHaveCount(0);
    await expect(page.getByTestId('profile-switcher-button')).toBeVisible();
    expect(saves).toHaveLength(1);
  });

  test('a deep organiser link keeps its whole address through the gate', async ({ page }) => {
    await openDancer(page, '/account/o/team', { organiser: true });
    await expectGated(page, '/account/o/team');
  });

  test('organiser with a finished dancer profile: never gated; the Switch-profile sheet opens the dancer profile', async ({ page }) => {
    await openDancer(page, '/account/o', { organiser: true, row: { ...COMPLETE } });
    await expect(page.getByTestId('profile-switcher-button')).toBeVisible();
    await expect(page).toHaveURL(/\/account\/o$/);
    await expect(page.getByTestId('org-dancer-row')).toHaveCount(0);
    await page.getByTestId('profile-switcher-button').click();
    await expect(page.getByTestId('profile-switcher-sheet')).toBeVisible();
    await page.screenshot({ path: 'test-results/organiser-home-account-menu.png', fullPage: false });
    await page.getByTestId('profile-switcher-side-dancer').click();
    await expect(page).toHaveURL(/\/account\/dancer$/);
    await expect(page.getByTestId('dancer-home-completeness')).toHaveText('Your profile is complete. You can rate parties now.');
    await expect(page.getByTestId('dancer-home-organiser-link')).toBeVisible();
    await page.waitForTimeout(400); // the page transition's slide-in
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: 'test-results/dancer-profile-for-organiser.png', fullPage: false });
  });

  test('a brand-new account: the account icon goes to the gate, asking all four fields', async ({ page }) => {
    await openDancer(page, '/vendors/header-account-probe', { row: { ...STUB } });
    await page.getByTestId('header-account-link').click();
    await expectGated(page, '/account');
    await expect(page.getByText('Still to add: first name, city, dance role, photo.')).toBeVisible();
    await expect(page.getByLabel('First name')).toBeVisible();
    await expect(page.getByRole('radiogroup')).toBeVisible();
    await expect(page.getByText('Your city', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Photo', { exact: true })).toBeVisible();
    // A part-save keeps them on the gate, naming what is left.
    await page.getByLabel('First name').fill('Sam');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved. Still to add: city, dance role, photo.')).toBeVisible();
    await expect(page).toHaveURL(/\/finish-profile\?returnTo=%2Faccount$/);
    await page.waitForTimeout(400);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: 'test-results/new-account-gate.png', fullPage: false });
  });

  test('public pages stay open with an unfinished profile', async ({ page }) => {
    await openDancer(page, '/vendors/header-account-probe', { row: { ...STUB } });
    await expect(page).toHaveURL(/\/vendors\/header-account-probe$/);
    await expect(page.getByTestId('finish-profile-gate-reason')).toHaveCount(0);
  });
});
