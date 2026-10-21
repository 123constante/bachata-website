import { test, expect, type Page } from '@playwright/test';
import { OrganiserFake, PHONE, json } from './helpers/organiserFake';

// Arc 1 PR 2 slice A: the redeem-side screens at 390x844, seeded fixtures only (no prod data).
// Screenshots land in docs/handovers/arc1-pr2-screens/. Not in the test:e2e gate list.
test.use({ viewport: PHONE });

const TOKEN = 'ab12cd34'.repeat(8);
const SHOTS = 'docs/handovers/arc1-pr2-screens';
// The route fades in: a shot taken the moment the card exists is blank, so let the transition settle first.
const shot = async (page: Page, opts: { path: string }) => {
  await page.waitForTimeout(2500);
  await page.screenshot(opts);
};
const noHScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

const previewOf = (status: string, extra: Record<string, unknown> = {}) => ({
  status, organiser_name: 'Ritmo Bachata London', inviter_first_name: 'Diego', email_hint: null, ...extra,
});

async function openInvite(page: Page, opts: { signedOut: boolean; preview: unknown; redeem?: unknown; newLink?: unknown }) {
  const fake = new OrganiserFake({ signedOut: opts.signedOut });
  await fake.install(page);
  await page.route('**/rest/v1/rpc/organiser_invite_preview_v1*', (r) => json(r, opts.preview));
  await page.route('**/rest/v1/rpc/redeem_organiser_invite_v1*', (r) => json(r, opts.redeem ?? { ok: true }));
  await page.route('**/rest/v1/rpc/request_new_invite_v1*', (r) => json(r, opts.newLink ?? { ok: true }));
  await page.goto(`/invite/${TOKEN}`);
}

test('open invite, signed out: names the page and the inviter, offers sign in', async ({ page }) => {
  await openInvite(page, { signedOut: true, preview: previewOf('open') });
  await expect(page.getByTestId('invite-card')).toContainText('Ritmo Bachata London');
  await expect(page.getByTestId('invite-sign-in')).toBeVisible();
  await noHScroll(page);
  await shot(page, { path: `${SHOTS}/01-open.png` });
});

for (const [i, status] of ['used', 'revoked', 'expired'].entries()) {
  test(`${status} invite: asks the sender for a new link`, async ({ page }) => {
    await openInvite(page, { signedOut: true, preview: previewOf(status) });
    const ask = page.getByTestId('invite-new-link');
    await expect(ask).toBeVisible();
    await expect(ask).toContainText('Diego');
    await noHScroll(page);
    await shot(page, { path: `${SHOTS}/0${i + 2}-${status}.png` });
    await ask.click();
    await expect(page.getByTestId('invite-new-link-done')).toBeVisible();
    await shot(page, { path: `${SHOTS}/0${i + 2}-${status}-asked.png` });
  });
}

test('unknown link: no ask button', async ({ page }) => {
  await openInvite(page, { signedOut: true, preview: {} });
  await expect(page.getByTestId('invite-card')).toBeVisible();
  await expect(page.getByTestId('invite-new-link')).toHaveCount(0);
  await shot(page, { path: `${SHOTS}/05-unknown.png` });
});

for (const [n, reason, title, button] of [
  ['06', 'email_mismatch', 'different email', 'Sign in with that email'],
  ['07', 'email_unproven', 'email link', 'Email me a sign-in link'],
] as const) {
  test(`signed in, ${reason}: refusal screen after Join`, async ({ page }) => {
    await openInvite(page, {
      signedOut: false,
      preview: previewOf('open', { email_hint: 'd***@ritmo.example' }),
      redeem: { ok: false, reason, invite_email_hint: 'd***@ritmo.example' },
    });
    await page.getByTestId('invite-join').click();
    await expect(page.getByTestId('invite-title')).toContainText(title);
    // Mockups 2d / 2e: the sign-out escape (review F1), never a plain /auth link.
    await expect(page.getByTestId('invite-switch-account')).toHaveText(button);
    await expect(page.getByTestId('invite-sign-in')).toHaveCount(0);
    await noHScroll(page);
    await shot(page, { path: `${SHOTS}/${n}-${reason}.png` });
  });
}

test('invite-only wall: Request access opens its own screen and sends', async ({ page }) => {
  await new OrganiserFake({ signedOut: true }).install(page);
  await page.route('**/rest/v1/rpc/account_exists_by_email*', (r) => json(r, false));
  await page.route('**/auth/v1/otp*', (r) => json(r, { code: 403, msg: 'Sign-up is limited to approved organisers.', message: 'Sign-up is limited to approved organisers.' }, 403));
  await page.route('**/rest/v1/rpc/request_signup_access_v1*', (r) => json(r, { ok: true }));
  await page.goto('/auth?mode=signup');
  await page.getByRole('button', { name: 'Continue as Dancer' }).click();
  await page.getByLabel('First name').fill('Ana');
  await page.locator('#signup-city').click();
  await page.getByText('London, United Kingdom').click();
  await page.getByText('Leader', { exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Email').fill('ana@example.com');
  await page.getByRole('button', { name: 'Email me a link' }).click();
  await expect(page.getByTestId('request-access-open')).toBeVisible();
  await shot(page, { path: `${SHOTS}/08-wall.png` });
  await page.getByTestId('request-access-open').click();
  await expect(page.getByTestId('request-access-screen')).toBeVisible();
  await shot(page, { path: `${SHOTS}/09-request-form.png` });
  await page.getByLabel('What events do you run?').fill('Friday socials');
  await page.getByTestId('request-access-send').click();
  await expect(page.getByTestId('request-access-done')).toBeVisible();
  await shot(page, { path: `${SHOTS}/10-request-sent.png` });
});

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
  await shot(page, { path: `${SHOTS}/11-code.png` });
  await code.fill('12345678');
  await expect(page.getByText(/tries? left|new code/i).first()).toBeVisible();
  await shot(page, { path: `${SHOTS}/12-code-wrong.png` });
});
