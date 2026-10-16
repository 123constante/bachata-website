import { appendFileSync } from 'node:fs';
import { test, expect, devices, type Browser, type BrowserContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expectNoHorizontalScroll } from '../e2e/helpers/organiserFake';
import { JOURNEYS, type Journey } from '../journeys/publicEntryJourneys';
import { Backend, CODE, codeStep, isWelcome, onboarding, pathQuery, pressBack, signinForm, signupForm, trailOf, wire, nextStage, type Shot } from './helpers/journeyHarness';

// Every public way into an account (tests/journeys/publicEntryJourneys.ts, the SAME
// rows the routing-model spec walks) driven through the real UI of the PRODUCTION
// build (playwright.build.config.ts) at 390x844: the /auth sign-up or sign-in form,
// the e-mailed code (or link), /auth/callback, the dancer gate, every onboarding
// card the server's strength.missing asks for, the photo screen, and the end button
// -- to the row's END screen. The backend is mocked in the browser at the network
// layer (no Supabase project is touched): OrganiserFake for the organiser area, and
// the stateful auth + dancer fake (helpers/journeyHarness.ts) for the account, the persona stub a new
// e-mail gets at sign-up, and the dancer RPCs, whose strength/missing advance the
// way the server's does (fixtures.withDerived mirrors _dancer_strength_v1).
//
// Build with organiser self-serve ON (prod; /account/o redirects home without it):
//   VITE_ENABLE_ORGANISER_SELF_SERVE=true + the env in playwright.build.config.ts.
// Shots: docs/review-packs/public-journeys/<row.id>/NN-<step>.png.

const SHOTS = 'docs/review-packs/public-journeys';

/** The END screen of each end path: its test id, and the label the end-of-onboarding button must carry to go there. */
const END: Record<string, { testId: string; label?: string }> = {
  '/account/o': { testId: 'org-onboarding', label: 'Next: set up your organiser page' },
  '/app/home': { testId: 'dancer-screen-home', label: 'Go to Home' },
  '/account/continue': { testId: 'continue-as' },
  '/app/nights': { testId: 'dancer-screen-nights' },
  '/organisers/bachata-playground-phone-qa?claim=1': { testId: 'public-claim-card', label: 'Continue' },
  '/invite/0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0': { testId: 'invite-card', label: 'Next: join the team' },
};

/**
 * Rows whose END screen is not the default for their path: the test id that must show,
 * one that must NOT, the end-of-onboarding label, and the END element's own text.
 */
const END_BY_ROW: Record<string, { testId: string; absent?: string; label?: string; text?: string }> = {
  'organiser-link-organiser-signed-in': { testId: 'home-dates', absent: 'org-onboarding' },
  'organiser-link-open-request-signed-in': { testId: 'onboarding-pending-row' },
  'signin-unfinished-dancer-with-organiser': { testId: 'home-dates', absent: 'org-onboarding', label: 'Next: set up your organiser page' },
  'team-invite-existing-dancer': { testId: 'home-dates', absent: 'org-onboarding' },
  // M71: the end card's own button (only the 'in' and 'nice' cards carry it), never a question card.
  'bookmark-app-welcome-finished': { testId: 'onboarding-home', text: 'Go to Home' },
};

/**
 * Rows whose END screen has a KNOWN serious/critical axe violation: the axe rule ids still tolerated for that row,
 * each listed (element, reason) in docs/review-packs/account-grid/AXE.md. Empty = zero tolerated (GAPS G-A2).
 */
const AXE_KNOWN: Record<string, string[]> = {};

/** Rows the sandbox cannot drive to their END, with the one-line reason. Never a faked pass. */
const FIXME: Record<string, string> = {};

async function runRow(page: Page, context: BrowserContext, row: Journey, dir: string, browser: Browser) {
  const backend = new Backend(row);
  const trail: string[] = [];
  const walkLog = process.env.WALK_LOG;
  let n = 0;
  let current = page;
  let other: BrowserContext | null = null;
  const shot: Shot = async (step, what) => {
    n += 1;
    const file = `${dir}/${String(n).padStart(2, '0')}-${step}.png`;
    await current.screenshot({ path: file });
    if (walkLog) appendFileSync(walkLog, `${JSON.stringify({ row: dir.slice(SHOTS.length + 1), step, file, what })}\n`);
  };
  const end = END_BY_ROW[row.id] ?? END[row.end.path.split('?')[0]] ?? END[row.end.path];
  expect(end, `no END screen known for ${row.end.path}`).toBeTruthy();
  const incomplete = row.person.dancer !== 'complete';

  await wire(page, backend);
  trailOf(page, trail);
  // Back from the first card leaves for the page the person came from: give the tab one (the home page, where the banner is).
  if (row.midway === 'back-each-step') await page.goto('/');
  await page.goto(row.entry);

  if (row.person.signedIn) {
    // Already signed in: /auth sends them straight on, no form.
    await shot('entry', `entry ${row.entry} opened with a session`);
  } else {
    await expect(page.getByRole('progressbar').or(page.locator('#signin-email'))).toBeVisible();
    await shot('entry', `entry ${row.entry}: /auth ${row.auth === 'signin' ? 'sign in' : 'sign-up'} form`);
    if (row.auth === 'signin') {
      if (new URL(row.entry, 'https://x.test').searchParams.get('mode') !== 'signin') {
        // The sign-up link, an e-mail that already has an account: switch the form to Sign in.
        await page.getByRole('button', { name: 'Sign in', exact: true }).click();
        await expect(page).toHaveURL(/mode=signin/);
      }
      await signinForm(page, shot);
      await codeStep(page, shot, backend, false);
    } else {
      await signupForm(page, row.entry, shot);
      if (row.midway === 'magic-link-same-browser' || row.midway === 'expired-link') {
        await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
        await shot('code', 'code step: "Check your email"; the person opens the e-mail instead of typing the code');
        expect(backend.otpRedirect, 'the sign-up OTP carries the callback link').toBeTruthy();
        const link = new URL(backend.otpRedirect!);
        const tab = await context.newPage();
        await wire(tab, backend);
        trailOf(tab, trail);
        current = tab;
        if (row.midway === 'magic-link-same-browser') {
          backend.signedIn = true; // the link itself verifies the e-mail
          await tab.goto(`${link.pathname}${link.search}${backend.linkHash()}`);
        } else {
          await tab.goto(`${link.pathname}${link.search}#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`);
          await expect(tab).toHaveURL(/\/auth\?mode=signin&callbackError=expired/, { timeout: 20_000 });
          await expect(tab.getByTestId('auth-callback-notice')).toContainText('expired');
          expect(new URL(tab.url()).searchParams.get('returnTo')).toBe(new URL(row.entry, 'https://x.test').searchParams.get('returnTo'));
          await shot('expired-notice', '/auth sign in with the amber "That sign-in link has expired..." notice, returnTo kept');
          await signinForm(tab, shot);
          await codeStep(tab, shot, backend, false);
        }
        page = tab;
      } else if (row.midway === 'magic-link-other-context') {
        await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
        await shot('code', 'device 1, code step: "Check your email"; the person opens the e-mail on their phone instead');
        expect(backend.otpRedirect, 'the sign-up OTP carries the callback link').toBeTruthy();
        const link = new URL(backend.otpRedirect!);
        // Device 2: a second browser context (no shared storage), the link from the e-mail.
        other = await browser.newContext({ ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, baseURL: test.info().project.use.baseURL });
        const phone = await other.newPage();
        await wire(phone, backend);
        trailOf(phone, trail);
        backend.signedIn = true; // the link itself verifies the e-mail
        await phone.goto(`${link.pathname}${link.search}${backend.linkHash()}`);
        await phone.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 30_000 });
        // Device 1 then types the code the link already used up.
        backend.verifyFailures = 1;
        await page.locator('input[autocomplete="one-time-code"]').pressSequentially(CODE);
        await expect(page.getByText('That code is wrong or has expired')).toBeVisible();
        await shot('device1-code-used', 'device 1 after the link was used on device 2: "That code is wrong or has expired"');
        current = phone;
        page = phone;
      } else {
        await codeStep(page, shot, backend, row.midway === 'wrong-code-first');
      }
    }
  }

  if (row.then === 'continue-as-organiser') {
    await expect(page.getByTestId('continue-as')).toBeVisible({ timeout: 30_000 });
    await shot('continue-as', '"Continue as...": the person picks the organiser');
    await page.locator('[data-testid^="continue-as-organiser"]').first().click({ timeout: 15_000 });
  }

  if (incomplete) {
    await page.waitForURL((u) => isWelcome(u), { timeout: 30_000 });
    await nextStage(page, null);
    const first = await page.locator('section[data-testid^="onboarding-"]').first().getAttribute('data-testid');
    if (row.midway === 'reload') {
      await shot('midway-before-reload', `half way: ${first} on ${pathQuery(new URL(page.url()))}, about to reload`);
      await page.reload();
    } else if (row.midway === 'closed-tab-then-sign-in') {
      await shot('midway-before-close', `half way: ${first} on ${pathQuery(new URL(page.url()))}, the tab is closed`);
      const tab = await context.newPage();
      await wire(tab, backend);
      trailOf(tab, trail);
      await page.close();
      page = tab;
      current = tab;
      await page.goto('/');
      await expect(page.locator('header').first()).toBeVisible();
      await shot('reopen-home', 'later, a new tab on the home page (the session is kept: the header shows the account entry)');
      // A sign-in with no returnTo lands on /account/continue; the session is kept, so go there.
      await page.goto('/account/continue');
      await page.waitForURL((u) => isWelcome(u), { timeout: 30_000 });
    }
    const afterRequired = row.midway === 'closed-tab-after-required';
    const backEach = row.midway === 'back-each-step';
    await onboarding(page, shot, end.label, afterRequired ? 'close' : row.midway === 'reload' || backEach ? 'in' : 'nice', backEach);
    if (afterRequired) {
      await shot('midway-before-close', `required cards done: "You're in" on ${pathQuery(new URL(page.url()))}, the tab is closed`);
      const tab = await context.newPage();
      await wire(tab, backend);
      trailOf(tab, trail);
      await page.close();
      page = tab;
      current = tab;
      // A later header sign-in with no returnTo lands on /account/continue; the session is kept, so go there.
      await page.goto('/account/continue');
    }
  }

  if (row.then === 'join-team') {
    // Joining may ask first (a card with a join button) or redeem straight away; either way, on to the organiser Home.
    const join = page.getByTestId('invite-card').getByRole('button', { name: /join/i });
    await expect(page.getByTestId(end.testId).or(join)).toBeVisible({ timeout: 30_000 });
    if (await join.isVisible()) {
      await shot('invite-join', 'invite card: join the team');
      await join.click();
    }
  }

  const want = row.end.path;
  await expect(page).toHaveURL((u) => (want.includes('?') ? pathQuery(u) : u.pathname) === want, { timeout: 30_000 });
  await expect(page.getByTestId(end.testId), `END screen; hops: ${trail.slice(-8).map((t) => pathQuery(new URL(t))).join(' -> ')} (${trail.length} in all)`).toBeVisible({ timeout: 30_000 });
  if ('absent' in end && end.absent) await expect(page.getByTestId(end.absent)).toHaveCount(0);
  if ('text' in end && end.text) await expect(page.getByTestId(end.testId)).toHaveText(end.text);
  await expectNoHorizontalScroll(page);
  // GAPS G-A2: axe on every row's END, zero serious/critical (rules listed in AXE_KNOWN are the documented exceptions).
  const axe = await new AxeBuilder({ page }).analyze();
  const serious = axe.violations.filter((v) => (v.impact === 'serious' || v.impact === 'critical') && !(AXE_KNOWN[row.id] ?? []).includes(v.id));
  if (process.env.AXE_LOG) appendFileSync(process.env.AXE_LOG, `${JSON.stringify({ row: row.id, found: axe.violations.map((v) => ({ id: v.id, impact: v.impact, targets: v.nodes.map((n) => n.target.join(' ')).slice(0, 4) })) })}\n`);
  expect(serious.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`), 'axe: serious/critical violations at the END').toEqual([]);
  await shot('end', `END ${row.end.screen}: ${pathQuery(new URL(page.url()))}`);

  // The onward destination rode every onboarding hop (the owner's 2026-10-15 failure).
  const welcomes = trail.map((t) => new URL(t)).filter(isWelcome);
  if (incomplete) expect(welcomes.length, 'onboarding ran').toBeGreaterThan(0);
  if (want === '/account/o') {
    for (const w of welcomes) expect(w.searchParams.get('returnTo'), `onboarding hop ${pathQuery(w)}`).toBe('/account/o');
  }
  // The hostile entry link itself is /auth?...returnTo=https://evil...: every hop stays on this site, and no page past /auth carries the value.
  const offSite = trail.filter((t) => new URL(t).host !== new URL(page.url()).host || (new URL(t).pathname !== '/auth' && /evil\.example/.test(t)));
  expect(offSite, 'no off-site hop').toEqual([]);
  if (incomplete) {
    expect(backend.profile?.complete, 'dancer profile complete at the end').toBe(true);
    expect(backend.calls, 'the photo was uploaded').toContain('fn:storage-sign-upload');
  }
  if (row.midway === 'back-each-step') {
    // M10/M24 (owner decision): the onboarding end REPLACES, so Back from the END never re-opens "You're in".
    await pressBack(page, shot, 'end');
    await expect(page.getByTestId('onboarding-in-card'), 'Back from the END re-opened "You\'re in"').toBeHidden();
  }
  await other?.close();
}

for (const row of JOURNEYS) {
  const fixme = FIXME[row.id];
  test(`${row.id}: ${row.title} -> ${row.end.path}`, async ({ page, context, browser }) => {
    test.fixme(Boolean(fixme), fixme);
    test.setTimeout(150_000);
    await runRow(page, context, row, `${SHOTS}/${row.id}`, browser);
  });
}

test.describe('360x780', () => {
  test.use({ viewport: { width: 360, height: 780 } });
  const row = JOURNEYS.find((j) => j.id === 'organiser-link-new')!;
  test(`${row.id} at 360x780 -> ${row.end.path}`, async ({ page, context, browser }) => {
    test.setTimeout(150_000);
    await runRow(page, context, row, `${SHOTS}/${row.id}/360x780`, browser);
  });
});
