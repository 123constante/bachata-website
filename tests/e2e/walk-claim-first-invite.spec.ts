import { test, type Page } from '@playwright/test';
import fs from 'node:fs';
import { ORG, OrganiserFake, PHONE, json } from './helpers/organiserFake';

// Walk of the claim-first organiser invite (docs/briefs/claim-first-organiser-invite.md) at 390x844. REPORT ONLY:
// every server answer is simulated at the network boundary (page.route) in the prod shapes surveyed 2026-11-13;
// no prod access, no real token. NOT in the CI gate list. Run:
//   VITE_ENABLE_CLAIM_FIRST_INVITE=true VITE_ENABLE_ORGANISER_SELF_SERVE=true npx playwright test tests/e2e/walk-claim-first-invite.spec.ts --project=chromium
test.use({ viewport: PHONE, reducedMotion: 'reduce' });

const OUT = 'docs/walk/claim-first-invite';
const TOKEN = 'ef56ab78'.repeat(8);
const NAME = 'Sueno Events';
fs.mkdirSync(OUT, { recursive: true });

async function snap(page: Page, name: string) {
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' }).catch(() => undefined);
  await page.locator('main h1').first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => undefined);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  const text = await page.evaluate(() => (document.body.innerText || '').replace(/\n{2,}/g, '\n'));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  fs.appendFileSync(`${OUT}/texts.jsonl`, JSON.stringify({ name, overflow, text }) + '\n');
}

const OPEN = { status: 'open', organiser_name: NAME, inviter_first_name: 'Ricky', email_hint: 'd***@ritmo.example', self_bound: false, prefill: { first_name: null, city_id: null } };

async function setup(page: Page, preview: Record<string, unknown>, o: { signedOut?: boolean; complete?: boolean } = {}) {
  const fake = new OrganiserFake({ signedOut: o.signedOut ?? false, noOrganiser: true });
  await fake.install(page);
  const rpc = (name: string, body: unknown) => page.route(`**/rest/v1/rpc/${name}*`, (r) => json(r, body));
  await rpc('organiser_invite_preview_v1', preview);
  await rpc('claim_my_dancer_profile_v1', { ok: true, status: 'no_match', profile_id: null });
  await rpc('_my_dancer_profile_id_v1', 'p1');
  await rpc('profile_complete_v1', o.complete ?? true);
  await rpc('redeem_organiser_invite_v1', { ok: true, status: 'redeemed', organiser_id: ORG });
  await page.route('**/rest/v1/dancer_profiles*', (r) => json(r, o.complete === false ? { first_name: '', based_city_id: 'c1', dance_role: 'leader', avatar_url: 'https://example.com/a.jpg' } : { first_name: 'Maria', based_city_id: 'c1', dance_role: 'leader', avatar_url: null }));
}

test('C1 signed out: claim first, then email', async ({ page }) => {
  await setup(page, OPEN, { signedOut: true });
  await page.goto(`/invite/${TOKEN}`);
  await page.getByTestId('join-claim').waitFor({ timeout: 30000 });
  await snap(page, 'C1-claim-signed-out');
  await page.getByTestId('join-claim-confirm').click();
  await page.getByTestId('join-step').and(page.locator('[data-step="email"]')).waitFor({ timeout: 10000 });
  await snap(page, 'C2-email-after-claim');
});

test('C3 signed in, no name yet: claim, then Now about you, org name soft prompt', async ({ page }) => {
  await setup(page, OPEN, { complete: false });
  await page.goto(`/invite/${TOKEN}`);
  await page.getByTestId('join-claim').waitFor({ timeout: 30000 });
  await snap(page, 'C3-claim-signed-in');
  await page.getByTestId('join-claim-confirm').click();
  await page.getByTestId('join-about-form').waitFor({ timeout: 10000 });
  await snap(page, 'C4-now-about-you');
  await page.getByTestId('join-about-first-name').fill(NAME);
  await snap(page, 'C5-org-name-refused');
  await page.getByTestId('join-about-first-name').fill('Maria');
  await snap(page, 'C6-own-name-ok');
});

test('C7 finished profile: straight to Join (no claim screen)', async ({ page }) => {
  await setup(page, OPEN, { complete: true });
  await page.goto(`/invite/${TOKEN}`);
  await page.locator('[data-step="join"]').waitFor({ timeout: 30000 });
  await snap(page, 'C7-join-finished-profile');
});

test('C8 expired link: dead end, no claim screen', async ({ page }) => {
  await setup(page, { ...OPEN, status: 'expired' }, { signedOut: true });
  await page.goto(`/invite/${TOKEN}`);
  await page.locator('[data-step="dead"]').waitFor({ timeout: 30000 });
  await snap(page, 'C8-expired');
});
