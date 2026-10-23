import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import { json } from '../e2e/helpers/organiserFake';
import type { Journey, Person } from '../journeys/publicEntryJourneys';
import { Backend, CODE, signinForm, signupForm, wire } from './helpers/journeyHarness';

// Slice 3c: the auth code screen states, on the PRODUCTION build at 390x844 with the in-browser
// fake backend: code box, 5 wrong codes locked, the sign-up consent line, the one-tap accept card.
// Screenshots land in docs/handover/shots-3c/. Each state is checked with axe.

const SHOTS = 'docs/handover/shots-3c';
const rowFor = (person: Person, auth: 'signup' | 'signin'): Journey => ({
  id: 'auth-consent', title: 'auth consent', entry: '/auth', person, auth, end: { path: '/', screen: '', state: '' },
});
const EXISTING: Person = { signedIn: false, dancer: 'complete', organisers: 0, userType: 'dancer' };
const NEW: Person = { signedIn: false, dancer: 'incomplete', organisers: 0, userType: 'dancer' };

async function shot(page: Page, name: string) {
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious').map((v) => v.id), `axe on ${name}`).toEqual([]);
}

async function rpcLog(page: Page, extrasConsents: unknown[] | null) {
  const log: string[] = [];
  await page.route('**/rest/v1/rpc/accept_terms_v1', (route) => {
    log.push('accept_terms_v1');
    return json(route, { kind: 'terms_privacy', already_accepted: false });
  });
  await page.route('**/rest/v1/rpc/record_auth_funnel_step_v1', (route) => {
    log.push(`funnel:${route.request().postData()}`);
    return json(route, null);
  });
  if (extrasConsents) await page.route('**/rest/v1/rpc/my_account_export_extras_v1', (route) => json(route, { consents: extrasConsents }));
  return log;
}

test('sign-in code box: send, code, 3 wrong codes lock (soft limit, flow 4d)', async ({ page }) => {
  const backend = new Backend(rowFor(EXISTING, 'signin'));
  await wire(page, backend);
  await rpcLog(page, null);
  await page.goto('/auth?mode=signin');
  await signinForm(page, async () => {});
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  const input = page.locator('input[autocomplete="one-time-code"]');
  await expect(input).toBeFocused();
  expect(await input.getAttribute('inputmode')).toBe('numeric');
  await expect(page.getByTestId('auth-consent')).toHaveCount(0);
  await shot(page, '1-code');
  // The server answers every wrong code as otp_expired; inside the code lifetime each one counts a try (review F5).
  backend.verifyFailures = 3;
  for (let i = 1; i <= 3; i += 1) {
    await expect(input).toBeEnabled();
    await input.pressSequentially('87654321');
    if (i < 3) await expect(page.getByText(`${3 - i} ${3 - i === 1 ? 'try' : 'tries'} left`, { exact: false })).toBeVisible();
  }
  await expect(page.getByText('Too many tries. Send a new code to carry on.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send a new code' })).toBeVisible();
  await expect(input).toBeDisabled();
  await shot(page, '2-wrong-x5-locked');
});

test('sign-up code box: consent line, recorded once on success', async ({ page }) => {
  const backend = new Backend(rowFor(NEW, 'signup'));
  // trackAuthStep skips automation (navigator.webdriver); this test asserts the (mocked) funnel call, so it
  // presents as a normal browser. Test-only: no URL flag or app code path does this in production.
  await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
  await wire(page, backend);
  const log = await rpcLog(page, null);
  await page.goto('/auth?mode=signup&userType=dancer');
  await signupForm(page, '/auth?mode=signup&userType=dancer', async () => {});
  await expect(page.getByTestId('auth-consent')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms');
  await expect(page.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
  await shot(page, '3-signup-consent-line');
  expect(log.filter((l) => l === 'accept_terms_v1')).toHaveLength(0);
  await page.locator('input[autocomplete="one-time-code"]').pressSequentially(CODE);
  await expect.poll(() => log.filter((l) => l === 'accept_terms_v1').length).toBe(1);
  // Settled, not just sampled: the hand-over to /auth/callback must not record a second time.
  await expect(page).toHaveURL(/\/(?!auth)/);
  await page.waitForTimeout(2500);
  expect(log.filter((l) => l === 'accept_terms_v1')).toHaveLength(1);
  expect(log.some((l) => l.startsWith('funnel:') && l.includes('code_ok'))).toBe(true);
});

test('sign-in with no acceptance on file: one-tap accept card', async ({ page }) => {
  const backend = new Backend(rowFor(EXISTING, 'signin'));
  await wire(page, backend);
  const log = await rpcLog(page, []);
  await page.goto('/auth?mode=signin');
  await signinForm(page, async () => {});
  await page.locator('input[autocomplete="one-time-code"]').pressSequentially(CODE);
  const card = page.getByTestId('terms-accept-card');
  await expect(card).toBeVisible();
  await expect(card.getByRole('button')).toHaveCount(1);
  await shot(page, '4-accept-card');
  await card.getByRole('button', { name: 'Accept and continue' }).click();
  await expect.poll(() => log.filter((l) => l === 'accept_terms_v1').length).toBe(1);
  await expect(card).toBeHidden();
});
