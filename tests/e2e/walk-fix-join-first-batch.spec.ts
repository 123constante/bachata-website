import { test, expect, type Page, type Route } from '@playwright/test';
import { FRIDAY, ORG, ORG_NAME, OrganiserFake, PHONE, json } from './helpers/organiserFake';

// Walk of PR #1291 (fix-join-first-batch) at 390x844: Home's grace banner, the gate sheet -> Review ->
// "Back to your event", and the used-link screen. Server answers are simulated at the network boundary (the
// OrganiserFake plus page.route), as arc1-invite-redeem-walk and p3-gate-sheet do. NOT in the CI gate list:
//   VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true npx playwright test tests/e2e/walk-fix-join-first-batch.spec.ts --project=chromium
// Pictures: docs/walk/fix-join-first-batch/<nn>-<state>.png. States are listed in INVENTORY.md.
test.use({ viewport: PHONE });

const SHOTS = 'docs/walk/fix-join-first-batch';
const EVENT = `/account/p3/events/${FRIDAY}`;
const TOKEN = 'ab12cd34'.repeat(8);
const CLOCK = new Date('2026-10-30T18:30:00Z');

const statusOf = (o: { person?: string[]; page?: string[]; complete?: boolean }) => ({
  v: 1, gate_on: true, is_admin: false, complete: o.complete ?? false,
  person: { complete: !(o.person ?? []).length, missing: o.person ?? [] },
  organisers: [{ id: ORG, name: ORG_NAME, role: 'owner', lifecycle: 'live', complete: !(o.page ?? []).length, missing: o.page ?? [], about: { done: true, skipped: false } }],
});
const LEFT5 = statusOf({ person: ['nationality', 'languages', 'teach_answer'], page: ['org_logo', 'contact_confirm'] });
const DONE = statusOf({ complete: true });

// ---- the checks every picture must pass -----------------------------------------------------------------
async function bar(page: Page, name: string, o: { primary: string | null; live?: boolean; root?: string }) {
  await page.waitForTimeout(500); // slide-ins
  const r = await page.evaluate((root) => {
    const scope = (root ? document.querySelector(root) : document.body) ?? document.body;
    const small: string[] = [];
    let controls = 0;
    for (const el of Array.from(scope.querySelectorAll<HTMLElement>('button, a[href]'))) {
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height || el.classList.contains('p3-ob-sr') || getComputedStyle(el).visibility === 'hidden') continue;
      controls++;
      if (b.height < 43.5) small.push(`${el.tagName} "${(el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(b.width)}x${Math.round(b.height)}`);
    }
    return { wide: document.documentElement.scrollWidth - window.innerWidth, small, controls, text: scope.textContent ?? '' };
  }, o.root ?? null);
  expect.soft(r.wide, `${name}: sideways scroll`).toBeLessThanOrEqual(0);
  expect.soft(r.small, `${name}: taps under 44px tall`).toEqual([]);
  if (o.primary) expect.soft(await page.getByTestId(o.primary).count(), `${name}: exactly one primary (${o.primary})`).toBe(1);
  if (o.live) expect.soft(r.controls, `${name}: a live control on the screen`).toBeGreaterThan(0);
  expect.soft(r.text, `${name}: never says "works as usual"`).not.toMatch(/works as usual/i);
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
  return r;
}

async function install(page: Page, status: unknown, opts: ConstructorParameters<typeof OrganiserFake>[0] = {}) {
  await page.clock.install({ time: CLOCK });
  const fake = new OrganiserFake(opts);
  await fake.install(page);
  await page.route('**/rest/v1/rpc/organiser_onboarding_status_v1*', (r) =>
    status === 'fail' ? json(r, { message: 'boom' }, 500) : json(r, status));
  await page.route('**/rest/v1/rpc/get_organiser_contact_settings_v1*', (r) =>
    json(r, { contact_phone: '+447700900123', contact_email: null, show_phone_publicly: true, show_email_publicly: false, claim_email: null }));
  await page.route(`**/rest/v1/organiser_profiles?*id=eq.${ORG}*`, (r) =>
    json(r, { id: ORG, name: ORG_NAME, avatar_url: 'https://img.example/l.png', website: 'https://ritmo.example', instagram: 'ritmo', socials: null, organisation_category: 'Promoter', city_id: null }));
  await page.route('https://img.example/**', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>' }));
  return fake;
}

// ---- (a) Home's grace banner ------------------------------------------------------------------------------
test.describe('(a) Home grace banner', () => {
  test('01 banner, 5 things left', async ({ page }) => {
    await install(page, LEFT5);
    await page.goto('/account/p3');
    await expect(page.getByTestId('p3-grace')).toBeVisible();
    await expect(page.getByTestId('p3-grace-body')).toHaveText('Finish your details first to create or edit events. It takes about five minutes.');
    await expect(page.getByTestId('p3-grace-count')).toHaveText('5 things left');
    await expect(page.getByTestId('p3-grace-go')).toHaveAttribute('href', `/account/p3/start?o=${ORG}&at=review`);
    await bar(page, '01-banner-5-left', { primary: 'p3-grace-go', live: true, root: '.p3-theme' });
  });
  test('02 banner hidden for today (Hide for today)', async ({ page }) => {
    await install(page, LEFT5);
    await page.goto('/account/p3');
    await page.getByTestId('p3-grace-hide').click();
    await expect(page.getByTestId('p3-grace')).toHaveCount(0);
    await bar(page, '02-banner-hidden-today', { primary: null, live: true, root: '.p3-theme' });
  });
  test('03 nothing left: no banner', async ({ page }) => {
    await install(page, DONE);
    await page.goto('/account/p3');
    await page.getByTestId('p3-home-settings').waitFor();
    await expect(page.getByTestId('p3-grace')).toHaveCount(0);
    await bar(page, '03-banner-none-complete', { primary: null, live: true, root: '.p3-theme' });
  });
  test('04 status read fails: no banner, Home still works', async ({ page }) => {
    await install(page, 'fail');
    await page.goto('/account/p3');
    await page.getByTestId('p3-home-settings').waitFor();
    await expect(page.getByTestId('p3-grace')).toHaveCount(0);
    await bar(page, '04-banner-read-failed', { primary: null, live: true, root: '.p3-theme' });
  });
});

// ---- (b) gate sheet -> Review -> Back to your event ---------------------------------------------------------
const REFUSAL = { code: 'P0001', message: 'onboarding_incomplete', details: JSON.stringify({ missing: ['nationality', 'org_logo'], organiser_id: ORG }), hint: 'Finish your details' };

test.describe('(b) gate sheet, Review, Back to your event', () => {
  test('05 gate sheet, then Continue lands on Review that ends "Go to Home" (items left)', async ({ page }) => {
    await install(page, LEFT5);
    await page.route('**/rest/v1/rpc/series_command_p5*', (r: Route) => json(r, REFUSAL, 400));
    await page.goto(EVENT);
    await page.getByTestId('p3-open-status').click();
    await page.locator('[data-testid^="p3-status-row-"]').first().click();
    await expect(page.getByTestId('p3-gate')).toBeVisible();
    const go = page.getByTestId('p3-gate-go');
    await expect(go).toHaveAttribute('href', `/account/p3/start?o=${ORG}&at=review&back=${encodeURIComponent(EVENT)}`);
    await bar(page, '05-gate-sheet', { primary: 'p3-gate-go', live: true, root: '[role="dialog"]' });
    await go.click();
    await expect(page).toHaveURL(new RegExp(`back=${encodeURIComponent(EVENT).replace(/%/g, '%')}`));
    await page.getByTestId('p3-ob-continue').waitFor();
    await page.waitForTimeout(800);
    await expect(page.getByTestId('p3-ob-continue')).not.toHaveText('Back to your event');
    await bar(page, '06-review-items-left-with-back', { primary: 'p3-ob-continue', live: true, root: '.p3-ob' });
  });

  const REVIEW: Array<[string, string, string | null]> = [
    ['07-review-done-back-valid-event', `&back=${encodeURIComponent(EVENT)}`, EVENT],
    ['08-review-done-back-absent', '', null],
    ['09-review-done-back-foreign', `&back=${encodeURIComponent('https://evil.example' + EVENT)}`, null],
    ['10-review-done-back-non-event-path', `&back=${encodeURIComponent('/account/p3/you')}`, null],
    ['11-review-done-back-bad-id', `&back=${encodeURIComponent('/account/p3/events/a b!/x/y')}`, null],
  ];
  for (const [name, qs, lands] of REVIEW) {
    test(`${name}: ${lands ? 'Back to your event, lands on the event' : 'Go to Home'}`, async ({ page }) => {
      await install(page, DONE);
      await page.goto(`/account/p3/start?o=${ORG}&at=review${qs}`);
      const btn = page.getByTestId('p3-ob-continue');
      await btn.waitFor();
      await expect(btn).toHaveText(lands ? 'Back to your event' : 'Go to Home');
      expect(await page.getByText('Back to your event').count(), 'Back to your event only with a valid event').toBe(lands ? 1 : 0);
      await bar(page, name, { primary: 'p3-ob-continue', live: true, root: '.p3-ob' });
      await btn.click();
      if (lands) await expect(page).toHaveURL(new RegExp(`${EVENT}$`));
      else await expect(page).toHaveURL(/\/account\/p3\/?(\?.*)?$/);
    });
  }
});

// ---- (c) the used-link screen ---------------------------------------------------------------------------------
const previewUsed = (name: string) => ({ status: 'used', organiser_name: name, inviter_first_name: 'Diego', email_hint: null });

async function openUsed(page: Page, o: { signedOut: boolean; name: string; redeem: unknown }) {
  const fake = await install(page, DONE, { signedOut: o.signedOut });
  await page.route('**/rest/v1/rpc/organiser_invite_preview_v1*', (r) => json(r, previewUsed(o.name)));
  await page.route('**/rest/v1/rpc/redeem_organiser_invite_v1*', (r) => json(r, o.redeem));
  await page.route('**/rest/v1/rpc/request_new_invite_v1*', (r) => json(r, { ok: true }));
  await page.goto(`/invite/${TOKEN}`);
  return fake;
}

test.describe('(c) used link /invite/:token', () => {
  test('12 signed out: "You already joined" + Sign in', async ({ page }) => {
    await openUsed(page, { signedOut: true, name: 'Salsa Norte', redeem: { ok: false, reason: 'used' } });
    await page.getByTestId('invite-used-sign-in').waitFor();
    await expect(page.locator('h1')).toContainText('You already joined');
    await bar(page, '12-used-signed-out', { primary: 'invite-used-sign-in', live: true, root: '[data-testid="join-step"]' });
  });
  test('13 the redeemer: lands on their page home, not the link', async ({ page }) => {
    await openUsed(page, { signedOut: false, name: ORG_NAME, redeem: { ok: true, status: 'already_member', organiser_id: ORG } });
    await expect(page).toHaveURL(new RegExp(`/account/p3\\?o=${ORG}`));
    await page.getByTestId('p3-home-settings').waitFor();
    await bar(page, '13-used-redeemer-lands-home', { primary: null, live: true, root: '.p3-theme' });
  });
  test('14 a different account: "not on the team" + switch', async ({ page }) => {
    await openUsed(page, { signedOut: false, name: 'Salsa Norte', redeem: { ok: false, reason: 'used' } });
    await page.getByTestId('invite-used-switch').waitFor();
    await expect(page).toHaveURL(/\/invite/);
    await bar(page, '14-used-other-account', { primary: 'invite-used-switch', live: true, root: '[data-testid="join-step"]' });
  });
  test('15 redeemer whose page list has a same-name page but the server says used: still the other-account screen', async ({ page }) => {
    // the fake's own list carries ORG_NAME; redeem answers used (not already_member), so it is FINAL: not on the team
    await openUsed(page, { signedOut: false, name: ORG_NAME, redeem: { ok: false, reason: 'used' } });
    await page.getByTestId('invite-used-switch').waitFor();
    await expect(page).toHaveURL(/\/invite/);
    await bar(page, '15-used-same-name-page', { primary: 'invite-used-switch', live: true, root: '[data-testid="join-step"]' });
  });
});
