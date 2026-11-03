import { test, type Page } from '@playwright/test';
import fs from 'node:fs';
import { ORG_NAME, OrganiserFake, PHONE, json } from './helpers/organiserFake';

// Walk of the join dead-end screens changed by PR #1301, 390x844. READ-ONLY: every server answer is a page.route mock.
// NOT in the CI gate list. Run: npx playwright test tests/e2e/walk-fix-join-dead-ends.spec.ts --project=chromium
// Output: docs/walk/fix-join-dead-ends-r1/{NN-*.png,texts.jsonl}
test.use({ viewport: PHONE });
const OUT = 'docs/walk/fix-join-dead-ends-r1';
const TOKEN = 'ab12cd34'.repeat(8);
fs.mkdirSync(OUT, { recursive: true });
const OPEN = { status: 'open', organiser_name: ORG_NAME, inviter_first_name: 'Diego', email_hint: null };

async function snap(page: Page, name: string) {
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' }).catch(() => undefined);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  const info = await page.evaluate(() => ({
    text: (document.body.innerText || '').replace(/\n{2,}/g, '\n'),
    scrollWidth: document.documentElement.scrollWidth,
    controls: Array.from(document.querySelectorAll('button,a,[role=button]'))
      .filter((e) => (e as HTMLElement).offsetWidth > 0)
      .map((e) => ({ text: (e.textContent ?? '').trim(), height: Math.round(e.getBoundingClientRect().height * 10) / 10, href: e.getAttribute('href'), testid: e.getAttribute('data-testid') }))
      .filter((c) => c.text),
  }));
  fs.appendFileSync(`${OUT}/texts.jsonl`, JSON.stringify({ name, ...info }) + '\n');
}

async function openInvite(page: Page, preview: Record<string, unknown> | null, opts: { signedOut?: boolean; query?: string; complete?: boolean } = {}) {
  const fake = new OrganiserFake({ signedOut: opts.signedOut ?? true, noOrganiser: true });
  await fake.install(page);
  const rpc = (n: string, body: unknown) => page.route(`**/rest/v1/rpc/${n}*`, (r) => json(r, body));
  await rpc('organiser_invite_preview_v1', preview);
  await rpc('set_my_role_intent_v1', { ok: true, roles: ['dancer', 'organiser'] });
  await rpc('claim_my_dancer_profile_v1', { ok: true, status: 'no_match', profile_id: null });
  await rpc('_my_dancer_profile_id_v1', 'p1');
  await rpc('profile_complete_v1', !!opts.complete);
  await rpc('request_new_invite_v1', { ok: true });
  await rpc('bind_organiser_invite_email_v1', { ok: true, status: 'bound' });
  await page.route('**/rest/v1/dancer_profiles*', (r) => json(r, { first_name: '', based_city_id: null, dance_role: null, avatar_url: null }));
  await page.goto(`/invite/${TOKEN}${opts.query ?? ''}`);
  await page.getByTestId('join-step').or(page.getByTestId('invite-card')).first().waitFor({ timeout: 30000 }).catch(() => undefined);
}

test('01 unknown link', async ({ page }) => { await openInvite(page, null); await snap(page, '01-unknown'); });
test('02 used link, signed out', async ({ page }) => { await openInvite(page, { ...OPEN, status: 'used' }); await snap(page, '02-used-signed-out'); });
test('03 expired link', async ({ page }) => { await openInvite(page, { ...OPEN, status: 'expired' }); await snap(page, '03-expired'); });
test('04 join card', async ({ page }) => {
  await openInvite(page, OPEN, { complete: true, query: '?step=code&email=diego%40ritmo.example' });
  await page.locator('input[autocomplete="one-time-code"]').fill('12345678');
  await page.getByTestId('invite-join').waitFor({ timeout: 30000 }).catch(() => undefined);
  await snap(page, '04-join-card');
});
