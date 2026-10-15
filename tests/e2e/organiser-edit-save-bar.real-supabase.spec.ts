import { test, expect, type Page, type Route } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

/**
 * Edit in place on a PHONE: the Save bar must sit above the BottomNav, inside
 * the screen, tappable, and pinned while the page scrolls. Live 2026-10-11 it sat
 * exactly under the nav (Save not hit-testable) and, after an in-app
 * navigation, halfway down the page: the route's PageTransition wrapper keeps
 * `filter: blur(0px)`, which turns position:fixed into "fixed to the wrapper".
 * So every case runs twice: a direct load AND a client-side navigation.
 *
 * NOT in `npm run test:e2e`, by the rule organiser-public-claim.real-supabase
 * .spec.ts documents: /organisers/:id is a framework route whose SSR loader reads
 * the organiser server-side, which page.route() cannot mock, and e2e-smoke.yml's
 * placeholder key 500s it. It needs a dev server with a REAL anon key and
 * VITE_ENABLE_ORGANISER_DETAIL + VITE_ENABLE_ORGANISER_SELF_SERVE on, and skips
 * itself otherwise. It reads prod's public catalog only; every browser RPC is
 * mocked (ownership answers "owner"), and any other non-GET is refused here, so
 * it WRITES NOTHING. Save is never pressed.
 *
 * Run: VITE_ENABLE_ORGANISER_DETAIL=true VITE_ENABLE_ORGANISER_SELF_SERVE=true \
 *      npx playwright test tests/e2e/organiser-edit-save-bar.real-supabase.spec.ts --project=chromium
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const REAL_KEY = !!SUPABASE_URL && !!SUPABASE_KEY && !SUPABASE_KEY.includes('e2e-test-placeholder');

/** Any live organiser with a slug; E2E_PUBLIC_ORGANISER_SLUG overrides. Ownership is mocked, so who owns it is irrelevant. */
async function pickOrganiserSlug(): Promise<string | null> {
  if (process.env.E2E_PUBLIC_ORGANISER_SLUG) return process.env.E2E_PUBLIC_ORGANISER_SLUG;
  const client = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const { data } = await client
    .from('organiser_profiles')
    .select('slug')
    .eq('lifecycle_status', 'live')
    .not('slug', 'is', null)
    .not('is_active', 'is', false)
    .order('name')
    .limit(1);
  return data?.[0]?.slug ?? null;
}

const projectRef = (() => {
  try {
    return new URL(SUPABASE_URL).host.split('.')[0];
  } catch {
    return '';
  }
})();
const userId = '11111111-1111-1111-1111-111111111111';
const b64url = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

/** Signed in as the organiser's owner (browser side only). */
async function signInAsOwner(page: Page) {
  const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'owner@ritmo.example', user_metadata: {} };
  const token = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: userId, role: 'authenticated', amr: [{ method: 'otp', timestamp: 1 }] })}.sig`;
  await page.addInitScript(
    ({ value, ref }) => localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(value)),
    { value: { access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'r', user }, ref: projectRef },
  );
  await page.route('**/auth/v1/**', (route) => json(route, route.request().url().includes('/auth/v1/user') ? user : {}));
  await page.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (path.endsWith('/rpc/organiser_ownership_v1')) return json(route, { is_managed: true, i_own_it: true, my_role: 'owner' });
    if (path.includes('/rpc/')) return json(route, []);
    if (req.method() !== 'GET' && req.method() !== 'HEAD') return json(route, { message: 'e2e: writes are refused' }, 403);
    return route.continue();
  });
}

type Box = { x: number; y: number; width: number; height: number };
const box = async (page: Page, selector: string): Promise<Box> =>
  page.locator(selector).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

async function scrollTo(page: Page, where: 'top' | 'bottom') {
  await page.evaluate((w) => window.scrollTo(0, w === 'top' ? 0 : document.documentElement.scrollHeight), where);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

test.describe('public organiser page: the edit-in-place Save bar on a phone', () => {
  // A phone-like context (meta viewport honoured, touch). Chromium cannot emulate
  // a safe-area inset, so env(safe-area-inset-bottom) is 0 here.
  test.use({ isMobile: true, hasTouch: true });
  test.skip(!REAL_KEY, 'needs a real Supabase anon key: the SSR loader renders the organiser server-side');
  let SLUG = '';
  test.beforeAll(async () => {
    SLUG = (await pickOrganiserSlug()) ?? '';
  });
  test.beforeEach(() => {
    test.skip(!SLUG, 'no live organiser in the public catalog to test against');
  });

  for (const vp of [{ width: 390, height: 844 }, { width: 360, height: 640 }]) {
    for (const entry of ['direct load', 'in-app navigation'] as const) {
      test(`${vp.width}x${vp.height}, ${entry}: bar inside the screen, above the nav, Save tappable, pinned on scroll`, async ({ page }) => {
        await page.setViewportSize(vp);
        await signInAsOwner(page);
        if (entry === 'direct load') {
          await page.goto(`/organisers/${SLUG}`);
        } else {
          // A client navigation from another FRAMEWORK route (the fade only plays
          // once one has mounted): the organiser route then mounts inside PageTransition.
          await page.goto('/faq');
          await page.waitForFunction(() => !!(window as unknown as { __reactRouterDataRouter?: unknown }).__reactRouterDataRouter);
          // The PageTransition chunk is warmed at the first idle moment; navigating
          // before it has loaded renders the plain wrapper and misses the filter.
          await page.waitForFunction(() => performance.getEntriesByType('resource').some((e) => e.name.includes('PageTransition')));
          await page.evaluate((path) => (window as unknown as { __reactRouterDataRouter: { navigate: (p: string) => Promise<void> } }).__reactRouterDataRouter.navigate(path), `/organisers/${SLUG}`);
          await expect(page).toHaveURL(new RegExp(`/organisers/${SLUG}$`));
          // The wrapper this case exists for: a filter left on the route after the fade.
          await expect.poll(() => page.evaluate(() => {
            for (let n = document.querySelector('#main-content article')?.parentElement; n; n = n.parentElement) {
              if (getComputedStyle(n).filter !== 'none') return true;
            }
            return false;
          })).toBe(true);
        }

        // Make a draft (local only: nothing is sent until Save, which this never presses).
        await page.locator('[data-eip-pencil="website"]').click();
        const sheet = page.getByTestId('eip-sheet');
        await sheet.getByRole('textbox').fill('https://example.org/e2e-draft');
        await sheet.getByRole('button', { name: 'Done' }).click();
        await expect(sheet).toHaveCount(0);
        const bar = page.getByTestId('eip-bar');
        await expect(bar).toBeVisible();
        // Let any route transition finish: the bar's rect is the same two frames running.
        await expect.poll(async () => {
          const a = await box(page, '[data-testid="eip-bar"]');
          await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
          const b = await box(page, '[data-testid="eip-bar"]');
          return a.y === b.y && a.x === b.x;
        }).toBe(true);

        const positions: Box[] = [];
        for (const where of ['top', 'bottom', 'top'] as const) {
          await scrollTo(page, where);
          const b = await box(page, '[data-testid="eip-bar"]');
          const nav = await box(page, '#app-nav');
          // Fully inside the viewport.
          expect(b.y, `bar top @${where}`).toBeGreaterThanOrEqual(0);
          expect(b.x).toBeGreaterThanOrEqual(0);
          expect(b.y + b.height, `bar bottom @${where}`).toBeLessThanOrEqual(vp.height);
          expect(b.x + b.width).toBeLessThanOrEqual(vp.width + 0.5);
          // The section row is under the header now: the bar sits clear below it.
          expect(b.y, `bar top vs nav bottom @${where}`).toBeGreaterThanOrEqual(nav.y + nav.height - 0.5);
          // Save is the element a tap at its centre reaches.
          const hit = await bar.getByRole('button', { name: 'Save', exact: true }).evaluate((btn) => {
            const r = btn.getBoundingClientRect();
            const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            return !!el && (el === btn || btn.contains(el));
          });
          expect(hit, `Save hit-testable @${where}`).toBe(true);
          if (where === 'bottom') {
            // The room kept at the end of the page: the footer's last row ends above the dock (notice + bar).
            const dock = await box(page, '[data-testid="eip-dock"]');
            const footer = await box(page, 'footer');
            expect(footer.y + footer.height, 'footer bottom vs dock top at full scroll').toBeLessThanOrEqual(dock.y + 0.5);
          }
          positions.push(b);
        }
        // It does not move when the page scrolls.
        for (const p of positions) {
          expect(Math.abs(p.y - positions[0].y)).toBeLessThanOrEqual(1);
        }
        await page.screenshot({ path: `test-results/organiser-edit-save-bar-${vp.width}x${vp.height}-${entry.replace(/\W+/g, '-')}.png`, fullPage: false });
      });
    }
  }
});
