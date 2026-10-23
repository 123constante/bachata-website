import { test, expect, type Page, type Route } from '@playwright/test';
import { checkOverflow, fakeSupabase, settled } from './helpers';
import { FAKE_ORIGIN, FAKE_REF } from './fakeSupabase.mjs';

/**
 * W1 Option B join on /invite at a PHONE size (390x844): every screen of the step table and every
 * error screen, each with no sideways scroll and its primary control >= 44px tall and on screen.
 * Nothing reaches any database: fakeSupabase.mjs answers the app, and the invite RPCs, the OTP
 * endpoints and the dancer-profile reads are answered here per scenario (registered AFTER the
 * fake, so they take precedence). SHOTS=<dir> also writes the design-pack screenshots
 * (docs/design/978/): the owner reviews every error screen there, since none has a prototype.
 */

test.use({ viewport: { width: 390, height: 844 } });

const TOKEN = 'ab12cd34'.repeat(8);
const ORG = 'Ritmo Bachata London';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const EMAIL = 'ana@example.com';
const USER = { id: USER_ID, aud: 'authenticated', role: 'authenticated', email: EMAIL, user_metadata: {}, email_confirmed_at: '2026-10-15T10:00:00Z', last_sign_in_at: null };
const b64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const JWT = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: USER_ID, role: 'authenticated', amr: [{ method: 'otp', timestamp: 1 }] })}.sig`;
const SESSION = { access_token: JWT, token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'r', user: USER };

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

const previewOf = (status: string, extra: Record<string, unknown> = {}) => ({ status, organiser_name: ORG, inviter_first_name: 'Diego', email_hint: null, ...extra });
const PERSON = { person: { first_name: 'Papacito', avatar_url: null, city: 'London' } };

interface Scenario {
  signedIn?: boolean;
  preview?: unknown;
  /** dancer profile of the signed-in person: 'complete' | 'incomplete' | 'none' */
  profile?: 'complete' | 'incomplete' | 'none';
  member?: boolean;
  redeem?: unknown;
  bind?: unknown;
  claim?: unknown;
  otp?: { body: unknown; status?: number } | 'network';
  verify?: { body: unknown; status?: number };
  previewFails?: boolean;
  redeemFails?: boolean;
}

async function openInvite(page: Page, s: Scenario, url = `/invite/${TOKEN}`) {
  await fakeSupabase(page, { realClock: true });
  if (s.signedIn) {
    await page.addInitScript(({ value, ref }) => localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(value)), { value: SESSION, ref: FAKE_REF });
  }
  const profile = s.profile ?? 'complete';
  await page.route(`${FAKE_ORIGIN}/auth/v1/user*`, (r) => (s.signedIn ? json(r, USER) : json(r, { message: 'no session' }, 401)));
  await page.route(`${FAKE_ORIGIN}/auth/v1/otp*`, (r) => (s.otp === 'network' ? r.abort('failed') : json(r, s.otp?.body ?? {}, s.otp?.status ?? 200)));
  await page.route(`${FAKE_ORIGIN}/auth/v1/verify*`, (r) => json(r, s.verify?.body ?? SESSION, s.verify?.status ?? 200));
  await page.route(`${FAKE_ORIGIN}/rest/v1/rpc/organiser_invite_preview_v1*`, (r) => (s.previewFails ? r.abort('failed') : json(r, s.preview ?? previewOf('open'))));
  await page.route(`${FAKE_ORIGIN}/rest/v1/rpc/bind_organiser_invite_email_v1*`, (r) => json(r, s.bind ?? { status: 'bound' }));
  await page.route(`${FAKE_ORIGIN}/rest/v1/rpc/redeem_organiser_invite_v1*`, (r) => (s.redeemFails ? r.abort('failed') : json(r, s.redeem ?? { ok: true, status: 'redeemed', organiser_id: 'o1' })));
  await page.route(`${FAKE_ORIGIN}/rest/v1/rpc/request_new_invite_v1*`, (r) => json(r, { ok: true }));
  await page.route(`${FAKE_ORIGIN}/rest/v1/rpc/set_my_role_intent_v1*`, (r) => json(r, { ok: true, roles: ['dancer', 'organiser'] }));
  await page.route(`${FAKE_ORIGIN}/rest/v1/rpc/claim_my_dancer_profile_v1*`, (r) => json(r, s.claim ?? { ok: true, status: 'not_applicable', profile_id: null }));
  await page.route(`${FAKE_ORIGIN}/rest/v1/rpc/_my_dancer_profile_id_v1*`, (r) => json(r, profile === 'none' ? null : 'persona-1'));
  await page.route(`${FAKE_ORIGIN}/rest/v1/rpc/profile_complete_v1*`, (r) => json(r, profile === 'complete'));
  await page.route(`${FAKE_ORIGIN}/rest/v1/dancer_profiles*`, (r) => json(r, { first_name: 'Ana', based_city_id: null, dance_role: null, avatar_url: null }));
  await page.route(`${FAKE_ORIGIN}/rest/v1/rpc/organiser_home_v1*`, (r) => json(r, { today: '2026-10-15', organisers: s.member ? [{ id: 'o1', name: ORG }] : [] }));
  await page.goto(url);
  await page.getByTestId('join-step').waitFor();
  await settled(page);
}

const shot = async (page: Page, name: string) => {
  // The design pack is the 390x844 run only; the 360x640 project keeps its shots in the test output.
  const pack = process.env.SHOTS && page.viewportSize()?.width === 390;
  const path = pack ? `${process.env.SHOTS}/${name}.png` : test.info().outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: false });
};

async function expectStep(page: Page, step: string, stop?: string) {
  await expect(page.getByTestId('join-step')).toHaveAttribute('data-step', step);
  if (stop) await expect(page.getByTestId('join-step')).toHaveAttribute('data-stop', stop);
}

/** The screen's primary control: >= 44px tall, fully on screen, and the thing under its centre is itself. */
async function primaryHittable(page: Page, testId: string) {
  const el = page.getByTestId(testId).first();
  await expect(el).toBeVisible();
  const b = (await el.boundingBox())!;
  expect(b.height, `${testId} height`).toBeGreaterThanOrEqual(44);
  expect(b.y, `${testId} top`).toBeGreaterThanOrEqual(0);
  expect(b.y + b.height, `${testId} bottom`).toBeLessThanOrEqual(844 + 0.5);
  const hit = await el.evaluate((node) => {
    const r = node.getBoundingClientRect();
    const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return at === node || node.contains(at);
  });
  expect(hit, `${testId} is what a tap reaches`).toBe(true);
}

async function screenOk(page: Page, name: string, primary: string) {
  await checkOverflow(page);
  await primaryHittable(page, primary);
  await shot(page, name);
}

const codeUrl = `/invite/${TOKEN}?step=code&email=${encodeURIComponent(EMAIL)}`;

test.describe('the step table', () => {
  test('01 email, page invite', async ({ page }) => {
    await openInvite(page, {});
    await expectStep(page, 'email');
    await expect(page.getByTestId('join-strip')).toContainText('Diego invited you to manage Ritmo Bachata London');
    await expect(page.getByTestId('join-progress-count')).toHaveText('Step 1 of 3');
    // The send button is disabled until something is typed: measure the field instead.
    await checkOverflow(page);
    await primaryHittable(page, 'join-email-input');
    await shot(page, '01-email');
  });

  test('02 email, person-bound invite ("Hi Papacito")', async ({ page }) => {
    await openInvite(page, { preview: previewOf('open', { ...PERSON, email_hint: 'p***@sensualvibes.example' }) });
    await expectStep(page, 'email');
    await expect(page.getByTestId('join-person-hi')).toHaveText('Hi Papacito');
    await expect(page.getByTestId('join-person-card')).toContainText('London');
    await checkOverflow(page);
    await shot(page, '02-email-person');
  });

  test('03 code: 8 boxes, sent to the full email, resend in 60 s', async ({ page }) => {
    await openInvite(page, {});
    await page.getByTestId('join-email-input').fill(EMAIL);
    await page.getByTestId('join-send').click();
    await expectStep(page, 'code');
    await expect(page).toHaveURL(new RegExp(`step=code&email=${encodeURIComponent(EMAIL).replace(/\./g, '\\.')}`));
    await expect(page.getByTestId('join-sent-to')).toContainText(EMAIL);
    await expect(page.getByTestId('join-resend')).toContainText(/Resend code in \d+s/);
    await checkOverflow(page);
    await screenOk(page, '03-code', 'join-resend');
  });

  test('03b code: a wrong code stays on the boxes with what to do', async ({ page }) => {
    await openInvite(page, { verify: { body: { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' }, status: 403 } }, codeUrl);
    await page.locator('input[autocomplete="one-time-code"]').fill('12345678');
    await expect(page.getByTestId('join-code-error')).toContainText('That code is wrong or has run out');
    await expectStep(page, 'code');
    await screenOk(page, '03b-code-wrong', 'join-resend');
  });

  test('04 about: verified code, unfinished profile -> About you inline (step 2 of 3), then Join', async ({ page }) => {
    await openInvite(page, { profile: 'incomplete' }, codeUrl);
    await page.locator('input[autocomplete="one-time-code"]').fill('12345678');
    await expectStep(page, 'about');
    await expect(page).toHaveURL(new RegExp(`/invite/${TOKEN}$`));
    await expect(page.getByTestId('join-progress-count')).toHaveText('Step 2 of 3');
    await expect(page.getByTestId('join-about-save')).toBeDisabled();
    await expect(page.getByTestId('join-about-why')).toContainText('Still to add');
    await checkOverflow(page);
    await shot(page, '04-about');
  });

  test('05 join + 06 done: one tap, the done screen, the token gone from the address bar', async ({ page }) => {
    await openInvite(page, { signedIn: true });
    await expectStep(page, 'join');
    await expect(page.getByTestId('join-progress-count')).toHaveText('Step 2 of 2');
    await expect(page.getByTestId('join-org-card')).toContainText(ORG);
    await screenOk(page, '05-join', 'invite-join');
    await page.getByTestId('invite-join').click();
    await expectStep(page, 'done');
    await expect(page.getByTestId('join-done')).toContainText(ORG);
    await expect(page).toHaveURL(/\/invite$/);
    await screenOk(page, '06-done', 'join-done-home');
  });

  test('06b already on the team: done without a tap', async ({ page }) => {
    await openInvite(page, { signedIn: true, member: true });
    await expectStep(page, 'done');
  });

  test('07 wrong account: signed in as someone else', async ({ page }) => {
    await openInvite(page, { signedIn: true, preview: previewOf('open', { email_hint: 'd***@ritmo.example' }) });
    await expectStep(page, 'wrong_account');
    await expect(page.getByTestId('invite-email-hint')).toContainText('d***@ritmo.example');
    await screenOk(page, '07-wrong-account', 'invite-switch-account');
  });

  for (const status of ['used', 'expired', 'revoked'] as const) {
    test(`08 dead (${status}): why, and ask Diego for a new one`, async ({ page }) => {
      await openInvite(page, { preview: previewOf(status) });
      await expectStep(page, 'dead');
      await expect(page).toHaveURL(/\/invite$/);
      await screenOk(page, `08-dead-${status}`, 'invite-new-link');
      await page.getByTestId('invite-new-link').click();
      await expect(page.getByTestId('invite-new-link-done')).toBeVisible();
      await shot(page, `08-dead-${status}-asked`);
    });
  }

  test('08d dead (unknown link): no ask button', async ({ page }) => {
    await openInvite(page, { preview: {} });
    await expectStep(page, 'dead');
    await expect(page.getByTestId('invite-new-link')).toHaveCount(0);
    await screenOk(page, '08-dead-invalid', 'invite-home');
  });

  test('09 checking: the skeleton while the preview loads', async ({ page }) => {
    await fakeSupabase(page, { realClock: true });
    await page.route(`${FAKE_ORIGIN}/rest/v1/rpc/organiser_invite_preview_v1*`, () => undefined);
    await page.goto(`/invite/${TOKEN}`);
    await expectStep(page, 'checking');
    await expect(page.getByTestId('invite-checking')).toBeVisible();
    await checkOverflow(page);
    await shot(page, '09-checking');
  });
});

test.describe('error screens (no prototype: the owner reviews these shots)', () => {
  test('E1 blocked email domain (403): WhatsApp help + use another email', async ({ page }) => {
    await openInvite(page, { otp: { body: { code: 403, msg: 'Sign-up with this email provider is not accepted', message: 'Sign-up with this email provider is not accepted' }, status: 403 } });
    await page.getByTestId('join-email-input').fill('ana@blocked.example');
    await page.getByTestId('join-send').click();
    await expectStep(page, 'email', 'blocked_domain');
    await screenOk(page, 'E1-blocked-domain', 'join-help');
    await page.getByTestId('join-dismiss').click();
    await expect(page.getByTestId('join-email-input')).toBeVisible();
  });

  test('E2 rate limited when sending the code', async ({ page }) => {
    await openInvite(page, { otp: { body: { code: 429, error_code: 'over_email_send_rate_limit', msg: 'Email rate limit exceeded', message: 'Email rate limit exceeded' }, status: 429 } });
    await page.getByTestId('join-email-input').fill(EMAIL);
    await page.getByTestId('join-send').click();
    await expectStep(page, 'email', 'rate_limited');
    await screenOk(page, 'E2-rate-limited', 'join-retry');
  });

  test('E3 network failure when sending the code: try again', async ({ page }) => {
    await openInvite(page, { otp: 'network' });
    await page.getByTestId('join-email-input').fill(EMAIL);
    await page.getByTestId('join-send').click();
    await expectStep(page, 'email', 'network');
    await screenOk(page, 'E3-network', 'join-retry');
    await page.getByTestId('join-retry').click();
    await expect(page.getByTestId('join-email-input')).toBeVisible();
  });

  test('E4 email unproven after Join: sign out and get a code', async ({ page }) => {
    await openInvite(page, { signedIn: true, redeem: { ok: false, reason: 'email_unproven' } });
    await page.getByTestId('invite-join').click();
    await expectStep(page, 'join', 'email_unproven');
    await screenOk(page, 'E4-email-unproven', 'invite-switch-account');
  });

  test('E5 not linked (A2 refused the seat): the safety stop, "We\'ve told Diego"', async ({ page }) => {
    await openInvite(page, { signedIn: true, preview: previewOf('open', PERSON), redeem: { ok: false, reason: 'not_linked' } });
    await page.getByTestId('invite-join').click();
    await expectStep(page, 'join', 'not_linked');
    await expect(page.getByTestId('join-not-linked-body')).toContainText('told Diego');
    await screenOk(page, 'E5-not-linked', 'invite-switch-account');
  });

  test('E5b not linked right after the code (the claim found no match): one redeem, no duplicate', async ({ page }) => {
    await openInvite(page, { preview: previewOf('open', PERSON), claim: { ok: true, status: 'no_match', profile_id: null }, redeem: { ok: false, reason: 'not_linked' } }, codeUrl);
    await page.locator('input[autocomplete="one-time-code"]').fill('12345678');
    await expect(page.getByTestId('join-step')).toHaveAttribute('data-stop', 'not_linked');
    await expect(page.getByTestId('join-done')).toHaveCount(0);
  });

  test('E6 tied to another email (bound meanwhile)', async ({ page }) => {
    let served = 0;
    await openInvite(page, { bind: { status: 'already_bound' } });
    await page.route(`${FAKE_ORIGIN}/rest/v1/rpc/organiser_invite_preview_v1*`, (r) => json(r, previewOf('open', served++ === 0 ? {} : { email_hint: 'z***@other.example' })));
    await page.getByTestId('join-email-input').fill(EMAIL);
    await page.getByTestId('join-send').click();
    await expectStep(page, 'email', 'already_bound');
    await screenOk(page, 'E6-already-bound', 'invite-home');
  });

  test('E7 a refusal with no screen of its own (team_full): the shared words, home', async ({ page }) => {
    await openInvite(page, { signedIn: true, redeem: { ok: false, reason: 'team_full' } });
    await page.getByTestId('invite-join').click();
    await expectStep(page, 'join', 'refused');
    await expect(page.locator('body')).not.toContainText('team_full');
    await screenOk(page, 'E7-refused', 'invite-home');
  });

  test('E8 rate limited on Join', async ({ page }) => {
    await openInvite(page, { signedIn: true, redeem: { ok: false, reason: 'rate_limited' } });
    await page.getByTestId('invite-join').click();
    await expectStep(page, 'join', 'rate_limited');
    await screenOk(page, 'E8-rate-limited-join', 'join-retry');
  });

  test('E9 network failure on Join: try again', async ({ page }) => {
    await openInvite(page, { signedIn: true, redeemFails: true });
    await page.getByTestId('invite-join').click();
    await expectStep(page, 'join', 'network');
    await screenOk(page, 'E9-network-join', 'join-retry');
  });

  test('E10 the link lookup failed: try again', async ({ page }) => {
    await openInvite(page, { previewFails: true });
    await expectStep(page, 'unreachable');
    await screenOk(page, 'E10-unreachable', 'join-retry');
  });

  test('E11 no dancer profile at all', async ({ page }) => {
    await openInvite(page, { signedIn: true, profile: 'none' });
    await expectStep(page, 'no_profile');
    await checkOverflow(page);
    await shot(page, 'E11-no-profile');
  });

  test('E12 wrong account after Join (email_mismatch with the hint only in the answer)', async ({ page }) => {
    await openInvite(page, { signedIn: true, redeem: { ok: false, reason: 'email_mismatch', invite_email_hint: 'z***@other.example' } });
    await page.getByTestId('invite-join').click();
    await expectStep(page, 'join', 'wrong_account');
    await expect(page.getByTestId('invite-email-hint')).toContainText('z***@other.example');
    await screenOk(page, 'E12-wrong-account-after-join', 'invite-switch-account');
  });
});
