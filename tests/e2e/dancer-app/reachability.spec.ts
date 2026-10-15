import { test, expect, type Page } from '@playwright/test';
import { PHONE, OrganiserFake, expectNoHorizontalScroll, json, refuse } from '../helpers/organiserFake';
import { DANCER_SHAPES } from '../../../src/modules/dancer-app/api/fixtures';

// The dancer app (/app/*, W1 foundation: shell + placeholder screens) in a real browser at
// 390x844, against the organiser fake (session + every REST call) with the dancer-area gate
// mocked at the network layer (page.route on the dancer_area_gate_v1 RPC URL). Wave 2 walks
// the real screens; this spec proves every route is reachable inside the shell, the gate
// fails closed, and NO gate request is ever made for a signed-out visitor.

const GATE = '**/rest/v1/rpc/dancer_area_gate_v1';
const ROUTES = [
  ['/app/welcome', 'welcome'],
  ['/app/home', 'home'],
  ['/app/nights', 'nights'],
  ['/app/me', 'me'],
  ['/app/me/edit', 'edit'],
  ['/app/me/photo', 'photo'],
  ['/app/options', 'options'],
] as const;

type Gate = { open: boolean; allowed: boolean } | 'error';

/** The fake, plus the gate answer; returns the list of gate requests the browser made. */
async function open(page: Page, path: string, opts: { gate?: Gate; signedOut?: boolean } = {}) {
  const fake = new OrganiserFake({ noOrganiser: true, signedOut: opts.signedOut });
  const gateHits: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/rpc/dancer_area_gate_v1')) gateHits.push(r.url());
  });
  await fake.install(page);
  // Registered after install(), so it wins for the gate URL.
  await page.route(GATE, (route) => {
    const g = opts.gate ?? { open: false, allowed: true };
    return g === 'error' ? refuse(route, 'boom') : json(route, g);
  });
  // Wave 2 replaced the placeholders: Me and Edit read the own profile (a complete one here).
  await page.route('**/rest/v1/rpc/my_dancer_edit_v1', (route) => json(route, DANCER_SHAPES.fourFieldComplete.profile));
  await page.goto(path);
  return { fake, gateHits };
}

/** Every visible control in the shell shorter than 44px. */
async function shortControls(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll('[data-profile="dancer"] a, [data-profile="dancer"] button'))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.height < 43.5 || r.width < 43.5) out.push(`${(el.textContent || '').trim().slice(0, 20)} ${r.width}x${r.height}`);
    }
    return out;
  });
}

test.describe('dancer app 390x844', () => {
  test.use({ viewport: PHONE });

  for (const [path, id] of ROUTES) {
    test(`${path} renders inside the shell for an allowed person`, async ({ page }) => {
      await open(page, path);
      await expect(page.getByTestId(`dancer-screen-${id}`)).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`${path.replace(/\//g, '\\/')}$`));
      await expect(page.getByTestId('dancer-app-logo')).toHaveText('Bachata Calendar');
      await expect(page.getByTestId('dancer-app-events')).toBeVisible();
      await expect(page.getByTestId('dancer-app-type-label')).toHaveText('Dancer');
      await expect(page.getByTestId('dancer-app-tabs')).toBeVisible();
      // The site's own chrome is gone on /app.
      await expect(page.locator('[data-testid="dancer-app-shell"] ~ footer')).toHaveCount(0);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
      expect(await shortControls(page)).toEqual([]);
      await expectNoHorizontalScroll(page);
      await page.screenshot({ path: `test-results/dancer-app-${id}.png`, fullPage: false });
    });
  }

  test('/app redirects to /app/home', async ({ page }) => {
    await open(page, '/app');
    await expect(page).toHaveURL(/\/app\/home$/);
    await expect(page.getByTestId('dancer-screen-home')).toBeVisible();
  });

  test('a tab tap keeps the shell and moves the active tab', async ({ page }) => {
    await open(page, '/app/home');
    await page.getByTestId('dancer-app-tab-nights').click();
    await expect(page).toHaveURL(/\/app\/nights$/);
    await expect(page.getByTestId('dancer-app-tab-nights')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('dancer-app-tab-home')).not.toHaveAttribute('aria-current', 'page');
  });

  test('closed and unlisted: /app/home goes to today\'s /account', async ({ page }) => {
    const { gateHits } = await open(page, '/app/home', { gate: { open: false, allowed: false } });
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByTestId('dancer-app-shell')).toHaveCount(0);
    expect(gateHits.length).toBeGreaterThan(0);
  });

  test('gate error: fails closed to /account', async ({ page }) => {
    await open(page, '/app/home', { gate: 'error' });
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByTestId('dancer-app-shell')).toHaveCount(0);
  });

  test('signed out: /app/home goes to /auth and the gate is NEVER requested', async ({ page }) => {
    const { gateHits } = await open(page, '/app/home', { signedOut: true, gate: { open: true, allowed: true } });
    await expect(page).toHaveURL(/\/auth\?.*returnTo=%2Fapp%2Fhome/);
    await page.waitForTimeout(500);
    expect(gateHits).toEqual([]);
  });

  test('signed out on today\'s /account and a public page: zero gate requests', async ({ page }) => {
    const { gateHits } = await open(page, '/account', { signedOut: true });
    await expect(page).toHaveURL(/\/auth\?/);
    await page.goto('/cities');
    await page.waitForTimeout(500);
    expect(gateHits).toEqual([]);
  });

  test('allowed, complete, not an organiser: /account opens the dancer app', async ({ page }) => {
    await open(page, '/account');
    await expect(page).toHaveURL(/\/app\/home$/);
    await expect(page.getByTestId('dancer-screen-home')).toBeVisible();
  });
});
