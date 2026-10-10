import { test, expect, type Page, type Route } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

/**
 * Lever 2 W7: "Is this you?" on the PUBLIC organiser page (mockup 06-A), at
 * 390, 768 and 1280.
 *
 * NOT in `npm run test:e2e` and NOT in e2e-smoke.yml, by the same rule as
 * vendor-city-real-supabase.spec.ts: /organisers/:id is a framework route whose
 * SSR loader fetches the organiser server-side, and page.route() mocks patch
 * only the BROWSER's network stack -- with the smoke suite's placeholder key
 * that loader 500s by design (see playwright.config.ts, webServer.url). So this
 * spec needs a dev server with a REAL anon key and VITE_ENABLE_ORGANISER_DETAIL
 * + VITE_ENABLE_ORGANISER_SELF_SERVE on, and it skips itself otherwise. It
 * reads prod's public catalog (what the page does anyway) and WRITES NOTHING:
 * every /rest/v1 call the browser makes, the two RPCs included, is mocked here.
 * The server rules are proved in the admin repo (D4) and by the envelope
 * receipts in the W7 PR body.
 *
 * Run: VITE_ENABLE_ORGANISER_DETAIL=true VITE_ENABLE_ORGANISER_SELF_SERVE=true \
 *      npx playwright test tests/e2e/organiser-public-claim.real-supabase.spec.ts --project=chromium
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const REAL_KEY = !!SUPABASE_URL && !!SUPABASE_KEY && !SUPABASE_KEY.includes('e2e-test-placeholder');

/**
 * The organiser under test is picked at RUN time from the public catalog: a
 * live organiser that organiser_ownership_v1 (anon-callable, reads
 * entity_members only) reports as not managed, so a signed-in visitor is offered
 * "Is this you?". Pinning a slug would break the moment that organiser is
 * claimed, which is the very flow this ships. The claim hint is mocked in the
 * tests (it needs a signed-in session), so no private column is read here.
 * E2E_PUBLIC_ORGANISER_SLUG overrides the pick.
 */
async function pickOrganiserSlug(): Promise<string | null> {
  if (process.env.E2E_PUBLIC_ORGANISER_SLUG) return process.env.E2E_PUBLIC_ORGANISER_SLUG;
  const client = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const { data } = await client
    .from('organiser_profiles')
    .select('id, slug')
    .eq('lifecycle_status', 'live')
    .not('slug', 'is', null)
    .not('is_active', 'is', false)
    .order('name')
    .limit(50);
  for (const row of data ?? []) {
    // A plain REST call: the RPC is not in the generated types yet, and a cast on the name is banned by check:rpc-typing.
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/organiser_ownership_v1`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ p_organiser_id: row.id }),
    });
    const ownership = (await res.json().catch(() => null)) as { is_managed?: boolean } | null;
    if (ownership?.is_managed === false) return row.slug;
  }
  return null;
}

const projectRef = (() => {
  try {
    return new URL(SUPABASE_URL).host.split('.')[0];
  } catch {
    return '';
  }
})();
const userId = '11111111-1111-1111-1111-111111111111';
const email = 'diego@ritmo.example';

const b64url = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

/**
 * The ownership read and the claim hint, mocked: the page's ownership RPCs answer
 * "unmanaged" and, for the signed-in visitor, the hint under test. Everything
 * else is an empty list. Returns true when it answered.
 */
function answerOwnership(route: Route, path: string, hint: string | null): boolean {
  if (path.endsWith('/rpc/organiser_ownership_v1')) {
    void json(route, { is_managed: false, i_own_it: false, my_role: null });
    return true;
  }
  if (path.endsWith('/rpc/organiser_claim_hints_v1')) {
    const ids: string[] = route.request().postDataJSON?.()?.p_organiser_ids ?? [];
    void json(route, hint ? ids.map((id) => ({ organiser_id: id, hint })) : []);
    return true;
  }
  return false;
}

async function signIn(page: Page) {
  const user = { id: userId, aud: 'authenticated', role: 'authenticated', email, user_metadata: {} };
  const token = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: userId, role: 'authenticated', amr: [{ method: 'otp', timestamp: 1 }] })}.sig`;
  await page.addInitScript(
    ({ value, ref }) => localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(value)),
    { value: { access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'r', user }, ref: projectRef },
  );
  await page.route('**/auth/v1/**', (route) => json(route, route.request().url().includes('/auth/v1/user') ? user : {}));
}

test.describe('public organiser page: ownership (W7)', () => {
  test.skip(!REAL_KEY, 'needs a real Supabase anon key: the SSR loader renders the organiser server-side');
  let SLUG = '';
  test.beforeAll(async () => {
    SLUG = (await pickOrganiserSlug()) ?? '';
  });
  test.beforeEach(() => {
    test.skip(!SLUG, 'no live, unmanaged organiser in the public catalog to test against');
  });

  for (const width of [390, 768, 1280]) {
    test(`signed out @${width}: "Is this you?" offers sign-in back to this page; no claim is sent`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const rpcCalls: string[] = [];
      await page.route('**/rest/v1/rpc/**', (route) => {
        const path = new URL(route.request().url()).pathname;
        rpcCalls.push(path);
        if (answerOwnership(route, path, null)) return;
        return json(route, []);
      });
      await page.goto(`/organisers/${SLUG}`);
      const link = page.getByTestId('public-claim-signin');
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute('href', `/auth?mode=signin&returnTo=${encodeURIComponent(`/organisers/${SLUG}`)}`);
      await expect(page.getByTestId('managed-badge')).toHaveCount(0);
      await expect(page.getByTestId('public-claim-open')).toHaveCount(0);
      expect(rpcCalls.filter((p) => /claim_organiser_v1|request_organiser_access_v1/.test(p))).toEqual([]);
      await page.screenshot({ path: `test-results/organiser-public-claim-signed-out-${width}.png`, fullPage: false });
    });
  }

  test('signed in, the database hint says no claim email on file: "Is this you?" requests access through the RPC', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await signIn(page);
    const requests: { id?: string; message?: string }[] = [];
    await page.route('**/rest/v1/rpc/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      if (answerOwnership(route, path, 'no_email')) return;
      if (path.endsWith('/rpc/request_organiser_access_v1')) {
        const body = route.request().postDataJSON?.() ?? {};
        requests.push({ id: body.p_organiser_id, message: body.p_message });
        return json(route, { request_id: 'r1', status: 'open' });
      }
      if (path.endsWith('/rpc/claim_organiser_v1')) return json(route, { code: 'P0001', message: 'no_contact_email' }, 400);
      return json(route, []);
    });
    await page.goto(`/organisers/${SLUG}`);
    await page.getByTestId('public-claim-open').click();
    await expect(page.getByTestId('public-request-panel')).toContainText('no contact email');
    await page.getByTestId('public-request-note').fill('I run the Tuesday classes');
    await page.getByTestId('public-request-send').click();
    await expect(page.getByTestId('public-claim-done')).toContainText('Request sent');
    expect(requests).toHaveLength(1);
    expect(requests[0].message).toBe('I run the Tuesday classes');
    expect(requests[0].id).toMatch(/^[0-9a-f-]{36}$/);
    await page.screenshot({ path: 'test-results/organiser-public-claim-requested-390.png', fullPage: false });
  });
});
