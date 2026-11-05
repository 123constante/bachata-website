import { test, expect, type Page } from '@playwright/test';
import { ORG, ORG_NAME, OrganiserFake, json } from './helpers/organiserFake';

// Go live (brief p3-golive-wiring): Review ready, Review after an incomplete refusal, Review of a page in review,
// Live, Live's review variant and a failed call + retry, at 390x844 and 320x568, light and dark. Every
// complete_organiser_onboarding_v1 call is FULFILLED by page.route here: the walk never reaches a real database
// (a real call would publish a real page). For each state: no page scroll, nothing wider than the viewport, every
// control >= 44x44, a screenshot into docs/handovers/p3-golive-wiring/. P3 mounts only with BOTH flags:
//   VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true npx playwright test tests/e2e/walk-p3-golive.spec.ts --project=chromium
// With organiserP3 off (the e2e gate's server today) each test skips itself, as the slice walks do.

const SHOTS = 'docs/handovers/p3-golive-wiring';
const SIZES = [
  { width: 390, height: 844 },
  { width: 320, height: 568 },
];
type Answer = { status?: number; body: unknown } | 'abort';

async function open(page: Page, opts: { lifecycle: string; answers: Answer[]; theme: 'light' | 'dark' }) {
  const fake = new OrganiserFake({});
  await fake.install(page);
  await page.addInitScript((t) => window.localStorage.setItem('p3-ob-theme', t), opts.theme);
  await page.route('**/rest/v1/rpc/get_organiser_contact_settings_v1*', (r) =>
    json(r, { contact_phone: '+447700900123', contact_email: null, show_phone_publicly: true, show_email_publicly: false, claim_email: null }));
  await page.route('**/rest/v1/rpc/organiser_onboarding_status_v1*', (r) =>
    json(r, {
      v: 1, gate_on: false, is_admin: false, complete: true,
      person: { complete: true, missing: [] },
      organisers: [{ id: ORG, name: ORG_NAME, role: 'owner', lifecycle: opts.lifecycle, complete: true, missing: [], about: { done: true, skipped: false } }],
    }));
  const answers = [...opts.answers];
  const calls: string[] = [];
  await page.route('**/rest/v1/rpc/complete_organiser_onboarding_v1*', (r) => {
    calls.push(r.request().postData() ?? '');
    const a = answers.length > 1 ? answers.shift()! : answers[0];
    if (a === 'abort') return r.abort('internetdisconnected');
    return a.status ? r.fulfill({ status: a.status, contentType: 'application/json', body: JSON.stringify(a.body) }) : json(r, a.body);
  });
  await page.route(`**/rest/v1/organiser_profiles?*id=eq.${ORG}*`, (r) =>
    json(r, { id: ORG, name: ORG_NAME, avatar_url: 'https://img.example/l.png', website: 'https://ritmo.example', instagram: 'ritmo', socials: null, organisation_category: 'Promoter', city_id: null }));
  await page.route('https://img.example/**', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>' }));
  await page.goto(`/account/p3/start?o=${ORG}&at=review`);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  const mounted = await page.getByTestId('p3-ob-title').waitFor({ timeout: 15_000 }).then(() => true, () => false);
  // Skip ONLY when the flag is off. With it on (e2e-smoke.yml sets it) an unmounted page is a FAILURE,
  // not a skip: scripts/check-p3-specs-not-skipped.mjs holds every P3 skip to this shape.
  test.skip(!mounted && process.env.VITE_ENABLE_ORGANISER_P3 !== 'true', 'organiserP3 is off in this server: /account/p3 is not mounted');
  return calls;
}

async function check(page: Page, name: string, size: { width: number; height: number }, theme: string) {
  await page.waitForTimeout(400); // the slide-in
  const r = await page.evaluate(() => {
    const shell = document.querySelector('.p3-ob') as HTMLElement;
    const main = document.querySelector('.p3-ob-main') as HTMLElement;
    const small: string[] = [];
    for (const el of Array.from(shell.querySelectorAll('button, a'))) {
      const b = el.getBoundingClientRect();
      if (!b.width || (el as HTMLElement).classList.contains('p3-ob-sr')) continue;
      if (b.height < 43.5 || b.width < 43.5) small.push(`${el.tagName}.${(el as HTMLElement).className} ${Math.round(b.width)}x${Math.round(b.height)}`);
    }
    return { main: main.scrollHeight - main.clientHeight, shell: shell.scrollHeight - shell.clientHeight, wide: document.documentElement.scrollWidth - window.innerWidth, bottom: Math.round(shell.getBoundingClientRect().bottom), scrollY: window.scrollY, small };
  });
  expect.soft(r.main, `${name} scrolls`).toBeLessThanOrEqual(0);
  expect.soft(r.shell, `${name} shell scrolls`).toBeLessThanOrEqual(0);
  expect.soft(r.wide, `${name} wider than the viewport`).toBeLessThanOrEqual(0);
  expect.soft(r.bottom, `${name} taller than the viewport`).toBeLessThanOrEqual(size.height);
  expect.soft(r.scrollY, `${name} page scrolled`).toBe(0);
  expect.soft(r.small, `${name} small tap targets`).toEqual([]);
  await page.screenshot({ path: `${SHOTS}/${name}-${size.width}x${size.height}-${theme}.png` });
}

const LIVE = { body: { ok: true, changed: true, lifecycle: 'live', review: false } };
const SENT = { body: { ok: true, changed: true, lifecycle: 'pending_review', review: true } };
const INCOMPLETE = { body: { ok: false, reason: 'incomplete', missing: ['org_logo'] } };

for (const size of SIZES) {
  for (const theme of ['light', 'dark'] as const) {
    test.describe(`go live at ${size.width}x${size.height}, ${theme}`, () => {
      test.beforeEach(async ({ page }) => page.setViewportSize(size));

      test('Review ready -> Live', async ({ page }) => {
        const calls = await open(page, { lifecycle: 'draft', answers: [LIVE], theme });
        await expect(page.getByTestId('p3-ob-title')).toHaveText('All set');
        await check(page, 'review-ready', size, theme);
        await page.getByTestId('p3-ob-continue').dblclick();
        await expect(page.getByTestId('p3-ob-shell')).toHaveAttribute('data-screen', 'live');
        await expect(page.getByTestId('p3-ob-title')).toHaveText('You\u2019re live');
        expect(calls).toHaveLength(1);
        await check(page, 'live', size, theme);
      });

      test('Review ready -> Sent for a quick check (review variant)', async ({ page }) => {
        await open(page, { lifecycle: 'draft', answers: [SENT], theme });
        await page.getByTestId('p3-ob-continue').click();
        await expect(page.getByTestId('p3-ob-shell')).toHaveAttribute('data-screen', 'live-review');
        await expect(page.getByTestId('p3-ob-title')).toHaveText('Sent for a quick check');
        await expect(page.getByText('You\u2019re live')).toHaveCount(0);
        await check(page, 'live-review', size, theme);
      });

      test('Review incomplete (server refusal) lists the missing step', async ({ page }) => {
        await open(page, { lifecycle: 'draft', answers: [INCOMPLETE], theme });
        await page.getByTestId('p3-ob-continue').click();
        await expect(page.getByTestId('p3-ob-golive-err')).toBeVisible();
        await expect(page.getByTestId('p3-ob-review-org_logo')).toBeVisible();
        expect(Number(await page.getByTestId('p3-ob-progress').getAttribute('aria-valuenow'))).toBeLessThan(100);
        await check(page, 'review-incomplete', size, theme);
      });

      test('Review of a page in review', async ({ page }) => {
        await open(page, { lifecycle: 'pending_review', answers: [SENT], theme });
        await expect(page.getByTestId('p3-ob-title')).toHaveText('Sent for a quick check');
        await check(page, 'review-pending', size, theme);
      });

      test('network failure -> Try again -> Live', async ({ page }) => {
        const calls = await open(page, { lifecycle: 'draft', answers: ['abort', LIVE], theme });
        await page.getByTestId('p3-ob-continue').click();
        await expect(page.getByTestId('p3-ob-golive-err')).toBeVisible();
        await expect(page.getByTestId('p3-ob-continue')).toHaveText('Try again');
        await check(page, 'review-error', size, theme);
        await page.getByTestId('p3-ob-continue').click();
        await expect(page.getByTestId('p3-ob-shell')).toHaveAttribute('data-screen', 'live');
        expect(calls).toHaveLength(2);
      });
    });
  }
}
