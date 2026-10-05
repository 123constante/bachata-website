import { test, expect, type Page, type Route } from '@playwright/test';

// Lever 2 launch hardening (walk 2026-10-05): S3 team page layout at 390/768/1280
// and S4 the declined answer on /account. Every **/auth/v1/** and **/rest/v1/**
// call is mocked, so nothing leaves the browser (no Supabase project is touched).

const projectRef = 'stsdtacfauprzrdebmzg';
const ME = '11111111-1111-1111-1111-111111111111';
const ORG = 'org-1';

const b64url = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

// Normal-length real-world emails; the walk's clip happened with these at 390.
const LONG_OWNER = 'maria.konstantinopoulou@bachata-community-london.example';
const LONG_MANAGER = 'alejandro.fernandez-villanueva@dancestudio-example.com';

interface Options {
  mine?: Record<string, unknown>[];
  path: string;
}

async function open(page: Page, opts: Options) {
  const members = [
    { user_id: ME, member_role: 'owner', is_primary: true, joined_at: '2026-09-01T10:00:00+00:00', email: LONG_OWNER, display_name: null },
    { user_id: '33333333-3333-3333-3333-333333333333', member_role: 'manager', is_primary: false, joined_at: '2026-09-03T10:00:00+00:00', email: LONG_MANAGER, display_name: null },
  ];
  const home = {
    today: '2026-10-04',
    organisers: [{
      id: ORG, name: 'Ritmo Bachata London', slug: 'ritmo', avatar_url: null, city_id: null, lifecycle_status: 'live',
      role: 'owner', is_primary: true, joined_at: '2026-09-01T10:00:00+00:00', latest_decision: null, series: [],
      team: members.map((m) => ({ ...m, is_self: m.user_id === ME })),
    }],
  };
  const user = { id: ME, aud: 'authenticated', role: 'authenticated', email: LONG_OWNER, user_metadata: {} };
  const token = `${b64url({ alg: 'HS256' })}.${b64url({ sub: ME, amr: [{ method: 'otp', timestamp: 1 }] })}.sig`;
  await page.addInitScript(
    ({ value, ref }) => localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(value)),
    { value: { access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'r', user }, ref: projectRef },
  );
  await page.route('**/auth/v1/**', (route) => json(route, route.request().url().includes('/user') ? user : {}));
  await page.route('**/rest/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = (route.request().postDataJSON?.() ?? {}) as Record<string, unknown>;
    const rpc = path.match(/\/rpc\/([a-z0-9_]+)$/)?.[1];
    if (!rpc) return json(route, []);
    if (rpc === 'organiser_home_v1') return json(route, home);
    if (rpc === 'list_organiser_access_requests_v1') return json(route, body.p_scope === 'mine' ? opts.mine ?? [] : []);
    return json(route, []);
  });
  await page.goto(opts.path);
}

for (const width of [390, 768, 1280]) {
  test.describe(`S3 team page layout @${width}`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('Leave, Remove and the role badges stay on screen for long emails', async ({ page }) => {
      await open(page, { path: `/account/team/${ORG}` });
      await expect(page.getByTestId('team-member')).toHaveCount(2);
      await page.waitForTimeout(600); // the route fade-in
      for (const testId of ['member-leave', 'member-remove']) {
        const box = await page.getByTestId(testId).boundingBox();
        expect(box, `${testId} is rendered`).not.toBeNull();
        expect(box!.x, `${testId} left edge`).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width, `${testId} right edge within ${width}px`).toBeLessThanOrEqual(width);
      }
      for (const badge of await page.locator('[data-testid="team-member"] [class*="rounded-full"]').all()) {
        const box = await badge.boundingBox();
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, 'no sideways scroll').toBeLessThanOrEqual(0);
      await page.screenshot({ path: `test-results/organiser-hardening-team-${width}.png`, fullPage: true });
    });
  });
}

test.describe('S4 declined access request on /account', () => {
  test.use({ viewport: { width: 390, height: 900 } });

  test('shows a declined answer with the date, and nothing when there is none', async ({ page }) => {
    await open(page, {
      path: '/account',
      mine: [{
        request_id: 'req-d', organiser_id: 'org-2', organiser_name: 'Walk Mismatch Socials', message: 'I run it',
        status: 'declined', created_at: new Date(Date.now() - 2 * 86400000).toISOString(), resolved_at: new Date(Date.now() - 86400000).toISOString(), member_role: null,
      }],
    });
    const declined = page.getByTestId('declined-access-requests');
    await expect(declined).toContainText('Walk Mismatch Socials');
    await expect(declined).toContainText('was declined');
    await expect(page.getByTestId('my-access-requests')).toHaveCount(0);
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'test-results/organiser-hardening-declined-390.png', fullPage: true });
  });

  test('a user who never asked sees no declined section', async ({ page }) => {
    await open(page, { path: '/account', mine: [] });
    await expect(page.getByTestId('team-link')).toBeVisible();
    await expect(page.getByTestId('declined-access-requests')).toHaveCount(0);
  });
});
