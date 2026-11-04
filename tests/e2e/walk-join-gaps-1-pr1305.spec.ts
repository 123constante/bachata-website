import { test, type Page } from '@playwright/test';
import fs from 'node:fs';
import { FRIDAY, ORG, ORG_NAME, OrganiserFake, PHONE, json } from './helpers/organiserFake';

// Walk of PR #1305 (join-gaps-1) at 390x844. REPORT ONLY: every server answer is simulated at the network boundary
// (page.route); no product code touched, no prod access, no real token. NOT in the CI gate list. Run:
//   VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true npx playwright test tests/e2e/walk-join-gaps-1-pr1305.spec.ts --project=chromium
// Pictures: docs/walk/join-gaps-1-pr1305/<nn>-*.png ; texts + sweep: texts.jsonl
test.use({ viewport: PHONE, reducedMotion: 'reduce' });

const OUT = 'docs/walk/join-gaps-1-pr1305';
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
  const errorCard = /Something went wrong|couldn.t reach Bachata Calendar/i.test(text);
  const sweep = await page.evaluate(() => {
    const small = Array.from(document.querySelectorAll('button,a[href],input')).filter((e) => (e as HTMLElement).offsetWidth > 0)
      .map((e) => { const r = e.getBoundingClientRect(); return { t: (e.textContent || (e as HTMLInputElement).placeholder || e.tagName).trim().slice(0, 30), h: Math.round(r.height), w: Math.round(r.width) }; })
      .filter((x) => x.h < 44);
    return { small, sideways: document.documentElement.scrollWidth > window.innerWidth, garbled: /â€|Ã.|�|&[a-z]+;/.test(document.body.innerText) };
  });
  const buttons = await page.evaluate(() => Array.from(document.querySelectorAll('button,a')).filter((e) => (e as HTMLElement).offsetWidth > 0).map((e) => (e.textContent ?? '').trim()).filter(Boolean));
  fs.appendFileSync(`${OUT}/texts.jsonl`, JSON.stringify({ name, url: page.url().replace(TOKEN, '<token>'), errorCard, text, controls: buttons, sweep, ...extra }) + '\n');
}

type Preview = Record<string, unknown> | null;
const OPEN = { status: 'open', organiser_name: 'Ritmo Bachata London', inviter_first_name: 'Diego', email_hint: null };
const HINT = { ...OPEN, email_hint: 'd***@ritmo.example' };
const EMPTY_PROFILE = { first_name: '', based_city_id: null, dance_role: null, avatar_url: null };

async function openInvite(page: Page, preview: Preview, opts: { profile?: Record<string, unknown> | 'complete'; query?: string; bind?: string; completeFlips?: boolean } = {}) {
  const fake = new OrganiserFake({ signedOut: true, noOrganiser: true });
  await fake.install(page);
  const rpc = (name: string, body: unknown) => page.route(`**/rest/v1/rpc/${name}*`, (r) => json(r, body));
  await rpc('organiser_invite_preview_v1', preview);
  await rpc('set_my_role_intent_v1', { ok: true, roles: ['dancer', 'organiser'] });
  await rpc('claim_my_dancer_profile_v1', { ok: true, status: 'no_match', profile_id: null });
  await rpc('_my_dancer_profile_id_v1', 'p1');
  let flipped = false;
  await page.route('**/rest/v1/rpc/profile_complete_v1*', (r) => json(r, opts.profile === 'complete' && !(opts.completeFlips && flipped)));
  await rpc('request_new_invite_v1', { ok: true });
  await rpc('bind_organiser_invite_email_v1', { ok: true, status: opts.bind ?? 'bound' });
  await page.route('**/rest/v1/dancer_profiles*', (r) => json(r, opts.profile && opts.profile !== 'complete' ? opts.profile : EMPTY_PROFILE));
  if (opts.completeFlips) await page.route('**/rest/v1/rpc/redeem_organiser_invite_v1*', (r) => { flipped = true; return json(r, { code: 'P0001', message: 'profile_incomplete', details: null, hint: null }, 400); });
  await page.goto(`/invite/${TOKEN}${opts.query ?? ''}`);
  await page.getByTestId('join-step').or(page.getByTestId('invite-card')).first().waitFor({ timeout: 30000 }).catch(() => undefined);
}

const REFUSE_ONLY = (page: Page) => page.route('**/auth/v1/otp*', (r) => json(r, { code: 403, error_code: 'hook_failed', msg: 'Sign-up is limited to approved organisers.' }, 403));
const REFUSE_BLOCKED = (page: Page) => page.route('**/auth/v1/otp*', (r) => json(r, { code: 403, error_code: 'hook_failed', msg: 'Sign-up with this email provider is not accepted. Please use another email address.' }, 403));
async function send(page: Page, preview: Preview, email: string, refuse: (p: Page) => Promise<void>, bind = 'bound') {
  await openInvite(page, preview, { bind });
  await refuse(page);
  await page.getByTestId('join-email-input').fill(email);
  await page.getByTestId('join-send').click();
  await page.waitForTimeout(1200);
}

test.describe('A. email step', () => {
  test('01 no hint', async ({ page }) => { await openInvite(page, OPEN); await snap(page, '01-email-nohint'); });
  test('02 with hint', async ({ page }) => { await openInvite(page, HINT); await snap(page, '02-email-hint'); });
});

test.describe('B. invite-only refusal', () => {
  test('03 hint, typed a different email', async ({ page }) => { await send(page, HINT, 'someone@else.example', REFUSE_ONLY); await snap(page, '03-invite-only-hint'); });
  test('04 no hint, link just tied (locked)', async ({ page }) => { await send(page, OPEN, MAIL, REFUSE_ONLY, 'bound'); await snap(page, '04-invite-only-nohint-locked'); });
  test('05 typed = the invited email', async ({ page }) => { await send(page, HINT, MAIL, REFUSE_ONLY); await snap(page, '05-invite-only-typed-invited'); });
});

test.describe('C. blocked domain', () => {
  test('06 hint', async ({ page }) => { await send(page, HINT, 'someone@blocked.example', REFUSE_BLOCKED); await snap(page, '06-blocked-hint'); });
  test('07 locked (no hint, just bound)', async ({ page }) => { await send(page, OPEN, 'someone@blocked.example', REFUSE_BLOCKED, 'bound'); await snap(page, '07-blocked-locked'); });
});

test.describe('D. redeem refused: profile_incomplete', () => {
  const toJoin = async (page: Page, o: Parameters<typeof openInvite>[2]) => {
    await openInvite(page, OPEN, { ...o, query: `?step=code&email=${encodeURIComponent(MAIL)}` });
    await page.locator('input[autocomplete="one-time-code"]').fill('12345678');
    await page.getByTestId('invite-join').waitFor({ timeout: 30000 });
  };
  test('08 re-read incomplete -> About with notice', async ({ page }) => {
    await toJoin(page, { profile: 'complete', completeFlips: true });
    await page.getByTestId('invite-join').click();
    await page.getByTestId('join-about-refused').waitFor({ timeout: 15000 }).catch(() => undefined);
    await snap(page, '08-about-refused-notice');
  });
  test('09 re-read still complete -> profile_stale', async ({ page }) => {
    await toJoin(page, { profile: 'complete' });
    await page.route('**/rest/v1/rpc/redeem_organiser_invite_v1*', (r) => json(r, { code: 'P0001', message: 'profile_incomplete', details: null, hint: null }, 400));
    await page.getByTestId('invite-join').click();
    await page.getByTestId('join-stale-body').waitFor({ timeout: 15000 }).catch(() => undefined);
    await snap(page, '09-profile-stale');
  });
});

const CODES = {
  10: { person: ['first_name', 'city', 'dance_role', 'photo', 'nationality', 'languages', 'teach_answer', 'dj_answer'], org: ['org_logo', 'contact_confirm'] },
  6: { person: ['first_name', 'city', 'dance_role', 'photo'], org: ['org_logo', 'contact_confirm'] },
  3: { person: ['first_name', 'photo'], org: ['org_logo'] },
  0: { person: [], org: [] },
} as const;
const statusFor = (n: keyof typeof CODES) => ({
  v: 1, gate_on: true, is_admin: false, complete: n === 0,
  person: { complete: n === 0, missing: CODES[n].person },
  organisers: [{ id: ORG, name: ORG_NAME, role: 'owner', lifecycle: 'live', complete: n === 0, missing: CODES[n].org, about: { done: false, skipped: false } }],
});
const REFUSAL = (n: keyof typeof CODES) => ({ code: 'P0001', message: 'onboarding_incomplete', details: JSON.stringify({ missing: [...CODES[n].person, ...CODES[n].org], organiser_id: ORG }), hint: null });

test.describe('E. Home banner, gate sheet, welcome line', () => {
  for (const n of [10, 6, 3, 0] as const) {
    test(`Home + gate + welcome with ${n} left`, async ({ page }) => {
      const fake = new OrganiserFake({});
      await fake.install(page);
      await page.route('**/rest/v1/rpc/organiser_onboarding_status_v1*', (r) => json(r, statusFor(n)));
      await page.route('**/rest/v1/rpc/series_command_p5*', (r) => json(r, REFUSAL(n), 400));
      await page.route('**/rest/v1/rpc/get_organiser_contact_settings_v1*', (r) => json(r, { contact_phone: null, contact_email: null, show_phone_publicly: false, show_email_publicly: false, claim_email: null }));
      await page.goto(`/account/p3?o=${ORG}`);
      await page.waitForLoadState('networkidle').catch(() => undefined);
      await snap(page, `10-home-${n}-left`);
      await page.goto(`/account/p3/start?o=${ORG}`);
      await page.waitForLoadState('networkidle').catch(() => undefined);
      await snap(page, `12-welcome-${n}-left`);
      if (n === 0) return;
      await page.goto(`/account/p3/events/${FRIDAY}`);
      await page.getByTestId('p3-event').waitFor({ timeout: 20000 }).catch(() => undefined);
      await page.getByTestId('p3-open-repeat').click();
      await page.getByRole('button', { name: 'Monday' }).click();
      await page.getByTestId('p3-repeat-save').click();
      await page.getByTestId('p3-gate').waitFor({ timeout: 10000 }).catch(() => undefined);
      await snap(page, `11-gate-${n}-left`);
    });
  }
});
