import { test, expect, type Page, type Route } from '@playwright/test';
import { projectRef } from './helpers/organiserFake';

// Raffle v3 mocked walk at 390x844 of every winner (/raffle/win/:token) and door (/raffle/door/:token)
// screen. No prod data: every Supabase call is answered in the browser by page.route. Per state it
// asserts the verbatim h1/sub copy, no tap target under 44px, no sideways scroll, and saves a PNG to
// docs/design/raffle-v3/walk/<state>.png. Run with the flag on (no test.skip: flag off = FAIL); add VITE_ENABLE_RAFFLE_SHARE_POSTER=true to also walk the Share step:
//   VITE_ENABLE_RAFFLE_V2=true VITE_ENABLE_RAFFLE_SHARE_POSTER=true npx playwright test tests/e2e/raffle-v3-walk.spec.ts --project=chromium
// Tokens below are fake placeholders.

const WALK = 'docs/design/raffle-v3/walk';
const WIN = '/raffle/win/walk-link-token';
const DOOR = '/raffle/door/walk-qr-token';
const ME = '11111111-1111-4111-8111-111111111111';
const NIGHT_A = { occurrence_id: 'occ-a', title: 'Ritmo Friday', start_local: '2026-11-27T20:00:00' };
const NIGHT_B = { occurrence_id: 'occ-b', title: 'Sensual Sunday', start_local: '2026-11-29T19:30:00' };
const WIN_OK = { ok: true, first_name: 'Maya', win: { id: 'win-1', state: 'claimed' }, open_nights: [NIGHT_A, NIGHT_B] };

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

async function signIn(page: Page) {
  const user = { id: ME, aud: 'authenticated', role: 'authenticated', email: 'walk@example.test', is_anonymous: false, user_metadata: {} };
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: ME, role: 'authenticated' })}.sig`;
  await page.addInitScript(
    ({ value, ref }) => localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(value)),
    { value: { access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'r', user }, ref: projectRef },
  );
  await page.route('**/auth/v1/**', (route) => (route.request().url().includes('/auth/v1/user') ? json(route, user) : json(route, {})));
}

type Handler = (body: Record<string, unknown>, n: number) => { status?: number; body: unknown };
/** Mock every rpc; `handlers` answers the raffle ones, anything else gets an empty list. */
async function mock(page: Page, handlers: Record<string, Handler>) {
  const seen: Record<string, number> = {};
  await page.route('**/rest/v1/**', (route) => {
    const rpc = new URL(route.request().url()).pathname.match(/\/rpc\/([a-z0-9_]+)$/)?.[1];
    const h = rpc ? handlers[rpc] : undefined;
    if (!rpc || !h) return json(route, []);
    seen[rpc] = (seen[rpc] ?? 0) + 1;
    const out = h((route.request().postDataJSON?.() ?? {}) as Record<string, unknown>, seen[rpc]);
    return json(route, out.body, out.status ?? 200);
  });
  return seen;
}

async function check(page: Page, state: string, h1: string, sub?: string | RegExp) {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(h1, { timeout: 20_000 });
  if (sub !== undefined) await expect(page.locator('main p').first()).toHaveText(sub);
  // Let entry animations finish before measuring or shooting.
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))));
  const small = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll('main button, main a[href], main label'))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.height < 44 || r.width < 44) out.push(`${el.tagName} "${(el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return out;
  });
  expect(small, `${state}: tap targets under 44px`).toEqual([]);
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflowX, `${state}: no sideways scroll`).toBeLessThanOrEqual(0);
  await page.screenshot({ path: `${WALK}/${state}.png` });
}

test.use({ viewport: { width: 390, height: 844 } });

const SUB_WON = 'Free entry to a bachata night you have never been to. Pick which one.';
const SUB_PICK = 'Only nights you have never been to. Once you lock one, only the organiser can change it.';

test.describe('winner screens', () => {
  test('claim (signed out) -> Sign in to claim goes to Auth returnTo', async ({ page }) => {
    await mock(page, {});
    await page.route('**/auth/v1/**', (r) => json(r, { message: 'no session' }, 401));
    await page.goto(WIN);
    await check(page, 'claim', 'You won a free night', 'Sign in to claim it. This link works until an organiser cancels it, so keep it private.');
    await expect(page.getByText('The first account to sign in keeps the prize. Do not forward this link.')).toBeVisible();
    const g = page.getByRole('link', { name: 'Sign in to claim' });
    await expect(g).toHaveAttribute('href', `/auth?returnTo=${encodeURIComponent(WIN)}`);
  });

  test('won -> pick -> honest -> qr, with every button', async ({ page }) => {
    await signIn(page);
    await mock(page, {
      raffle_win_claim_link_v1: () => ({ body: WIN_OK }),
      raffle_win_lock_v2: (b) => ({ body: { ok: true, qr_token: 'walk-qr-token', win: { night: NIGHT_A }, p: b } }),
    });
    await page.goto(WIN);
    await check(page, 'won', 'You won!', SUB_WON);
    await expect(page.getByText('You are signed in, so no WhatsApp needed.')).toBeVisible();

    await page.getByRole('button', { name: 'Choose my night' }).click();
    await check(page, 'pick', 'Pick your night', SUB_PICK);
    const lock = page.getByRole('button', { name: 'Lock this night' });
    await expect(lock).toBeDisabled();
    const opt = page.getByRole('button', { name: /Ritmo Friday/ });
    await opt.click();
    await expect(opt).toHaveAttribute('aria-pressed', 'true');
    await lock.click();

    await check(page, 'honest', 'One last thing', 'Ritmo Friday, Fri 27 Nov, 20:00');
    const confirm = page.getByRole('button', { name: 'Confirm and get my QR' });
    await expect(confirm).toBeDisabled();
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pick your night');
    await page.getByRole('button', { name: /Ritmo Friday/ }).click();
    await page.getByRole('button', { name: 'Lock this night' }).click();
    await page.getByRole('checkbox', { name: 'I have never been to this event.' }).check();
    await expect(confirm).toBeEnabled();
    await confirm.click();

    // Flag raffleSharePoster on: the Share step sits between the lock and the QR. Off: straight to the QR.
    if (process.env.VITE_ENABLE_RAFFLE_SHARE_POSTER === 'true') {
      await check(page, 'share', 'Share your win', 'Tell your friends you are going. Your QR code is on the next screen.');
      await expect(page.getByRole('img', { name: 'Share poster: won a free night at Ritmo Friday' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Share', exact: true })).toBeEnabled();
      await expect(page.getByRole('button', { name: 'Save image' })).toBeEnabled();
      await page.getByRole('button', { name: 'Skip, show my QR' }).click();
    }

    await check(page, 'qr', 'You are in', 'Show this at the door. Ritmo Friday, Fri 27 Nov, 20:00');
    await expect(page.getByText('This code does not expire. Your organiser can cancel it.')).toBeVisible();
  });

  test('spot_taken sends back to pick with the night gone', async ({ page }) => {
    await signIn(page);
    await mock(page, {
      raffle_win_claim_link_v1: () => ({ body: WIN_OK }),
      raffle_win_lock_v2: () => ({ body: { ok: false, reason: 'spot_taken' } }),
    });
    await page.goto(WIN);
    await page.getByRole('button', { name: 'Choose my night' }).click();
    await page.getByRole('button', { name: /Ritmo Friday/ }).click();
    await page.getByRole('button', { name: 'Lock this night' }).click();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Confirm and get my QR' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pick your night');
    await expect(page.getByText('Someone else just took that night. Pick another.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Ritmo Friday/ })).toHaveCount(0);
  });

  test('none -> Check again refetches', async ({ page }) => {
    await signIn(page);
    const seen = await mock(page, {
      raffle_win_claim_link_v1: (_b, n) => ({ body: n === 1 ? { ok: true, win: { id: 'win-1', state: 'claimed' }, open_nights: [] } : WIN_OK }),
    });
    await page.goto(WIN);
    await check(page, 'none', 'No nights open right now', 'Check back soon. Your prize is kept.');
    await page.getByRole('button', { name: 'Check again' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('You won!');
    expect(seen.raffle_win_claim_link_v1).toBe(2);
  });

  test('cancel', async ({ page }) => {
    await signIn(page);
    await mock(page, { raffle_win_claim_link_v1: () => ({ body: { ok: false, reason: 'link_not_found' } }) });
    await page.goto(WIN);
    await check(page, 'cancel', 'This link is no longer valid', 'The organiser cancelled this prize. Message them if you think this is a mistake.');
  });

  test('other', async ({ page }) => {
    await signIn(page);
    await mock(page, { raffle_win_claim_link_v1: () => ({ body: { ok: false, reason: 'bound_to_other_account' } }) });
    await page.goto(WIN);
    await check(page, 'other', 'Already claimed', 'This prize was claimed by a different account. Message the organiser if that was not you.');
  });

  test('network error -> Retry', async ({ page }) => {
    await signIn(page);
    await mock(page, { raffle_win_claim_link_v1: (_b, n) => (n === 1 ? { status: 500, body: { message: 'boom' } } : { body: WIN_OK }) });
    await page.goto(WIN);
    await check(page, 'error', 'Something went wrong', 'Check your connection and try again.');
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('You won!');
  });
});

test.describe('door screens', () => {
  const VALID = { status: 'valid', name: 'Aisha K.', event: 'Ritmo Friday', date: '2026-11-27', admitted_at_local: '' };

  test('valid -> Admit -> admitted', async ({ page }) => {
    await mock(page, {
      raffle_door_check_v1: () => ({ body: VALID }),
      raffle_door_admit_v1: () => ({ body: VALID }),
    });
    await page.goto(DOOR);
    await check(page, 'door-valid', 'Valid prize');
    await expect(page.getByText('Aisha K.')).toBeVisible();
    await expect(page.getByText(/Ritmo Friday\s+·\s+Fri 27 Nov/)).toBeVisible();
    await page.getByRole('button', { name: 'Admit' }).click();
    await check(page, 'door-admitted', 'Admitted', 'Aisha K. is in. Marked as attended.');
  });

  test('already admitted (also when raced on the Admit tap)', async ({ page }) => {
    const done = { ...VALID, status: 'already_admitted', admitted_at_local: '21:14' };
    await mock(page, { raffle_door_check_v1: () => ({ body: done }) });
    await page.goto(DOOR);
    await check(page, 'door-already-admitted', 'Already admitted', 'This prize was used at 21:14. Do not admit again.');

    const raced = await page.context().newPage();
    await mock(raced, { raffle_door_check_v1: () => ({ body: VALID }), raffle_door_admit_v1: () => ({ body: done }) });
    await raced.goto(DOOR);
    await raced.getByRole('button', { name: 'Admit' }).click();
    await expect(raced.getByRole('heading', { level: 1 })).toHaveText('Already admitted');
  });

  test('not valid', async ({ page }) => {
    await mock(page, { raffle_door_check_v1: () => ({ body: { status: 'not_valid' } }) });
    await page.goto(DOOR);
    await check(page, 'door-not-valid', 'Not valid', 'This code is cancelled or for another night. Ask the organiser for help.');
  });

  test('network error -> Retry', async ({ page }) => {
    await mock(page, { raffle_door_check_v1: (_b, n) => (n === 1 ? { status: 500, body: { message: 'boom' } } : { body: VALID }) });
    await page.goto(DOOR);
    await check(page, 'door-error', 'Could not check', 'Check your connection and try again.');
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Valid prize');
  });
});
