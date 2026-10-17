import { expect, type Page, type Route } from '@playwright/test';
import { ME, OrganiserFake, json, projectRefFromUrl } from '../../e2e/helpers/organiserFake';
import { FAKE_REF } from '../../e2e-phone/fakeSupabase.mjs';
import type { Journey } from '../../journeys/publicEntryJourneys';
import { CITY_LONDON, makeProfile, withDerived } from '../../../src/modules/dancer-app/api/fixtures';
import type { MyDancerEdit } from '../../../src/modules/dancer-app/api/types';

// The production-build journey harness: the stateful auth + dancer fake (Backend) and the
// real-UI steps (the /auth forms, the code step, every onboarding card, the photo screen,
// browser Back). Shared by public-journeys.build.spec.ts (every journey row) and
// account-edges.build.spec.ts (sign-out, second tabs, the switch sheet). Not a spec itself.

const REF = projectRefFromUrl(process.env.VITE_SUPABASE_URL) ?? FAKE_REF;
export const EMAIL = 'ana.new@example.com';
export const CODE = '12345678';
const TOKEN_EXP = 4102444800;
const MEDIA = 'https://pub-journeys.r2.dev';
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

const b64url = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const COMPLETE = { first_name: 'Ana', based_city_id: CITY_LONDON.id, dance_role: 'Follower' as const, avatar_url: `${MEDIA}/avatars/u/old/ana.jpg` };

/**
 * The account, its session and its dancer persona, as the server holds them. A new
 * e-mail has no account until the sign-up OTP is sent (create_user): then the
 * account carries the form's metadata and the persona is an empty stub (the
 * server's sign-up trigger), which /auth/callback fills from that metadata.
 */
export class Backend {
  signedIn: boolean;
  accountExists: boolean;
  /**
   * The account was there before this walk (every row but a fresh sign-up): its e-mail was
   * confirmed long ago, so this sign-in is NOT its first (lib/auth-otp-routing isFirstSignIn)
   * and arms no one-time hop to /finish-profile. Stamping every account "confirmed a minute
   * ago" made each returning sign-in a first one, and the hop pulled M35's "Continue as..."
   * away to /finish-profile?returnTo=/account/continue before the person could choose.
   */
  returning: boolean;
  meta: Record<string, unknown>;
  profile: MyDancerEdit | null;
  verifyFailures = 0;
  otpRedirect: string | null = null;
  calls: string[] = [];
  /** The account's e-mail; becomeNew() swaps the person on the same phone. */
  email = EMAIL;
  /** The account's user id; defaults to the one the other fakes use. becomeReturning() gives a second person their own. */
  uid = ME;

  constructor(readonly row: Journey) {
    const p = row.person;
    this.signedIn = p.signedIn;
    const isNew = p.dancer === 'incomplete' && row.auth === 'signup';
    this.accountExists = !isNew;
    this.returning = !isNew;
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

  /** A different person, never seen by the server, takes the phone (signed out): their sign-up starts from nothing. */
  becomeNew(email: string) {
    this.email = email;
    this.signedIn = false;
    this.accountExists = false;
    this.returning = false;
    this.meta = {};
    this.profile = null;
    this.otpRedirect = null;
  }

  /** A different, already-registered person (own user id, finished dancer profile) takes the phone, signed out. */
  becomeReturning(email: string, uid: string) {
    this.email = email;
    this.uid = uid;
    this.signedIn = false;
    this.accountExists = true;
    this.returning = true;
    this.meta = { user_type: 'organiser', first_name: 'Bea', city_id: CITY_LONDON.id, dance_role: 'Follower' };
    this.profile = makeProfile(COMPLETE);
    this.otpRedirect = null;
  }

  user() {
    const since = this.returning ? '2025-03-01T10:00:00Z' : '2026-10-08T10:59:00Z';
    return {
      id: this.uid, aud: 'authenticated', role: 'authenticated', email: this.email,
      email_confirmed_at: since, created_at: since, last_sign_in_at: '2026-10-08T11:00:00Z',
      app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: this.meta,
    };
  }

  token() {
    return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: this.uid, aud: 'authenticated', role: 'authenticated', email: this.email, exp: TOKEN_EXP, amr: [{ method: 'otp', timestamp: 1 }] })}.sig`;
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

export type Shot = (step: string, what: string) => Promise<void>;

/** The fakes on one page (each new tab of the context gets them too). */
export async function wire(page: Page, backend: Backend): Promise<OrganiserFake> {
  const fake = new OrganiserFake({ noOrganiser: backend.row.person.organisers === 0, signedOut: true });
  for (let i = 0; i < (backend.row.person.openRequests ?? 0); i += 1) {
    const c = fake.claimable[i % fake.claimable.length];
    fake.myRequests.push({ request_id: `r-open-${i}`, organiser_id: c.id, organiser_name: c.name, status: 'open', created_at: '2026-10-01T10:00:00+00:00', resolved_at: null });
  }
  await fake.install(page);
  if (backend.row.then === 'join-team') {
    // The invite redeems: the person joins the fake's own organiser (the server adds the member row).
    await page.route('**/rest/v1/rpc/redeem_organiser_invite_v1', (route) => {
      const joined = new OrganiserFake();
      if (!fake.organisers.length) {
        fake.organisers.push(...joined.organisers);
        for (const [id, s] of joined.series) fake.series.set(id, s);
        for (const d of joined.emptyLineup) fake.emptyLineup.add(d);
      }
      return json(route, { ok: true, status: 'redeemed', organiser_id: fake.organisers[0].id });
    });
  }
  await backend.install(page);
  return fake;
}

export function trailOf(page: Page, trail: string[]) {
  page.on('framenavigated', (f) => {
    if (f === page.mainFrame()) trail.push(f.url());
  });
}

export const pathQuery = (u: URL) => `${u.pathname}${u.search}`;
export const isWelcome = (u: URL) => u.pathname === '/app/welcome';

export async function signupForm(page: Page, entry: string, shot: Shot, who = { firstName: 'Ana', email: EMAIL }) {
  const details = page.getByText('A little about you');
  if (!new URL(entry, 'https://x.test').searchParams.get('userType')) {
    await expect(page.getByText('What brings you here?')).toBeVisible();
    await shot('auth-role', '/auth sign-up step 1 of 3: role (Dancer pre-selected)');
    await page.getByRole('button', { name: /^Continue as / }).click();
  }
  await expect(details).toBeVisible();
  await page.locator('#signup-firstname').fill(who.firstName);
  await page.getByRole('combobox').first().click();
  await page.getByPlaceholder('Search city...').fill('Lon');
  await page.getByRole('option', { name: /London/ }).click();
  await shot('auth-details', '/auth sign-up step 2 of 3: first name and city filled (the dance role is next)');
  // The third detail completes the step: the form moves on to the e-mail by itself (no Continue press).
  await page.getByRole('radio', { name: 'Follower', exact: true }).click();
  await expect(page.getByText(/Last step/)).toBeVisible();
  await page.locator('#signup-email').fill(who.email);
  await shot('auth-email', '/auth sign-up step 3 of 3: e-mail filled');
  await page.getByRole('button', { name: 'Email me a link' }).click();
}

export async function signinForm(page: Page, shot: Shot, email = EMAIL) {
  await expect(page.locator('#signin-email')).toBeVisible();
  await page.locator('#signin-email').fill(email);
  await shot('auth-signin', '/auth sign in: e-mail filled');
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click();
}

export async function codeStep(page: Page, shot: Shot, backend: Backend, wrongFirst: boolean) {
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

/**
 * Browser Back from `where` (M10/M24): never the /auth form with a session, never a blank page.
 * Waits for the route to settle (a signed-in visitor is sent on from /auth; lazy chunks load).
 */
export async function pressBack(page: Page, shot: Shot, where: string) {
  await page.goBack();
  // A page Back lands on may send the person straight on again (e.g. the photo screen back to the cards).
  await page.waitForTimeout(1500);
  const at = new URL(page.url());
  await shot(`back-${where}`, `browser Back from ${where}: ${pathQuery(at)}`);
  const form = at.pathname === '/auth' && (await page.locator('#signup-firstname, #signup-email, #signin-email').first().isVisible());
  expect(form, `Back from ${where} showed the /auth form with a session (${pathQuery(at)})`).toBe(false);
  expect((await page.locator('body').innerText()).trim().length, `Back from ${where} left a blank page (${pathQuery(at)})`).toBeGreaterThan(0);
}

/** Back on an onboarding card, then return to it (Forward, else reopen the URL): the server shape resumes the same card. */
async function backOnCard(page: Page, shot: Shot, stage: string) {
  const welcome = page.url();
  await pressBack(page, shot, `card-${stage}`);
  if (page.url() !== welcome) {
    await page.goForward().catch(() => null);
    await page.waitForTimeout(1000);
    if (!isWelcome(new URL(page.url()))) await page.goto(welcome);
  }
}

/** The current onboarding card, once it differs from `prev` (null = any). */
export async function nextStage(page: Page, prev: string | null): Promise<string> {
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
export async function onboarding(page: Page, shot: Shot, endLabel: string | undefined, endFrom: 'in' | 'nice' | 'close', backEach = false) {
  let prev: string | null = null;
  const backed = new Set<string>();
  for (let i = 0; i < 20; i += 1) {
    let stage = await nextStage(page, prev);
    if (backEach && stage !== 'load-error' && stage !== 'nice' && !backed.has(stage)) {
      backed.add(stage);
      await backOnCard(page, shot, stage);
      stage = await nextStage(page, null);
    }
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

export async function pressEnd(page: Page, endLabel: string | undefined) {

  const button = page.getByTestId('onboarding-home');
  if (endLabel) await expect(button).toHaveText(endLabel);
  await button.click();
}
