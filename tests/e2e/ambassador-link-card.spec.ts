import { expect, test, type Page } from '@playwright/test';
import { ME, NOW, PHONE, json, projectRef } from './helpers/organiserFake';

// Bristol ambassador tracker: the link card on /ambassador at 390x844, every data shape.
// Stubs only (prod has 0 ambassador rows): every Supabase REST/auth call is answered in the browser.

test.use({ viewport: PHONE });

const CITY = 'c1000000-0000-4000-8000-0000000000b1';
const LOCKED = 'An admin switched this link off. Ask an admin to turn it back on.';
const b64url = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

type Row = Record<string, unknown>;
const link = (extra: Row = {}): Row => ({
  link_id: 'l1', code: 'bristol-jan', city_name: 'Bristol', city_slug: 'bristol', is_active: true, admin_locked: false,
  live: true, ambassador_first_name: 'Jan', joined: 0, city_set: 0, ...extra,
});

async function install(page: Page, rows: Row[], opts: { admin?: boolean } = {}) {
  const sent: { fn: string; body: unknown }[] = [];
  const user = { id: ME, aud: 'authenticated', role: 'authenticated', email: 'jan@bristol.example', user_metadata: {} };
  const token = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: ME, role: 'authenticated', amr: [{ method: 'otp', timestamp: 1 }] })}.sig`;
  await page.clock.install({ time: NOW });
  await page.addInitScript(
    ({ value, ref }) => {
      localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(value));
      (window as unknown as { __copied: string[] }).__copied = [];
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: (t: string) => { (window as unknown as { __copied: string[] }).__copied.push(t); return Promise.resolve(); } },
      });
    },
    { value: { access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'r', user }, ref: projectRef },
  );
  await page.route('**/auth/v1/**', (route) => (route.request().url().includes('/auth/v1/user') ? json(route, user) : json(route, {})));
  await page.route('**/rest/v1/**', (route) => {
    const url = new URL(route.request().url());
    const rpc = url.pathname.match(/\/rpc\/([a-z0-9_]+)$/)?.[1];
    if (url.pathname.endsWith('/entity_members')) return json(route, [{ entity_id: CITY }]);
    if (url.pathname.endsWith('/cities')) return json(route, [{ id: CITY, name: 'Bristol', slug: 'bristol' }]);
    if (!rpc) return json(route, []);
    if (rpc === 'get_ambassador_link_tracker_v1') return json(route, { links: rows });
    if (rpc === 'admin_is_admin') return json(route, opts.admin === true);
    if (rpc === 'admin_list_pending_review_v1') return json(route, []);
    sent.push({ fn: rpc, body: route.request().postDataJSON?.() ?? null });
    return json(route, null);
  });
  return sent;
}

const shot = (page: Page, name: string) => page.screenshot({ path: `walk-shots/ambassador-link-card/${name}.png`, fullPage: true });

async function layoutChecks(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const small = await page.locator('[data-testid="link-card"] button').evaluateAll((els) =>
    els.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => e.getBoundingClientRect().height).filter((h) => h < 44));
  expect(small).toEqual([]);
}

const sizes = [0, 1, 60];
for (const n of sizes) {
  const joined = (e: Row = {}) => link({ joined: n, city_set: Math.min(n, 3), ...e });
  const label = `${n} joined`;

  test(`active, ${label}`, async ({ page }) => {
    const sent = await install(page, [joined()]);
    await page.goto('/ambassador');
    const card = page.getByTestId('link-card');
    await expect(card).toBeVisible();
    await expect(page.getByTestId('link-joined')).toHaveText(`Joined ${n}`);
    await expect(page.getByTestId('link-cityset')).toHaveText(`Set Bristol ${Math.min(n, 3)}`);
    if (n === 0) await expect(page.getByTestId('link-empty')).toContainText('Nobody has joined yet');
    else await expect(page.getByTestId('link-empty')).toHaveCount(0);
    await expect(card.getByRole('button', { name: 'Switch off' })).toBeEnabled();
    await card.getByRole('button', { name: 'Copy link' }).click();
    await expect(card.getByRole('button', { name: 'Copied' })).toBeVisible();
    const origin = new URL(page.url()).origin;
    expect(await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied)).toEqual([`${origin}/join/a/bristol-jan`]);
    await layoutChecks(page);
    await shot(page, `active-${n}`);
    expect(sent.filter((s) => s.fn.startsWith('set_'))).toEqual([]);
  });

  test(`switched off by the ambassador, ${label}`, async ({ page }) => {
    const sent = await install(page, [joined({ is_active: false })]);
    await page.goto('/ambassador');
    const card = page.getByTestId('link-card');
    await expect(card).toBeVisible();
    await expect(page.getByTestId('link-note')).toContainText('Your link is off');
    await expect(card.getByRole('button', { name: 'Switch on' })).toBeEnabled();
    await expect(page.getByTestId('switch-reason')).toHaveCount(0);
    await layoutChecks(page);
    await shot(page, `off-ambassador-${n}`);
    expect(sent.filter((s) => s.fn.startsWith('set_'))).toEqual([]);
  });

  test(`switched off by an admin, ${label}`, async ({ page }) => {
    const sent = await install(page, [joined({ is_active: false, admin_locked: true })]);
    await page.goto('/ambassador');
    const card = page.getByTestId('link-card');
    await expect(card.getByRole('button', { name: 'Switch on' })).toBeDisabled();
    await expect(page.getByTestId('switch-reason')).toHaveText(LOCKED);
    await expect(card.getByRole('button', { name: 'Switch on' })).toHaveAttribute('aria-describedby', 'why-l1');
    await layoutChecks(page);
    await shot(page, `off-admin-${n}`);
    expect(sent.filter((s) => s.fn.startsWith('set_'))).toEqual([]);
  });

  test(`not live, ${label}`, async ({ page }) => {
    const sent = await install(page, [joined({ live: false })]);
    await page.goto('/ambassador');
    const card = page.getByTestId('link-card');
    await expect(page.getByTestId('link-note')).toContainText('This link no longer works');
    await expect(card.getByRole('button')).toHaveCount(0);
    await expect(page.getByTestId('link-url')).toHaveCount(0);
    await layoutChecks(page);
    await shot(page, `not-live-${n}`);
    expect(sent.filter((s) => s.fn.startsWith('set_'))).toEqual([]);
  });
}

test('an admin with two links sees both, with who, and can switch an admin-locked one on', async ({ page }) => {
  const sent = await install(page, [
    link({ joined: 4, city_set: 2 }),
    link({ link_id: 'l2', code: 'leeds-sam', city_name: 'Leeds', city_slug: 'leeds', ambassador_first_name: 'Sam', is_active: false, admin_locked: true, joined: 60, city_set: 9 }),
  ], { admin: true });
  await page.goto('/ambassador');
  const cards = page.getByTestId('link-card');
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toContainText('Your Bristol link (Jan)');
  await expect(cards.nth(1)).toContainText('Your Leeds link (Sam)');
  const on = cards.nth(1).getByRole('button', { name: 'Switch on' });
  await expect(on).toBeEnabled();
  await expect(cards.nth(1).getByTestId('switch-reason')).toHaveCount(0);
  await layoutChecks(page);
  await shot(page, 'admin-two-links');
  await on.click();
  await expect(page.getByTestId('switch-confirm')).toContainText('Switch this link on?');
  await page.getByTestId('switch-confirm').getByRole('button', { name: 'Switch on' }).click();
  await expect.poll(() => sent.filter((s) => s.fn === 'set_ambassador_link_active_v1').length).toBe(1);
  expect(sent.find((s) => s.fn === 'set_ambassador_link_active_v1')?.body).toEqual({ p_link_id: 'l2', p_active: true });
});

test('switching off needs the confirm sentence; Cancel sends nothing', async ({ page }) => {
  const sent = await install(page, [link({ joined: 1, city_set: 1 })]);
  await page.goto('/ambassador');
  await page.getByRole('button', { name: 'Switch off' }).click();
  await expect(page.getByTestId('switch-confirm')).toContainText('Switch this link off?');
  await layoutChecks(page);
  await shot(page, 'confirm-off');
  await page.getByRole('button', { name: 'Cancel' }).click();
  expect(sent.filter((s) => s.fn.startsWith('set_'))).toEqual([]);
});
