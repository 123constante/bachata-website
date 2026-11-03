import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { FRIDAY, ORG, ORG_NAME, OrganiserFake, PHONE, json } from './helpers/organiserFake';

// Walk of a brand-new invited organiser's first minute at 390x844 (brief walk-invite-first-minute).
// READ-ONLY: every server answer is simulated at the network boundary (page.route); NO product code is touched, no prod access,
// no real token or invite. NOT in the CI gate list. Run once per flag state (the flags are build-time, so the dev server differs):
//   WALK_FLAGS=on  VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true npx playwright test tests/e2e/walk-invite-first-minute.spec.ts --project=chromium
//   WALK_FLAGS=off npx playwright test tests/e2e/walk-invite-first-minute.spec.ts --project=chromium
// Pictures: docs/walk/invite-first-minute/<flags>/<nn>-*.png ; what the screen says: .../texts.jsonl
test.use({ viewport: PHONE, reducedMotion: 'reduce' });

const FLAGS = process.env.WALK_FLAGS === 'on' ? 'on' : 'off';
const OUT = `docs/walk/invite-recheck/${FLAGS}`;
const TOKEN = 'ab12cd34'.repeat(8);
const MAIL = 'diego@ritmo.example';
fs.mkdirSync(OUT, { recursive: true });

async function snap(page: Page, name: string, extra: Record<string, unknown> = {}) {
  await page.locator('h1,h2,h3').first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => undefined);
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' }).catch(() => undefined);
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), undefined, { timeout: 10000 }).catch(() => undefined);
  await page.waitForTimeout(400);
  const full = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: PHONE.width, height: Math.max(full, PHONE.height) });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  const text = await page.evaluate(() => (document.body.innerText || '').replace(/\n{2,}/g, '\n'));
  // Recheck guard: an error page is a FAILED walk, never a picture of a state.
  if (/Something went wrong|couldn.t reach Bachata Calendar/i.test(text)) throw new Error('ERROR CARD on ' + name);
  const buttons = await page.evaluate(() => Array.from(document.querySelectorAll('button,a')).filter((e) => (e as HTMLElement).offsetWidth > 0).map((e) => (e.textContent ?? '').trim()).filter(Boolean));
  fs.appendFileSync(`${OUT}/texts.jsonl`, JSON.stringify({ name, url: page.url().replace(TOKEN, '<token>'), text, controls: buttons, ...extra }) + '\n');
}

type Preview = Record<string, unknown> | null;
const OPEN = { status: 'open', organiser_name: 'Ritmo Bachata London', inviter_first_name: 'Diego', email_hint: null };

async function openInvite(page: Page, preview: Preview, opts: { claim?: 'linked' | 'no_match'; profile?: Record<string, unknown> | 'complete'; signedOut?: boolean; query?: string } = {}) {
  const fake = new OrganiserFake({ signedOut: opts.signedOut ?? true, noOrganiser: true }); // a brand-new person: no team yet
  await fake.install(page);
  const rpc = (name: string, body: unknown) => page.route(`**/rest/v1/rpc/${name}*`, (r) => json(r, body));
  await rpc('organiser_invite_preview_v1', preview);
  await rpc('set_my_role_intent_v1', { ok: true, roles: ['dancer', 'organiser'] });
  await rpc('claim_my_dancer_profile_v1', { ok: true, status: opts.claim ?? 'no_match', profile_id: opts.claim === 'linked' ? 'p1' : null });
  await rpc('_my_dancer_profile_id_v1', 'p1');
  await rpc('profile_complete_v1', opts.profile === 'complete');
  await rpc('request_new_invite_v1', { ok: true });
  await rpc('bind_organiser_invite_email_v1', { ok: true, status: 'bound' });
  await page.route('**/rest/v1/dancer_profiles*', (r) => json(r, opts.profile && opts.profile !== 'complete' ? opts.profile : { first_name: '', based_city_id: null, dance_role: null, avatar_url: null }));
  await page.goto(`/invite/${TOKEN}${opts.query ?? ''}`);
  await page.getByTestId('join-step').or(page.getByTestId('invite-card')).first().waitFor({ timeout: 30000 }).catch(() => undefined);
  return fake;
}

test.describe('1. invite link, fresh account (signed out)', () => {
  test('01 page invite, no claim email, no prefill', async ({ page }) => { await openInvite(page, OPEN); await snap(page, '01-email-page-nohint'); });
  test('02 page invite, claim email set (masked hint)', async ({ page }) => { await openInvite(page, { ...OPEN, email_hint: 'd***@ritmo.example' }); await snap(page, '02-email-page-hint'); });
  test('03 person-bound invite (profile card)', async ({ page }) => {
    await openInvite(page, { ...OPEN, email_hint: 'd***@ritmo.example', person: { first_name: 'Maria', avatar_url: null, city: 'London' } });
    await snap(page, '03-email-person-bound');
  });
  test('04 page invite with sender prefill (first name Ana)', async ({ page }) => {
    await openInvite(page, { ...OPEN, prefill: { first_name: 'Ana', city_id: null } });
    await snap(page, '04-email-with-prefill');
  });
});

test.describe('2. dead links', () => {
  for (const [n, reason] of [['05', 'expired'], ['06', 'revoked'], ['07', 'used']] as const) {
    test(`${n} ${reason} (signed out)`, async ({ page }) => { await openInvite(page, { ...OPEN, status: reason }); await snap(page, `${n}-dead-${reason}`); });
  }
  test('08 unknown / not working link', async ({ page }) => { await openInvite(page, null); await snap(page, '08-dead-invalid'); });
  test('09 expired: tap "Ask for a new one"', async ({ page }) => {
    await openInvite(page, { ...OPEN, status: 'expired' });
    const ask = page.getByRole('button', { name: /new one|new link/i }).first();
    if (await ask.count()) await ask.click();
    await snap(page, '09-dead-expired-asked', { askedNewLink: (await ask.count()) > 0 });
  });
});

test.describe('3. send / code outcomes', () => {
  async function send(page: Page, email: string, setup?: () => Promise<void>) {
    await openInvite(page, OPEN);
    if (setup) await setup();
    await page.getByTestId('join-email-input').fill(email);
    await page.getByTestId('join-send').click();
  }
  test('10 sign-up wall: invite-only refusal on Send my code (403)', async ({ page }) => {
    await send(page, MAIL, () => page.route('**/auth/v1/otp*', (r) => json(r, { code: 403, error_code: 'hook_failed', msg: 'Sign-up is limited to approved organisers.' }, 403)));
    await page.waitForTimeout(1200);
    await snap(page, '10-signup-wall-403');
  });
  test('11 code sent -> code screen', async ({ page }) => { await send(page, MAIL); await page.getByTestId('join-code-form').waitFor(); await snap(page, '11-code-sent'); });
  test('12 wrong code', async ({ page }) => {
    await send(page, MAIL, () => page.route('**/auth/v1/verify*', (r) => json(r, { code: 400, error_code: 'otp_expired', msg: 'Token has expired or is invalid' }, 400)));
    await page.getByTestId('join-code-form').waitFor();
    await page.locator('input[autocomplete="one-time-code"]').fill('12345678');
    await page.waitForTimeout(1200);
    await snap(page, '12-code-wrong-or-expired');
  });
  test('13 rate limited on send (429)', async ({ page }) => {
    await send(page, MAIL, () => page.route('**/auth/v1/otp*', (r) => json(r, { code: 429, error_code: 'over_email_send_rate_limit', msg: 'email rate limit exceeded' }, 429)));
    await page.waitForTimeout(1200);
    await snap(page, '13-rate-limited');
  });
  test('14 typo email (bad shape)', async ({ page }) => { await send(page, 'diego@ritmo'); await snap(page, '14-bad-email'); });
});

test.describe('4. after the code: About, Join, Done', () => {
  async function toCode(page: Page, preview: Preview, opts: Parameters<typeof openInvite>[2]) {
    await openInvite(page, preview, { ...opts, query: `?step=code&email=${encodeURIComponent(MAIL)}` });
    await page.locator('input[autocomplete="one-time-code"]').fill('12345678');
  }
  test('15 About: nothing filled (4 things)', async ({ page }) => {
    await toCode(page, OPEN, { profile: { first_name: '', based_city_id: null, dance_role: null, avatar_url: null } });
    await page.getByTestId('join-about-first-name').waitFor({ timeout: 30000 });
    await snap(page, '15-about-empty');
    await page.getByTestId('join-about-first-name').fill('Ana');
    await snap(page, '15b-about-name-typed');
  });
  test('16 profile complete -> Join card -> Done', async ({ page }) => {
    await toCode(page, OPEN, { profile: 'complete' });
    await page.getByTestId('invite-join').waitFor({ timeout: 30000 });
    await snap(page, '16-join-card');
    await page.route('**/rest/v1/rpc/redeem_organiser_invite_v1*', (r) => json(r, { ok: true, status: 'redeemed', organiser_id: ORG }));
    await page.getByTestId('invite-join').click();
    await page.getByTestId('join-done').waitFor({ timeout: 15000 });
    await snap(page, '17-done');
    const go = page.getByTestId('join-done-home');
    await snap(page, '17-done-button', { href: await go.getAttribute('href') });
  });
  test('18 redeem refused: profile incomplete', async ({ page }) => {
    await toCode(page, OPEN, { profile: 'complete' });
    await page.getByTestId('invite-join').waitFor({ timeout: 30000 });
    await page.route('**/rest/v1/rpc/redeem_organiser_invite_v1*', (r) => json(r, { ok: false, reason: 'profile_incomplete' }));
    await page.getByTestId('invite-join').click();
    await page.waitForTimeout(1200);
    await snap(page, '18-redeem-profile-incomplete');
  });
});

// ---- 5/6: Home and the checklist, then the first event edit behind the gate (needs the P3 flags) ----
const CODES = {
  10: { person: ['first_name', 'city', 'dance_role', 'photo', 'nationality', 'languages', 'teach_answer', 'dj_answer'], org: ['org_logo', 'contact_confirm'] },
  6: { person: ['first_name', 'city', 'dance_role', 'photo'], org: ['org_logo', 'contact_confirm'] },
  3: { person: ['first_name', 'photo'], org: ['org_logo'] },
  2: { person: ['photo'], org: ['org_logo'] },
} as const;
const statusFor = (n: keyof typeof CODES) => ({
  v: 1, gate_on: true, is_admin: false, complete: false,
  person: { complete: false, missing: CODES[n].person },
  organisers: [{ id: ORG, name: ORG_NAME, role: 'owner', lifecycle: 'live', complete: false, missing: CODES[n].org, about: { done: false, skipped: false } }],
});
const REFUSAL = (n: keyof typeof CODES) => ({ code: 'P0001', message: 'onboarding_incomplete', details: JSON.stringify({ missing: [...CODES[n].person, ...CODES[n].org], organiser_id: ORG }), hint: null });

test.describe('5/6. Home, checklist, first event edit', () => {
  for (const n of [10, 6, 3, 2] as const) {
    test(`Home + gate with ${n} things left`, async ({ page }) => {
      const fake = new OrganiserFake({});
      await fake.install(page);
      await page.route('**/rest/v1/rpc/organiser_onboarding_status_v1*', (r) => json(r, statusFor(n)));
      const sent: string[] = [];
      await page.route('**/rest/v1/rpc/series_command_p5*', (r) => { sent.push(r.request().postData() ?? ''); return json(r, REFUSAL(n), 400); });
      await page.route('**/rest/v1/rpc/get_organiser_contact_settings_v1*', (r) => json(r, { contact_phone: null, contact_email: null, show_phone_publicly: false, show_email_publicly: false, claim_email: null }));
      await page.goto(FLAGS === 'on' ? `/account/p3?o=${ORG}` : '/account/o');
      await page.waitForLoadState('networkidle').catch(() => undefined);
      await snap(page, `20-home-${n}-left`);
      if (FLAGS !== 'on') return;
      // First event edit: the Friday event's page, then Repeat (a real write path; the server refuses it).
      await page.goto(`/account/p3/events/${FRIDAY}`);
      await page.getByTestId('p3-event').waitFor({ timeout: 20000 }).catch(() => undefined);
      await snap(page, `21-event-${n}-left`);
      let taps = 0;
      const tap = async (loc: ReturnType<Page['getByTestId']>) => { taps += 1; await loc.click(); };
      await tap(page.getByTestId('p3-open-repeat'));
      await page.getByRole('button', { name: 'Monday' }).click(); taps += 1;
      await tap(page.getByTestId('p3-repeat-save'));
      await page.getByTestId('p3-gate').waitFor({ timeout: 10000 });
      await snap(page, `22-gate-${n}-left`, { tapsToRefusal: taps, writesSent: sent.length, rows: await page.getByTestId('p3-gate-rows').locator('li').allInnerTexts().catch(() => []) });
      const href = await page.getByTestId('p3-gate-go').getAttribute('href');
      await page.getByTestId('p3-gate-go').click();
      await page.waitForTimeout(800);
      await snap(page, `23-after-continue-${n}-left`, { continueHref: href, tapsFromEventToChecklist: taps + 1 });
    });
  }
});
