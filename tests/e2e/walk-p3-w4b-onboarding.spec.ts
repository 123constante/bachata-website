import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { OrganiserFake, PHONE, expectNoHorizontalScroll, json, refuse, type FakeOptions } from './helpers/organiserFake';

// P3 W4b walk at 390x844 on the organiser fake: Welcome / Add a page in the P3 look, one test per
// prod shape (survey 2026-10-28). Measures what the design record promises: text contrast >= 4.5,
// every control >= 44x44, nothing wider than 390, the sheet and the confirmation inside the
// viewport, and no page scroll when a sheet opens. P3 is mounted only with BOTH flags on:
//   VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true npx playwright test tests/e2e/walk-p3-w4b-onboarding.spec.ts --project=chromium
// With organiserP3 off (the e2e gate's server today) /account/p3 does not exist, and each test
// skips itself after seeing that, rather than failing on a route the flag hides.

test.use({ viewport: PHONE });
const OUT = process.env.P3_WALK_DIR ?? 'test-results/p3-w4b-walk';
mkdirSync(OUT, { recursive: true });

type Shape = 'new' | 'unfinished' | 'no_row' | 'open_request' | 'has_page';

async function open(page: Page, shape: Shape, path = '/account/p3') {
  const opts: FakeOptions = { noOrganiser: shape !== 'has_page', dancerProfile: shape === 'no_row' ? 'none' : 'complete' };
  const fake = new OrganiserFake(opts);
  if (shape === 'open_request') {
    fake.myRequests.push({ request_id: 'r1', organiser_id: fake.claimable[1].id, organiser_name: fake.claimable[1].name, status: 'open', created_at: '2026-10-01T10:00:00Z', resolved_at: null });
  }
  await fake.install(page);
  // The wizard's status read, which the shared fake does not serve: every page the fake knows, nothing missing.
  await page.route('**/rest/v1/rpc/organiser_onboarding_status_v1*', (route) =>
    json(route, { is_admin: false, person: { missing: [] }, organisers: fake.organisers.map((o) => ({ id: o.id, lifecycle: o.lifecycle_status, missing: [], about: { done: false, skipped: false } })) }));
  if (shape === 'no_row') {
    // No dancer row: the person reads (my_dancer_edit_v1) answer no_profile, as prod does.
    await page.route('**/rest/v1/rpc/my_dancer_edit_v1*', (route) => refuse(route, 'no_profile'));
  }
  if (shape === 'unfinished') {
    // A dancer row with a name and a role, no city and no photo (6 of the 10 prod unfinished have a city; the read is the same).
    await page.route('**/rest/v1/rpc/profile_complete_v1*', (route) => json(route, false));
    await page.route('**/rest/v1/dancer_profiles*', (route) => json(route, { first_name: 'Sam', based_city_id: null, dance_role: 'leader', avatar_url: null }));
  }
  await page.goto(path);
  const mounted = await page.getByTestId('p3-shell').waitFor({ timeout: 15_000 }).then(() => true, () => false);
  // Skip ONLY when the flag is off. With it on (e2e-smoke.yml sets it) an unmounted page is a FAILURE,
  // not a skip: scripts/check-p3-specs-not-skipped.mjs holds every P3 skip to this shape.
  test.skip(!mounted && process.env.VITE_ENABLE_ORGANISER_P3 !== 'true', 'organiserP3 is off in this server: /account/p3 is not mounted');
  return fake;
}

/** Every visible text's contrast against the first opaque background up its ancestors; every control's box. */
async function audit(page: Page) {
  return page.evaluate(() => {
    const rgb = (s: string) => (s.match(/[\d.]+/g) ?? []).map(Number);
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ground = (el: Element | null): number[] => {
      for (let e = el; e; e = e.parentElement) {
        const c = rgb(getComputedStyle(e).backgroundColor);
        if (c.length >= 3 && (c.length === 3 || c[3] > 0.95)) return c.slice(0, 3);
      }
      return [255, 255, 255];
    };
    let minContrast = 99;
    let worst = '';
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || !n.textContent?.trim()) continue;
      const box = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      if (!box.width || !box.height || st.visibility === 'hidden' || el.closest('[aria-hidden="true"], .sr-only, [disabled], [aria-disabled="true"]')) continue;
      // Text under an open sheet's scrim is dimmed on purpose.
      if (document.querySelector('[role="dialog"]') && !el.closest('[role="dialog"]')) continue;
      const fg = rgb(st.color).slice(0, 3);
      const [a, b] = [lum(fg), lum(ground(el))].sort((x, y) => y - x);
      const ratio = (a + 0.05) / (b + 0.05);
      if (ratio < minContrast) { minContrast = ratio; worst = n.textContent.trim().slice(0, 40); }
    }
    const scope = document.querySelector('[role="dialog"]') ?? document.body;
    const small = [...scope.querySelectorAll('button, a[href], input, textarea')]
      // Only what a finger can reach: on screen and on top at its centre (the site's own footer sits under the fixed P3 frame).
      .filter((e) => {
        const r = e.getBoundingClientRect();
        if (!r.width || !r.height || e.closest('.sr-only') || r.bottom <= 0 || r.top >= innerHeight) return false;
        const hit = document.elementFromPoint(r.left + r.width / 2, Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1));
        return !!hit && (hit === e || e.contains(hit));
      })
      .filter((e) => { const r = e.getBoundingClientRect(); return r.height < 43.5 || r.width < 43.5; })
      .map((e) => `${e.getAttribute('data-testid') ?? e.tagName}:${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`);
    return { minContrast: Math.round(minContrast * 100) / 100, worst, small, width: document.documentElement.scrollWidth };
  });
}

async function inViewport(page: Page, testId: string) {
  await expect.poll(async () => {
    const b = await page.getByTestId(testId).boundingBox();
    return !!b && b.x >= 0 && b.y >= 0 && b.x + b.width <= PHONE.width + 0.5 && b.y + b.height <= PHONE.height + 0.5;
  }).toBe(true);
}

async function check(page: Page, name: string) {
  // Measure the settled screen: a sheet or screen still sliding in is partly transparent.
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))));
  const a = await audit(page);
  console.log(`[w4b] ${name}: contrast ${a.minContrast} (${a.worst}), under-44 ${a.small.length} ${a.small.join(' ')}, width ${a.width}`);
  expect(a.minContrast, `${name}: lowest contrast "${a.worst}"`).toBeGreaterThanOrEqual(4.5);
  expect(a.small, `${name}: controls under 44px`).toEqual([]);
  expect(a.width).toBeLessThanOrEqual(PHONE.width);
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

/** Taps a control that opens a sheet; the page must not scroll and the sheet must sit inside the viewport. */
async function openSheet(page: Page, tap: () => Promise<void>, name: string, sheetId = 'p3-ob-sheet-claim') {
  const before = await page.evaluate(() => [window.scrollY, document.querySelector('.p3-main')?.scrollTop ?? 0]);
  await tap();
  await inViewport(page, sheetId);
  expect(await page.evaluate(() => [window.scrollY, document.querySelector('.p3-main')?.scrollTop ?? 0])).toEqual(before);
  await check(page, name);
}

/** Welcome -> "Find your page" -> the Find screen with the search typed. */
async function findPage(page: Page, term: string) {
  await expect(page.getByTestId('p3-ob-title')).toBeVisible();
  await page.getByTestId('p3-ob-continue').click();
  await page.getByTestId('p3-ob-find-q').fill(term);
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme}`, () => {
    test.use({ colorScheme: scheme });

    test('brand new: Welcome, search, claim it, carries on into the page questions', async ({ page }) => {
      const fake = await open(page, 'new');
      await expect(page.getByTestId('p3-ob-title')).toContainText('Welcome');
      await expect(page.getByTestId('p3-ob-continue')).toHaveText('Find your page');
      await check(page, `${scheme}-new-1-welcome`);
      await findPage(page, 'ritmo');
      await expect(page.getByTestId(/^p3-ob-find-a0000000/)).toHaveCount(2);
      await check(page, `${scheme}-new-2-results`);
      await openSheet(page, () => page.getByTestId(/^p3-ob-find-a0000000/).first().click(), `${scheme}-new-3-claim`);
      await page.getByRole('button', { name: 'Not this one' }).click();
      await expect(page.getByTestId('p3-ob-sheet-claim')).toHaveCount(0);
      expect(fake.sent('claim_organiser_v1')).toHaveLength(0);
      await page.getByTestId(/^p3-ob-find-a0000000/).first().click();
      await page.getByTestId('p3-ob-claim-go').click();
      // The claimed page has no number on file: the wizard goes on to the phone question for Ritmo Latino Leeds.
      await expect(page.getByTestId('p3-ob-phone')).toBeVisible();
      expect(fake.sent('claim_organiser_v1')).toHaveLength(1);
      await check(page, `${scheme}-new-4-after-claim`);
    });

    test('brand new: no match, create name step, city step (Which city?)', async ({ page }) => {
      const fake = await open(page, 'new');
      await findPage(page, 'zz no page');
      await expect(page.getByText(/No page called/)).toBeVisible();
      await check(page, `${scheme}-new-5-no-match`);
      await page.getByTestId('p3-ob-continue').click();
      await expect(page.getByTestId('p3-ob-page-name')).toBeVisible();
      await check(page, `${scheme}-new-6-name`);
      await page.getByTestId('p3-ob-page-name').fill('Ritmo Harrogate');
      await page.getByTestId('p3-ob-continue').click();
      await expect(page.getByTestId('p3-ob-title')).toHaveText('Which city?');
      await check(page, `${scheme}-new-7-city`);
      expect(fake.sent('create_organiser_profile_v1')).toHaveLength(0);
    });

    test('unfinished profile: Create is refused at the end, says what to do, nothing is created', async ({ page }) => {
      const fake = await open(page, 'unfinished');
      // The server refuses a create for an unfinished dancer profile (profile_incomplete); the fake would accept it.
      fake.refuse('create_organiser_profile_v1', 'profile_incomplete', 5);
      await findPage(page, 'zz no page');
      await page.getByTestId('p3-ob-continue').click();
      await page.getByTestId('p3-ob-page-name').fill('Ritmo Harrogate');
      await page.getByTestId('p3-ob-continue').click();
      await page.getByTestId('p3-ob-city-q').fill('lon');
      await page.getByTestId(/^p3-ob-city-c1/).first().click();
      await page.getByTestId('p3-ob-continue').click();
      await expect(page.getByTestId('p3-ob-error')).toContainText('Finish your dancer profile first');
      await check(page, `${scheme}-unfinished-1-refused`);
      await expect(page.getByRole('button', { name: 'Finish your profile' })).toBeVisible();
      await page.getByRole('button', { name: 'Finish your profile' }).click();
      await expect(page).toHaveURL(/\/finish-profile\?returnTo=%2Faccount%2Fp3%2Fstart/);
      expect(fake.organisers).toHaveLength(0);
      expect(fake.sent('claim_organiser_v1')).toHaveLength(0);
    });

    test('no dancer row: its own frame with Message us, nothing sent', async ({ page }) => {
      const fake = await open(page, 'no_row', '/account/p3/start?at=name');
      await expect(page.getByTestId('p3-ob-nodancer')).toBeVisible();
      await expect(page.getByTestId('p3-ob-nodancer-contact')).toHaveText('Message us on WhatsApp');
      await check(page, `${scheme}-no-row-gate`);
      expect(fake.sent('create_organiser_profile_v1')).toHaveLength(0);
      expect(fake.sent('claim_organiser_v1')).toHaveLength(0);
    });

    test('open request: the waiting card on Welcome; ask to join ends on the Asked screen', async ({ page }) => {
      const fake = await open(page, 'open_request');
      const other = { id: 'a0000000-0000-4000-8000-0000000000c3', name: 'Ritmo Bristol', contact_email: 'someone@else.example', claimed_by: null };
      fake.claimable.push(other);
      await expect(page.getByTestId('p3-ob-waiting-row')).toContainText('Ritmo Manchester');
      await check(page, `${scheme}-request-1-pending`);
      await findPage(page, 'ritmo');
      // The row already asked says so; its sheet shows the asked line and sends nothing.
      await expect(page.getByTestId(`p3-ob-find-${fake.claimable[1].id}`)).toContainText('Waiting for an answer');
      await openSheet(page, () => page.getByTestId(`p3-ob-find-${fake.claimable[1].id}`).click(), `${scheme}-request-2-asked`);
      await expect(page.getByTestId('p3-ob-claim-asked')).toContainText('You asked on');
      await page.getByTestId('p3-ob-claim-close').click();
      expect(fake.sent('request_organiser_access_v1')).toHaveLength(0);
      // Ask to join a page whose email differs: the sheet's button asks, and the flow ends on the Asked screen.
      await page.getByTestId('p3-ob-find-q').fill('bristol');
      await page.getByTestId(`p3-ob-find-${other.id}`).click();
      await expect(page.getByTestId('p3-ob-claim-go')).toHaveText('Ask to join');
      await page.getByTestId('p3-ob-claim-go').click();
      await expect(page.getByTestId('p3-ob-title')).toHaveText('Asked to join Ritmo Bristol');
      expect(fake.sent('request_organiser_access_v1')).toHaveLength(1);
      await check(page, `${scheme}-request-3-asked`);
    });

    test('has a page: Add a page from You, sign-out sheet', async ({ page }) => {
      await open(page, 'has_page', '/account/p3/you/add');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Add a page');
      await expect(page.getByTestId('org-back')).toHaveText(/You/);
      await check(page, `${scheme}-add-1`);
      const before = await page.evaluate(() => window.scrollY);
      await page.getByTestId('onboarding-signout').click();
      await inViewport(page, 'onboarding-signout-sheet');
      expect(await page.evaluate(() => window.scrollY)).toBe(before);
      await check(page, `${scheme}-add-2-signout`);
    });
  });
}
