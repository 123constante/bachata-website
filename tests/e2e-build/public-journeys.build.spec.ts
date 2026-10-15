import { appendFileSync } from 'node:fs';
import { test, expect, type BrowserContext, type Page, type Route } from '@playwright/test';
import { ME, OrganiserFake, expectNoHorizontalScroll, json, projectRefFromUrl } from '../e2e/helpers/organiserFake';
import { FAKE_REF } from '../e2e-phone/fakeSupabase.mjs';
import { JOURNEYS, type Journey } from '../journeys/publicEntryJourneys';
import { CITY_LONDON, makeProfile, withDerived } from '../../src/modules/dancer-app/api/fixtures';
import type { MyDancerEdit } from '../../src/modules/dancer-app/api/types';

// Every public way into an account (tests/journeys/publicEntryJourneys.ts, the SAME
// rows the routing-model spec walks) driven through the real UI of the PRODUCTION
// build (playwright.build.config.ts) at 390x844: the /auth sign-up or sign-in form,
// the e-mailed code (or link), /auth/callback, the dancer gate, every onboarding
// card the server's strength.missing asks for, the photo screen, and the end button
// -- to the row's END screen. The backend is mocked in the browser at the network
// layer (no Supabase project is touched): OrganiserFake for the organiser area, and
// the stateful auth + dancer fake below for the account, the persona stub a new
// e-mail gets at sign-up, and the dancer RPCs, whose strength/missing advance the
// way the server's does (fixtures.withDerived mirrors _dancer_strength_v1).
//
// Build with organiser self-serve ON (prod; /account/o redirects home without it):
//   VITE_ENABLE_ORGANISER_SELF_SERVE=true + the env in playwright.build.config.ts.
// Shots: docs/review-packs/public-journeys/<row.id>/NN-<step>.png.

const SHOTS = 'docs/review-packs/public-journeys';
const REF = projectRefFromUrl(process.env.VITE_SUPABASE_URL) ?? FAKE_REF;
const EMAIL = 'ana.new@example.com';
const CODE = '12345678';
const TOKEN_EXP = 4102444800;
const MEDIA = 'https://pub-journeys.r2.dev';
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

/** The END screen of each end path: its test id, and the label the end-of-onboarding button must carry to go there. */
const END: Record<string, { testId: string; label?: string }> = {
  '/account/o': { testId: 'org-onboarding', label: 'Next: set up your organiser page' },
  '/app/home': { testId: 'dancer-screen-home', label: 'Go to Home' },
  '/account/continue': { testId: 'continue-as' },
  '/app/nights': { testId: 'dancer-screen-nights' },
  '/organisers/bachata-playground-phone-qa?claim=1': { testId: 'public-claim-card', label: 'Continue' },
  '/invite/0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0': { testId: 'invite-card', label: 'Next: join the team' },
};

/** Rows the sandbox cannot drive to their END, with the one-line reason. Never a faked pass. */
const FIXME: Record<string, string> = {};

const b64url = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const COMPLETE = { first_name: 'Ana', based_city_id: CITY_LONDON.id, dance_role: 'Follower' as const, avatar_url: `${MEDIA}/avatars/u/old/ana.jpg` };

/**
 * The account, its session and its dancer persona, as the server holds them. A new
 * e-mail has no account until the sign-up OTP is sent (create_user): then the
 * account carries the form's metadata and the persona is an empty stub (the
 * server's sign-up trigger), which /auth/callback fills from that metadata.
 */
class Backend {
  signedIn: boolean;
  accountExists: boolean;
  meta: Record<string, unknown>;
  profile: MyDancerEdit | null;
  verifyFailures = 0;
  otpRedirect: string | null = null;
  calls: string[] = [];

  constructor(readonly row: Journey) {
    const p = row.person;
    this.signedIn = p.signedIn;
    const isNew = p.dancer === 'incomplete' && row.auth === 'signup';
    this.accountExists = !isNew;
    if (isNew) {
      this.meta = {};
      this.profile = null;
    } else if (p.dancer === 'complete') {
      this.meta = { user_type: p.userType, first_name: 'Ana', city_id: CITY_LONDON.id, dance_role: 'Follower' };
      this.profile = makeProfile(COMPLETE);
    } else if (p.dancer === 'incomplete') {
      // Never finished onboarding: an older account whose stub has a name and a city, no role, no photo.
      this.meta = { user_type: p.userType };
      this.profile = makeProfile({ first_name: 'Ana', based_city_id: CITY_LONDON.id });
    } else {
      this.meta = { user_type: p.userType };
      this.profile = null;
    }
  }

  user() {
    return {
      id: ME, aud: 'authenticated', role: 'authenticated', email: EMAIL,
      email_confirmed_at: '2026-10-08T10:59:00Z', created_at: '2026-10-08T10:59:00Z', last_sign_in_at: '2026-10-08T11:00:00Z',
      app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: this.meta,
    };
  }

  token() {
    return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: ME, aud: 'authenticated', role: 'authenticated', email: EMAIL, exp: TOKEN_EXP, amr: [{ method: 'otp', timestamp: 1 }] })}.sig`;
  }

  session() {
    return { access_token: this.token(), token_type: 'bearer', expires_in: 3600, expires_at: TOKEN_EXP, refresh_token: 'r', user: this.user() };
  }

  /** The e-mailed link's fragment (implicit flow, detectSessionInUrl). */
  linkHash() {
    return `#access_token=${this.token()}&expires_at=${TOKEN_EXP}&expires_in=3600&refresh_token=r&token_type=bearer&type=magiclink`;
  }

  private row4() {
    const p = this.profile!;
    return { id: p.profile_id, first_name: p.first_name, based_city_id: p.based_city_id, dance_role: p.dance_role, avatar_url: p.avatar_url };
  }

  private apply(delta: Record<string, unknown>) {
    const next: Record<string, unknown> = { ...this.profile! };
    for (const [k, v] of Object.entries(delta)) {
      if (!(k in next)) continue;
      next[k] = typeof v === 'string' ? (v.trim() === '' ? null : v.trim()) : v ?? null;
    }
    this.profile = withDerived(next as MyDancerEdit);
  }

  async install(page: Page) {
    if (this.row.person.signedIn) {
      await page.addInitScript(
        ({ key, value }) => {
          if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value));
        },
        { key: `sb-${REF}-auth-token`, value: this.session() },
      );
    }
    // Registered after OrganiserFake.install: Playwright tries the newest route first.
    await page.route('**/auth/v1/**', (route) => this.auth(route));
    await page.route('**/rest/v1/**', (route) => this.rest(route));
    await page.route('**/functions/v1/storage-sign-upload', (route) => {
      this.calls.push('fn:storage-sign-upload');
      const key = `avatars/u/${ME}/onboarding.jpg`;
      return json(route, { ok: true, key, publicUrl: `${MEDIA}/${key}` });
    });
    // The uploaded photo, served (a host the CSP img-src allows: *.r2.dev).
    await page.route(`${MEDIA}/**`, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }));
  }

  private auth(route: Route) {
    const req = route.request();
    const url = new URL(req.url());
    const ep = url.pathname.split('/auth/v1/')[1] ?? '';
    this.calls.push(`auth:${ep}`);
    if (ep === 'otp') {
      const body = (req.postDataJSON() ?? {}) as { create_user?: boolean; data?: Record<string, unknown> };
      this.otpRedirect = url.searchParams.get('redirect_to');
      if (body.create_user && !this.accountExists) {
        this.accountExists = true;
        this.meta = { ...(body.data ?? {}) };
        this.profile = makeProfile();
      }
      return json(route, {});
    }
    if (ep === 'verify') {
      if (this.verifyFailures > 0) {
        this.verifyFailures -= 1;
        return json(route, { code: 400, error_code: 'otp_expired', msg: 'Token has expired or is invalid' }, 400);
      }
      this.signedIn = true;
      return json(route, this.session());
    }
    if (ep === 'user') return this.signedIn ? json(route, this.user()) : json(route, { code: 401, msg: 'no session' }, 401);
    if (ep.startsWith('token')) return this.signedIn ? json(route, this.session()) : json(route, { code: 400, msg: 'invalid refresh token' }, 400);
    if (ep === 'logout') {
      this.signedIn = false;
      return route.fulfill({ status: 204 });
    }
    return json(route, {});
  }

  private rest(route: Route) {
    const req = route.request();
    const url = new URL(req.url());
    const rpc = url.pathname.match(/\/rpc\/([a-z0-9_]+)$/)?.[1];
    let body: Record<string, unknown> = {};
    try {
      body = (req.postDataJSON() ?? {}) as Record<string, unknown>;
    } catch {
      /* GET */
    }
    if (rpc) {
      switch (rpc) {
        case 'dancer_area_gate_v1':
          return json(route, { open: true, allowed: true });
        case 'account_exists_by_email':
          // Not anon-callable in prod: the form reads 'unknown' and sends the code.
          return json(route, { code: '42501', message: 'permission denied for function account_exists_by_email' }, 401);
        case 'claim_my_dancer_profile_v1':
          return json(route, { ok: true, status: 'not_applicable', profile_id: null });
        case '_my_dancer_profile_id_v1':
          return json(route, this.profile?.profile_id ?? null);
        case 'profile_complete_v1':
          return json(route, this.profile?.complete === true);
        case 'my_dancer_edit_v1':
          this.calls.push('rpc:my_dancer_edit_v1');
          return this.profile ? json(route, this.profile) : json(route, { code: 'P0001', message: 'no_profile' }, 400);
        case 'save_my_dancer_profile_v1':
        case 'save_my_dancer_profile_v2': {
          if (!this.profile) return json(route, { code: 'P0001', message: 'no_profile' }, 400);
          this.calls.push(`rpc:${rpc}:${Object.keys((body.p_payload ?? {}) as object).sort().join(',')}`);
          this.apply((body.p_payload ?? {}) as Record<string, unknown>);
          return json(route, rpc === 'save_my_dancer_profile_v1' ? this.row4() : this.profile);
        }
        default:
          return route.fallback();
      }
    }
    if (url.pathname.endsWith('/rest/v1/dancer_profiles')) {
      const single = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
      const list = this.profile ? [this.row4()] : [];
      return json(route, single ? list[0] ?? null : list);
    }
    return route.fallback();
  }
}

type Shot = (step: string, what: string) => Promise<void>;

/** The fakes on one page (each new tab of the context gets them too). */
async function wire(page: Page, backend: Backend) {
  const fake = new OrganiserFake({ noOrganiser: backend.row.person.organisers === 0, signedOut: true });
  await fake.install(page);
  await backend.install(page);
}

function trailOf(page: Page, trail: string[]) {
  page.on('framenavigated', (f) => {
    if (f === page.mainFrame()) trail.push(f.url());
  });
}

const pathQuery = (u: URL) => `${u.pathname}${u.search}`;
const isWelcome = (u: URL) => u.pathname === '/app/welcome';

async function signupForm(page: Page, entry: string, shot: Shot) {
  const details = page.getByText('A little about you');
  if (!new URL(entry, 'https://x.test').searchParams.get('userType')) {
    await expect(page.getByText('What brings you here?')).toBeVisible();
    await shot('auth-role', '/auth sign-up step 1 of 3: role (Dancer pre-selected)');
    await page.getByRole('button', { name: /^Continue as / }).click();
  }
  await expect(details).toBeVisible();
  await page.locator('#signup-firstname').fill('Ana');
  await page.getByRole('combobox').first().click();
  await page.getByPlaceholder('Search city...').fill('Lon');
  await page.getByRole('option', { name: /London/ }).click();
  await shot('auth-details', '/auth sign-up step 2 of 3: first name and city filled (the dance role is next)');
  // The third detail completes the step: the form moves on to the e-mail by itself (no Continue press).
  await page.getByRole('radio', { name: 'Follower', exact: true }).click();
  await expect(page.getByText(/Last step/)).toBeVisible();
  await page.locator('#signup-email').fill(EMAIL);
  await shot('auth-email', '/auth sign-up step 3 of 3: e-mail filled');
  await page.getByRole('button', { name: 'Email me a link' }).click();
}

async function signinForm(page: Page, shot: Shot) {
  await expect(page.locator('#signin-email')).toBeVisible();
  await page.locator('#signin-email').fill(EMAIL);
  await shot('auth-signin', '/auth sign in: e-mail filled');
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click();
}

async function codeStep(page: Page, shot: Shot, backend: Backend, wrongFirst: boolean) {
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  await shot('code', 'code step: "Check your email" with the 8-digit code boxes');
  const input = page.locator('input[autocomplete="one-time-code"]');
  if (wrongFirst) {
    backend.verifyFailures = 1;
    await input.pressSequentially('87654321');
    await expect(page.getByText('That code is wrong or has expired')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
    await expect(page).toHaveURL(/\/auth\?/);
    await shot('code-wrong', 'wrong code: "That code is wrong or has expired..." shown, still on the code step');
  }
  await input.pressSequentially(CODE);
}

/** The current onboarding card, once it differs from `prev` (null = any). */
async function nextStage(page: Page, prev: string | null): Promise<string> {
  const handle = await page.waitForFunction(
    (before) => {
      if (location.pathname !== '/app/welcome') return false;
      if (document.querySelector('[data-testid="onboarding-load-error"]')) return 'load-error';
      const s = [...document.querySelectorAll('section[data-testid^="onboarding-"]')]
        .map((e) => (e.getAttribute('data-testid') ?? '').slice('onboarding-'.length))
        .filter((x) => x !== 'skeleton');
      return s[0] && s[0] !== before ? s[0] : false;
    },
    prev,
    { timeout: 20_000 },
  );
  return (await handle.jsonValue()) as string;
}

async function photoStep(page: Page, shot: Shot) {
  await page.getByTestId('onboarding-choose-photo').click();
  await expect(page).toHaveURL(/\/app\/me\/photo\?return=/);
  await expect(page.getByTestId('photo-pick')).toBeVisible();
  await shot('photo', `photo screen (pick), return=${new URL(page.url()).searchParams.get('return')}`);
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 600;
    c.height = 600;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#c48';
    ctx.fillRect(0, 0, 600, 600);
    ctx.fillStyle = '#fd9';
    ctx.beginPath();
    ctx.arc(300, 240, 120, 0, Math.PI * 2);
    ctx.fill();
    return c.toDataURL('image/png');
  });
  await page.getByTestId('photo-input-library').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: Buffer.from(dataUrl.split(',')[1], 'base64') });
  await expect(page.getByTestId('photo-crop')).toBeVisible();
  await shot('photo-crop', 'photo screen: crop box with the head-and-shoulders guide');
  await page.getByTestId('photo-crop-done').click();
  await expect(page.getByTestId('photo-preview')).toBeVisible();
  await shot('photo-preview', 'photo screen: preview, "Use this photo"');
  await page.getByTestId('photo-use').click();
  await expect(page).toHaveURL(/\/app\/welcome/);
}

/** Answers every card the server asks for, then presses the end button. Ends from the 'in' card or after the optional ones. */
/** endFrom 'close': stop on the 'in' card without pressing anything (the tab is about to close). */
async function onboarding(page: Page, shot: Shot, endLabel: string | undefined, endFrom: 'in' | 'nice' | 'close') {
  let prev: string | null = null;
  for (let i = 0; i < 12; i += 1) {
    const stage = await nextStage(page, prev);
    prev = stage;
    expect(stage, 'onboarding failed to load').not.toBe('load-error');
    const card = page.locator(`section[data-testid="onboarding-${stage}"]`);
    await expect(card).toBeVisible();
    const pct = await page.getByTestId('onboarding-pct').textContent();
    await shot(`card-${stage}`, `onboarding card '${stage}' (meter ${pct}), URL ${pathQuery(new URL(page.url()))}`);
    if (stage === 'name') {
      await page.locator('#ob-first').fill('Ana');
      await page.getByTestId('onboarding-continue').click();
    } else if (stage === 'city') {
      await card.getByRole('combobox').first().click();
      await page.getByPlaceholder('Search city...').fill('Lon');
      await page.getByRole('option', { name: /London/ }).click();
      await page.getByTestId('onboarding-continue').click();
    } else if (stage === 'role') {
      await card.getByRole('radio', { name: 'Follower', exact: true }).click();
      await page.getByTestId('onboarding-continue').click();
    } else if (stage === 'photo') {
      await photoStep(page, shot);
      prev = null; // back on /app/welcome: a fresh mount
    } else if (stage === 'in' && endFrom === 'close') {
      return;
    } else if (stage === 'in' && endFrom === 'in') {
      return pressEnd(page, endLabel);
    } else if (stage === 'in') {
      await page.getByTestId('onboarding-boost').click();
    } else if (stage === 'years') {
      await card.getByRole('radio', { name: '1 to 2 years' }).click();
      await page.getByTestId('onboarding-continue').click();
    } else if (stage === 'styles') {
      await card.getByRole('checkbox').first().click();
      await page.getByTestId('onboarding-continue').click();
    } else if (stage === 'nice') {
      return pressEnd(page, endLabel);
    } else {
      throw new Error(`unexpected onboarding stage ${stage}`);
    }
  }
  throw new Error('onboarding never ended');
}

async function pressEnd(page: Page, endLabel: string | undefined) {

  const button = page.getByTestId('onboarding-home');
  if (endLabel) await expect(button).toHaveText(endLabel);
  await button.click();
}

async function runRow(page: Page, context: BrowserContext, row: Journey, dir: string) {
  const backend = new Backend(row);
  const trail: string[] = [];
  const walkLog = process.env.WALK_LOG;
  let n = 0;
  let current = page;
  const shot: Shot = async (step, what) => {
    n += 1;
    const file = `${dir}/${String(n).padStart(2, '0')}-${step}.png`;
    await current.screenshot({ path: file });
    if (walkLog) appendFileSync(walkLog, `${JSON.stringify({ row: dir.slice(SHOTS.length + 1), step, file, what })}\n`);
  };
  const end = END[row.end.path.split('?')[0]] ?? END[row.end.path];
  expect(end, `no END screen known for ${row.end.path}`).toBeTruthy();
  const incomplete = row.person.dancer !== 'complete';

  await wire(page, backend);
  trailOf(page, trail);
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
      } else {
        await codeStep(page, shot, backend, row.midway === 'wrong-code-first');
      }
    }
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
    await onboarding(page, shot, end.label, afterRequired ? 'close' : row.midway === 'reload' ? 'in' : 'nice');
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

  const want = row.end.path;
  await expect(page).toHaveURL((u) => (want.includes('?') ? pathQuery(u) : u.pathname) === want, { timeout: 30_000 });
  await expect(page.getByTestId(end.testId), `END screen; hops: ${trail.slice(-8).map((t) => pathQuery(new URL(t))).join(' -> ')} (${trail.length} in all)`).toBeVisible({ timeout: 30_000 });
  await expectNoHorizontalScroll(page);
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
}

for (const row of JOURNEYS) {
  const fixme = FIXME[row.id];
  test(`${row.id}: ${row.title} -> ${row.end.path}`, async ({ page, context }) => {
    test.fixme(Boolean(fixme), fixme);
    test.setTimeout(150_000);
    await runRow(page, context, row, `${SHOTS}/${row.id}`);
  });
}

test.describe('360x780', () => {
  test.use({ viewport: { width: 360, height: 780 } });
  const row = JOURNEYS.find((j) => j.id === 'organiser-link-new')!;
  test(`${row.id} at 360x780 -> ${row.end.path}`, async ({ page, context }) => {
    test.setTimeout(150_000);
    await runRow(page, context, row, `${SHOTS}/${row.id}/360x780`);
  });
});
