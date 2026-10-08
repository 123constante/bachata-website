import { test, expect, type Page } from '@playwright/test';
import { CITY, EMAIL, PHONE, openOrganiser, json } from './helpers/organiserFake';

// Onboarding / claim (W1) at /account/o for a signed-in user with no organiser yet, at 390x844:
// search, Claim only where the listed email is yours (Ask to join otherwise), a claim on a
// mailbox-proven session, the emailed code on a password session, a refused claim turning into
// a request with the reason shown, and create (name + city view of the same sheet) landing on
// Home. Replaces organiser-account-onboarding.spec.ts (the old /account UI is deleted). Every
// call is answered in the browser by helpers/organiserFake.ts.

test.use({ viewport: PHONE });

const LEEDS = 'a0000000-0000-4000-8000-0000000000c1'; // contact email is yours (case differs)
const MANCHESTER = 'a0000000-0000-4000-8000-0000000000c2'; // someone else's email

const result = (page: Page, name: string) => page.getByTestId('onboarding-result').filter({ hasText: name });

async function search(page: Page, opts: Parameters<typeof openOrganiser>[2] = {}, setup?: Parameters<typeof openOrganiser>[3]) {
  const fake = await openOrganiser(page, '/account/o', { noOrganiser: true, ...opts }, setup);
  await expect(page.getByTestId('org-onboarding')).toBeVisible();
  await expect(page.getByTestId('home-new-event')).toHaveCount(0);
  await page.getByTestId('onboarding-search').fill('Ritmo');
  await expect(page.getByTestId('onboarding-result')).toHaveCount(2);
  return fake;
}

test('offers Claim only where the listed email is yours, Ask to join otherwise', async ({ page }) => {
  await search(page);
  await expect(result(page, 'Ritmo Latino Leeds').getByTestId('onboarding-claim')).toBeVisible();
  await expect(result(page, 'Ritmo Latino Leeds').getByTestId('onboarding-request')).toHaveCount(0);
  await expect(result(page, 'Ritmo Manchester').getByTestId('onboarding-claim')).toHaveCount(0);
  await expect(result(page, 'Ritmo Manchester').getByTestId('onboarding-request')).toBeVisible();
  // A user who never asked sees no declined answer.
  await expect(page.getByTestId('onboarding-declined')).toHaveCount(0);
});

test('a mailbox-proven session claims, and Home then shows the organiser', async ({ page }) => {
  const fake = await search(page);
  await result(page, 'Ritmo Latino Leeds').getByTestId('onboarding-claim').click();
  await page.getByTestId('onboarding-claim-confirm').click();
  // The home re-read lists the organiser, so onboarding gives way to Home, which announces it.
  await expect(page.getByTestId('org-page-home')).toContainText('Ritmo Latino Leeds is yours');
  expect(fake.sent('claim_organiser_v1')).toEqual([{ p_organiser_id: LEEDS }]);
  await expect(page.getByTestId('home-empty')).toBeVisible();
  await expect(page.getByTestId('org-onboarding')).toHaveCount(0);
});

test('a password session proves the mailbox with an emailed code first, then claims', async ({ page }) => {
  const fake = await search(page, { method: 'password' });
  await result(page, 'Ritmo Latino Leeds').getByTestId('onboarding-claim').click();
  await expect(page.getByTestId('onboarding-claim-confirm')).toHaveCount(0);
  await page.getByTestId('email-code-send').click();
  await page.getByTestId('email-code-input').fill('12345678');
  expect(fake.sent('claim_organiser_v1')).toHaveLength(0);
  await page.getByTestId('email-code-verify').click();
  await expect.poll(() => fake.sent('claim_organiser_v1')).toEqual([{ p_organiser_id: LEEDS }]);
  const otp = fake.sent('auth:otp')[0];
  expect(otp).toMatchObject({ email: EMAIL, create_user: false });
  expect(fake.sent('auth:verify')[0]).toMatchObject({ email: EMAIL, token: '12345678', type: 'email' });
});

test('a refused claim turns into a request with the reason shown', async ({ page }) => {
  const fake = await search(page, {}, (f) => f.refuse('claim_organiser_v1', 'email_mismatch'));
  await result(page, 'Ritmo Latino Leeds').getByTestId('onboarding-claim').click();
  await page.getByTestId('onboarding-claim-confirm').click();
  await expect(page.getByTestId('onboarding-sheet-error')).toBeVisible();
  await expect(page.getByTestId('onboarding-sheet-error')).not.toContainText('email_mismatch');
  await page.getByTestId('onboarding-request-note').fill('I run the Tuesday classes');
  await page.getByTestId('onboarding-request-send').click();
  await expect(page.getByTestId('onboarding-done')).toContainText('Request sent');
  expect(fake.sent('request_organiser_access_v1')).toEqual([{ p_organiser_id: LEEDS, p_message: 'I run the Tuesday classes' }]);
  // The open request is listed as waiting for an answer.
  await expect(page.getByTestId('onboarding-pending-row')).toContainText('Ritmo Latino Leeds');
});

test('ask to join another organiser sends the note', async ({ page }) => {
  const fake = await search(page);
  await result(page, 'Ritmo Manchester').getByTestId('onboarding-request').click();
  await page.getByTestId('onboarding-request-note').fill('I teach there on Mondays');
  await page.getByTestId('onboarding-request-send').click();
  await expect(page.getByTestId('onboarding-done')).toContainText('Request sent');
  expect(fake.sent('request_organiser_access_v1')).toEqual([{ p_organiser_id: MANCHESTER, p_message: 'I teach there on Mondays' }]);
});

test('create: name and a city picked in a view of the same sheet, then Home', async ({ page }) => {
  const fake = await openOrganiser(page, '/account/o', { noOrganiser: true });
  await page.getByTestId('onboarding-create').click();
  const submit = page.getByTestId('onboarding-create-submit');
  await expect(submit).toBeDisabled();
  await expect(page.getByTestId('onboarding-create-missing')).toContainText('the organiser name and the city');
  await page.getByTestId('onboarding-create-name').fill('Salsa & Bachata Leeds');
  await page.getByTestId('onboarding-create-city').click();
  await page.getByTestId('onboarding-city-search').fill('Lon');
  await page.getByTestId('onboarding-city-option').first().click();
  await expect(page.getByTestId('onboarding-create-city')).toContainText('London');
  await expect(page.getByTestId('onboarding-create-name')).toHaveValue('Salsa & Bachata Leeds');
  await expect(page.getByTestId('onboarding-sheet')).toHaveCount(1);
  await submit.click();
  await expect.poll(() => fake.sent('create_organiser_profile_v1')).toEqual([
    { p_name: 'Salsa & Bachata Leeds', p_city_id: CITY.id, p_contact_email: EMAIL },
  ]);
  await expect(page.getByTestId('org-page-home')).toContainText('Salsa & Bachata Leeds is saved as a draft');
  await expect(page.getByTestId('home-empty')).toBeVisible();
});

test('a declined request is shown with the answer', async ({ page }) => {
  await openOrganiser(page, '/account/o', { noOrganiser: true }, (f) => {
    f.myRequests = [{ request_id: 'q1', organiser_id: MANCHESTER, organiser_name: 'Ritmo Manchester', status: 'declined', created_at: '2026-10-01T10:00:00Z', resolved_at: '2026-10-05T10:00:00Z' }];
  });
  await expect(page.getByTestId('onboarding-declined-row')).toContainText('Ritmo Manchester');
});

test('the first-time screen has a way out: Signed in as <email>, Not you? Sign out, asked first', async ({ page }) => {
  await openOrganiser(page, '/account/o', { noOrganiser: true });
  const line = page.getByTestId('onboarding-signedin-line');
  await expect(line).toContainText(`Signed in as ${EMAIL}`);
  await expect(line).toContainText('Not you?');
  const btn = page.getByTestId('onboarding-signout');
  await expect(btn).toHaveAccessibleName(`Sign out of ${EMAIL}`);
  expect((await btn.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // One tap only asks; "No" and Escape close it and the user is still signed in.
  await btn.click();
  await expect(page.getByTestId('onboarding-signout-yes')).toBeVisible();
  await page.getByTestId('onboarding-signout-no').click();
  await expect(page.getByTestId('onboarding-signout-yes')).toHaveCount(0);
  await btn.click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('onboarding-signout-yes')).toHaveCount(0);
  await expect(page.getByTestId('org-onboarding')).toBeVisible();
  // Confirming signs out; the guard then sends the now signed-out visitor to the sign-in page.
  await btn.click();
  await page.getByTestId('onboarding-signout-yes').click();
  await expect(page).toHaveURL(/\/auth\?mode=signin/);
  await expect(page.getByTestId('org-onboarding')).toHaveCount(0);
});

test('signed out, /account/o goes to sign-in with the return path', async ({ page }) => {
  await openOrganiser(page, '/account/o/team?o=x', { signedOut: true });
  await expect(page).toHaveURL(/\/auth\?.*returnTo=%2Faccount%2Fo%2Fteam%3Fo%3Dx/);
  await expect(page.getByTestId('org-shell')).toHaveCount(0);
});

// Kept from the old onboarding spec (login launch gate step 6; public header, not organiser
// UI): signed out, the header Sign in link is a 44px target and returns to the current page.
for (const width of [390, 1280]) {
  test(`signed out @${width}, the header Sign in link returns to the current page`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/auth/v1/**', (route) => json(route, {}));
    await page.route('**/rest/v1/**', (route) => json(route, []));
    await page.goto('/faq?q=1');
    const link = page.getByTestId('header-sign-in-link');
    await expect(link).toBeVisible();
    const box = (await link.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
    await link.click();
    await expect(page).toHaveURL(/\/auth\?mode=signin&returnTo=%2Ffaq%3Fq%3D1$/);
  });
}
