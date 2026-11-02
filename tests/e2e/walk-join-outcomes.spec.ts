import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { OrganiserFake, PHONE, json } from './helpers/organiserFake';

// Walk of every outcome screen on the invite join path at 390x844 (brief walk-join-outcomes-r1).
// Server answers are simulated at the network boundary only; NO product code is touched. NOT in the CI gate list:
//   npx playwright test tests/e2e/walk-join-outcomes.spec.ts --project=chromium
// Pictures: docs/walk/join-outcomes/<nn>-<outcome>-<entry>.png ; bar results: docs/walk/join-outcomes/RESULTS.md
test.use({ viewport: PHONE });

const TOKEN = 'ab12cd34'.repeat(8);
const OUT = 'docs/walk/join-outcomes';
const PERSON = { person: { first_name: 'Papacito', avatar_url: null, city: 'London' } };
const previewOf = (status: string, extra: Record<string, unknown> = {}) => ({
  status, organiser_name: 'Salsa Norte', inviter_first_name: 'Diego', email_hint: null, ...extra,
});

interface Outcome { id: string; redeem?: unknown; rpcError?: { status: number; message: string }; deadStatus?: string; expect: string; primaryExempt?: boolean }
const OUTCOMES: Outcome[] = [
  { id: 'done', redeem: { ok: true, status: 'redeemed', organiser_id: 'o1' }, expect: 'done' },
  { id: 'done-already-member', redeem: { ok: true, status: 'already_member', organiser_id: 'o1' }, expect: 'done' },
  { id: 'wrong-account', redeem: { ok: false, reason: 'email_mismatch', invite_email_hint: 'd***@ritmo.example' }, expect: 'stop:wrong_account' },
  { id: 'email-unproven', redeem: { ok: false, reason: 'email_unproven' }, expect: 'stop:email_unproven' },
  { id: 'not-linked', redeem: { ok: false, reason: 'not_linked' }, expect: 'stop:not_linked' },
  { id: 'dead-used', redeem: { ok: false, reason: 'used' }, deadStatus: 'used', expect: 'dead' },
  { id: 'dead-expired', redeem: { ok: false, reason: 'expired' }, deadStatus: 'expired', expect: 'dead' },
  { id: 'dead-revoked', redeem: { ok: false, reason: 'revoked' }, deadStatus: 'revoked', expect: 'dead' },
  { id: 'dead-invalid', redeem: { ok: false, reason: 'invalid' }, deadStatus: 'invalid', expect: 'dead' },
  { id: 'rate-limited', redeem: { ok: false, reason: 'rate_limited' }, expect: 'stop:rate_limited' },
  { id: 'team-full', redeem: { ok: false, reason: 'team_full' }, expect: 'stop:refused' },
  { id: 'unconfirmed-account', redeem: { ok: false, reason: 'unconfirmed_account' }, expect: 'stop:refused' },
  { id: 'profile-incomplete', redeem: { ok: false, reason: 'profile_incomplete' }, expect: 'any' },
  { id: 'sign-in', redeem: { ok: false, reason: 'sign_in_required' }, expect: 'any' },
  { id: 'network-failed', rpcError: { status: 500, message: 'boom' }, expect: 'stop:network' },
];

const results: string[] = [];
const record = (row: string) => { results.push(row); fs.mkdirSync(OUT, { recursive: true }); fs.appendFileSync(`${OUT}/rows.tmp`, row + '\n'); };

async function open(page: Page, o: Outcome, entry: 'join-tap' | 'after-sign-in') {
  const signedOut = entry === 'after-sign-in';
  const fake = new OrganiserFake({ signedOut });
  await fake.install(page);
  let redeemed = false;
  const rpc = (name: string, body: () => unknown) =>
    page.route(`**/rest/v1/rpc/${name}*`, (r) => { fake.calls.push({ rpc: name, body: {} }); return json(r, body()); });
  const preview = () => (redeemed && o.deadStatus ? previewOf(o.deadStatus, entry === 'after-sign-in' ? PERSON : {}) : previewOf('open', entry === 'after-sign-in' ? PERSON : { email_hint: 'd***@ritmo.example' }));
  await rpc('organiser_invite_preview_v1', preview);
  await rpc('bind_organiser_invite_email_v1', () => ({ status: 'bound' }));
  await rpc('request_new_invite_v1', () => ({ ok: true }));
  await rpc('set_my_role_intent_v1', () => ({ ok: true, roles: ['dancer', 'organiser'] }));
  await rpc('claim_my_dancer_profile_v1', () => ({ ok: true, status: 'no_match', profile_id: null }));
  await page.route('**/rest/v1/rpc/redeem_organiser_invite_v1*', (r) => {
    fake.calls.push({ rpc: 'redeem_organiser_invite_v1', body: {} });
    redeemed = true;
    if (o.rpcError) return json(r, { message: o.rpcError.message }, o.rpcError.status);
    return json(r, o.redeem);
  });
  if (entry === 'join-tap') {
    await page.goto(`/invite/${TOKEN}`);
    await page.getByTestId('join-step').waitFor();
    await page.getByTestId('invite-join').click();
  } else {
    await page.goto(`/invite/${TOKEN}?step=code&email=${encodeURIComponent('diego@ritmo.example')}`);
    await page.getByTestId('join-step').waitFor();
    await page.locator('input[autocomplete="one-time-code"]').fill('12345678');
  }
  await page.waitForTimeout(1200);
}

async function audit(page: Page, label: string, o: Outcome) {
  const m = await page.evaluate(() => {
    const vis = (e: Element) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden'; };
    const ctl = Array.from(document.querySelectorAll('[data-testid="join-step"] a, [data-testid="join-step"] button')).filter(vis) as HTMLElement[];
    const small = ctl.filter((e) => e.getBoundingClientRect().height < 43.5).map((e) => `${(e.textContent ?? '').trim().slice(0, 30)}=${Math.round(e.getBoundingClientRect().height)}px`);
    const primary = ctl.filter((e) => /(^|\s)bg-primary(\s|$)/.test(e.className) && !(e as HTMLButtonElement).disabled).length;
    const live = ctl.filter((e) => !(e as HTMLButtonElement).disabled).length;
    const step = document.querySelector('[data-testid="join-step"]');
    return {
      hscroll: document.documentElement.scrollWidth > window.innerWidth,
      small, primary, live,
      step: step?.getAttribute('data-step') ?? null, stop: step?.getAttribute('data-stop') ?? null,
      told: /we.ve told/i.test(document.body.innerText),
      heading: document.querySelector('h1')?.textContent ?? '',
    };
  });
  const notLinked = m.stop === 'not_linked';
  const fails: string[] = [];
  if (m.hscroll) fails.push('sideways scroll');
  if (m.small.length) fails.push(`<44px: ${m.small.join(', ')}`);
  if (m.primary !== 1) fails.push(`primary actions = ${m.primary}`);
  if (m.live < 1) fails.push('no live control');
  if (m.told !== notLinked) fails.push(m.told ? '"we\'ve told" shown off not_linked' : '"we\'ve told" missing on not_linked');
  record(`| ${label} | ${m.step}${m.stop ? '/' + m.stop : ''} | ${m.heading.replace(/\|/g, '/')} | ${fails.length ? 'FAIL: ' + fails.join('; ') : 'pass'} |`);
  for (const f of fails) expect.soft(false, `${label}: ${f}`).toBe(true);
  return m;
}

let n = 0;
for (const entry of ['join-tap', 'after-sign-in'] as const) {
  for (const o of OUTCOMES) {
    const nn = String(++n).padStart(2, '0');
    test(`${nn} ${o.id} via ${entry}`, async ({ page }) => {
      await open(page, o, entry);
      await page.screenshot({ path: `${OUT}/${nn}-${o.id}-${entry}.png` });
      const m = await audit(page, `${nn} ${o.id} / ${entry}`, o);
      if (o.expect === 'done') expect(m.step).toBe('done');
      else if (o.expect === 'dead') expect(m.step).toBe('dead');
      else if (o.expect.startsWith('stop:')) expect.soft(m.stop).toBe(o.expect.slice(5));
    });
  }
}

for (const entry of ['signed-out', 'person-bound'] as const) {
  test(`Send my code: enabled when empty, bad-shape error on tap (${entry})`, async ({ page }) => {
    const fake = new OrganiserFake({ signedOut: true });
    await fake.install(page);
    await page.route('**/rest/v1/rpc/organiser_invite_preview_v1*', (r) => json(r, previewOf('open', entry === 'person-bound' ? PERSON : {})));
    await page.goto(`/invite/${TOKEN}`);
    await page.getByTestId('join-step').waitFor();
    const send = page.getByTestId('join-send');
    await expect(page.getByTestId('join-email-input')).toHaveValue('');
    await expect(send).toBeEnabled();
    await send.click();
    await expect(page.getByTestId('join-email-error')).toContainText('Use an email like name@example.com');
    await page.screenshot({ path: `${OUT}/${String(++n).padStart(2, '0')}-send-code-bad-shape-${entry}.png` });
  });
}
