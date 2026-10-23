import { test, expect, type Page } from '@playwright/test';
import { EMAIL, ORG_NAME, OrganiserFake, PHONE, json } from './helpers/organiserFake';

// Arc 1 PR 2 slice A, rewritten for W1 (Option B, PLAN.md section 4): the /invite journey at 390x844
// against the OrganiserFake (seeded fixtures only, no prod data). Every step is derived from server
// truth, so a reload resumes where the server says. Not in the test:e2e gate list; run it by name:
//   npx playwright test tests/e2e/arc1-invite-redeem-walk.spec.ts --project=chromium
// Phone-size screenshots of every screen live in tests/e2e-phone/invite-join.phone.spec.ts (docs/design/978/).
test.use({ viewport: PHONE });

const TOKEN = 'ab12cd34'.repeat(8);
// The two /auth tests below keep their shots in the test output (the design pack is the phone suite's).
const shot = async (page: Page, opts: { path: string }) => {
  await page.waitForTimeout(500);
  await page.screenshot({ path: test.info().outputPath(opts.path.split('/').pop() ?? 'shot.png') });
};
const noHScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

// A page the fake's signed-in person is NOT on (their own list carries ORG_NAME): the Join card shows.
const previewOf = (status: string, extra: Record<string, unknown> = {}) => ({
  status, organiser_name: 'Salsa Norte', inviter_first_name: 'Diego', email_hint: null, ...extra,
});
const PERSON = { person: { first_name: 'Papacito', avatar_url: null, city: 'London' } };

interface Opts { signedOut: boolean; preview: unknown; redeem?: unknown; newLink?: unknown; claim?: unknown; dancerProfile?: 'none' }

async function openInvite(page: Page, opts: Opts, url = `/invite/${TOKEN}`) {
  const fake = new OrganiserFake({ signedOut: opts.signedOut, dancerProfile: opts.dancerProfile });
  await fake.install(page);
  // The invite RPCs are answered here (registered after the fake, so they win) and recorded in the fake's
  // one ordered call list, so order assertions see them next to the auth and persona calls.
  const rpc = (name: string, body: () => unknown) =>
    page.route(`**/rest/v1/rpc/${name}*`, (r) => {
      fake.calls.push({ rpc: name, body: r.request().postDataJSON?.() ?? {} });
      return json(r, body());
    });
  await rpc('organiser_invite_preview_v1', () => opts.preview);
  await rpc('bind_organiser_invite_email_v1', () => ({ status: 'bound' }));
  await rpc('redeem_organiser_invite_v1', () => opts.redeem ?? { ok: true, status: 'redeemed', organiser_id: 'o1' });
  await rpc('request_new_invite_v1', () => opts.newLink ?? { ok: true });
  await rpc('set_my_role_intent_v1', () => ({ ok: true, roles: ['dancer', 'organiser'] }));
  await rpc('claim_my_dancer_profile_v1', () => opts.claim ?? { ok: true, status: 'not_applicable', profile_id: null });
  await page.goto(url);
  await page.getByTestId('join-step').waitFor();
  return fake;
}

const step = (page: Page) => page.getByTestId('join-step');
const code = (page: Page) => page.locator('input[autocomplete="one-time-code"]');

test('the whole journey, signed out: email -> code -> Join -> done, one redeem, token gone, never off the page', async ({ page }) => {
  const fake = await openInvite(page, { signedOut: true, preview: previewOf('open') });
  await expect(step(page)).toHaveAttribute('data-step', 'email');
  await expect(page.getByTestId('join-strip')).toContainText('Diego invited you to manage Salsa Norte');
  await noHScroll(page);

  await page.getByTestId('join-email-input').fill(EMAIL);
  await page.getByTestId('join-send').click();
  await expect(step(page)).toHaveAttribute('data-step', 'code');
  await expect(page.getByTestId('join-sent-to')).toContainText(EMAIL);
  expect(await page.evaluate(() => localStorage.getItem('pending_role_intent'))).toBe(JSON.stringify(['dancer', 'organiser']));
  // ONE sign-in path, bound first: bind, then the OTP; no account_exists_by_email.
  const bindAt = fake.calls.findIndex((c) => c.rpc === 'bind_organiser_invite_email_v1');
  const otpAt = fake.calls.findIndex((c) => c.rpc === 'auth:otp');
  expect(bindAt).toBeGreaterThanOrEqual(0);
  expect(otpAt).toBeGreaterThan(bindAt);
  expect(fake.calls[otpAt].body).toMatchObject({ email: EMAIL, create_user: true });
  expect(fake.calls.some((c) => c.rpc === 'account_exists_by_email')).toBe(false);

  // A reload at the code step resumes there (the step is in the URL, the server decides the rest).
  await page.reload();
  await expect(step(page)).toHaveAttribute('data-step', 'code');

  await code(page).fill('12345678');
  await expect(step(page)).toHaveAttribute('data-step', 'join');
  await expect(page).toHaveURL(new RegExp(`/invite/${TOKEN}$`));
  // The claim ran before the persona read, then the silent roles.
  const claimAt = fake.calls.findIndex((c) => c.rpc === 'claim_my_dancer_profile_v1');
  const personaAt = fake.calls.findIndex((c, i) => c.rpc === '_my_dancer_profile_id_v1' && i > otpAt);
  expect(claimAt).toBeGreaterThanOrEqual(0);
  expect(personaAt === -1 || personaAt > claimAt).toBe(true);
  // The silent roles: stashed for the sign-up path before the OTP, cleared once the sign-in is handled (the
  // fake's session carries no email_confirmed_at, so the first-sign-in write itself is a unit-test fact).
  expect(await page.evaluate(() => localStorage.getItem('pending_role_intent'))).toBeNull();
  expect(fake.calls.filter((c) => c.rpc === 'redeem_organiser_invite_v1')).toHaveLength(0);

  await page.getByTestId('invite-join').click();
  await expect(step(page)).toHaveAttribute('data-step', 'done');
  await expect(page.getByTestId('join-done')).toContainText('Salsa Norte');
  expect(fake.calls.filter((c) => c.rpc === 'redeem_organiser_invite_v1')).toHaveLength(1);
  await expect(page).toHaveURL(/\/invite$/);
  await noHScroll(page);
});

test('person-bound invite: "Hi Papacito", the profile named, never an email on the card', async ({ page }) => {
  await openInvite(page, { signedOut: true, preview: previewOf('open', { ...PERSON, email_hint: 'p***@sensualvibes.example' }) });
  await expect(page.getByTestId('join-person-hi')).toHaveText('Hi Papacito');
  await expect(page.getByTestId('join-person-card')).toContainText('London');
  await expect(page.getByTestId('join-person-card')).not.toContainText('@');
  await noHScroll(page);
});

test('person-bound, the claim finds no match after the code: the safety stop, one redeem (the server records it), no duplicate', async ({ page }) => {
  // A2 server dependency: against the real E2E project this needs organiser_invites.person_profile_id and the not_linked outcome.
  const fake = await openInvite(page, {
    signedOut: true, preview: previewOf('open', PERSON), claim: { ok: true, status: 'no_match', profile_id: null }, redeem: { ok: false, reason: 'not_linked' },
  }, `/invite/${TOKEN}?step=code&email=${encodeURIComponent(EMAIL)}`);
  await code(page).fill('12345678');
  await expect(step(page)).toHaveAttribute('data-stop', 'not_linked');
  await expect(page.getByTestId('join-not-linked-body')).toContainText('told Diego');
  expect(fake.calls.filter((c) => c.rpc === 'redeem_organiser_invite_v1')).toHaveLength(1);
  await expect(page.getByTestId('join-done')).toHaveCount(0);
  await noHScroll(page);
});

test('signed in, already on the team: done without a tap, nothing redeemed', async ({ page }) => {
  const fake = await openInvite(page, { signedOut: false, preview: previewOf('open', { organiser_name: ORG_NAME }) });
  await expect(step(page)).toHaveAttribute('data-step', 'done');
  expect(fake.calls.filter((c) => c.rpc === 'redeem_organiser_invite_v1')).toHaveLength(0);
});

for (const status of ['used', 'revoked', 'expired']) {
  test(`${status} invite: asks the sender for a new link`, async ({ page }) => {
    await openInvite(page, { signedOut: true, preview: previewOf(status) });
    await expect(step(page)).toHaveAttribute('data-step', 'dead');
    const ask = page.getByTestId('invite-new-link');
    await expect(ask).toContainText('Diego');
    await expect(page).toHaveURL(/\/invite$/);
    await noHScroll(page);
    await ask.click();
    await expect(page.getByTestId('invite-new-link-done')).toBeVisible();
  });
}

test('unknown link: no ask button', async ({ page }) => {
  await openInvite(page, { signedOut: true, preview: {} });
  await expect(step(page)).toHaveAttribute('data-step', 'dead');
  await expect(page.getByTestId('invite-new-link')).toHaveCount(0);
});

for (const [reason, stop, text] of [
  ['email_mismatch', 'wrong_account', 'different email'],
  ['email_unproven', 'email_unproven', 'Sign in with a code'],
] as const) {
  test(`signed in, ${reason} after Join: its screen, sign out and continue (never a plain /auth link)`, async ({ page }) => {
    const fake = await openInvite(page, {
      signedOut: false,
      preview: previewOf('open', { email_hint: 'd***@ritmo.example' }),
      redeem: { ok: false, reason, invite_email_hint: 'd***@ritmo.example' },
    });
    await page.getByTestId('invite-join').click();
    await expect(step(page)).toHaveAttribute('data-stop', stop);
    await expect(page.locator('h1')).toContainText(text);
    await expect(page.getByTestId('invite-switch-account')).toBeVisible();
    await expect(page.getByTestId('invite-sign-in')).toHaveCount(0);
    expect(fake.calls.filter((c) => c.rpc === 'redeem_organiser_invite_v1')).toHaveLength(1);
    await noHScroll(page);
  });
}

// The 'invite-only wall' case was removed: sign-up is open (hook_before_user_created_v2 dancer_area_open) and
// /auth no longer has a 'Continue as Dancer' step, so it was red on main before this PR.

test('sign-in code screen: wrong code shows tries left', async ({ page }) => {
  await page.addInitScript(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.route('**/rest/v1/rpc/account_exists_by_email*', (r) => json(r, true));
  await page.route('**/auth/v1/otp*', (r) => json(r, {}));
  await page.route('**/auth/v1/verify*', (r) => json(r, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid', message: 'Token has expired or is invalid' }, 403));
  await page.goto('/auth?mode=signin');
  await page.getByLabel('Email').fill('ana@example.com');
  await page.getByRole('button', { name: /email me|send|continue/i }).first().click();
  const code = page.getByRole('textbox').first();
  await expect(code).toBeVisible();
  await shot(page, { path: `11-code.png` });
  await code.fill('12345678');
  await expect(page.getByText(/tries? left|new code/i).first()).toBeVisible();
  await shot(page, { path: `12-code-wrong.png` });
});
