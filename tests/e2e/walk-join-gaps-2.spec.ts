import { test, type Page } from '@playwright/test';
import fs from 'node:fs';
import { ORG, ORG_NAME, OrganiserFake, PHONE, json } from './helpers/organiserFake';

// Walk of join-gaps-2 (items 5-8) at 390x844. REPORT ONLY: every server answer is simulated at the network
// boundary (page.route); no prod access, no real token. NOT in the CI gate list. Run:
//   VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true npx playwright test tests/e2e/walk-join-gaps-2.spec.ts --project=chromium
test.use({ viewport: PHONE, reducedMotion: 'reduce' });

const OUT = 'docs/walk/join-gaps-2';
const TOKEN = 'ab12cd34'.repeat(8);
fs.mkdirSync(OUT, { recursive: true });

async function snap(page: Page, name: string) {
  await page.locator('h1,h2,h3,[data-testid="join-done"]').first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => undefined);
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' }).catch(() => undefined);
  await page.waitForTimeout(600);
  const full = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: PHONE.width, height: Math.max(full, PHONE.height) });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  const text = await page.evaluate(() => (document.body.innerText || '').replace(/\n{2,}/g, '\n'));
  const errorCard = /Something went wrong|couldn.t reach Bachata Calendar/i.test(text);
  fs.appendFileSync(`${OUT}/texts.jsonl`, JSON.stringify({ name, url: page.url().replace(TOKEN, '<token>'), errorCard, text }) + '\n');
}

const OPEN = { status: 'open', organiser_name: ORG_NAME, inviter_first_name: 'Diego', email_hint: null };
const CODES = {
  10: { person: ['first_name', 'city', 'dance_role', 'photo', 'nationality', 'languages', 'teach_answer', 'dj_answer'], org: ['org_logo', 'contact_confirm'] },
  3: { person: ['first_name', 'photo'], org: ['org_logo'] },
  0: { person: [], org: [] },
} as const;
const statusFor = (n: keyof typeof CODES) => ({
  v: 1, gate_on: true, is_admin: false, complete: n === 0,
  person: { complete: n === 0, missing: CODES[n].person },
  organisers: [{ id: ORG, name: ORG_NAME, role: 'owner', lifecycle: 'live', complete: n === 0, missing: CODES[n].org, about: { done: false, skipped: false } }],
});

async function setup(page: Page, preview: Record<string, unknown>, o: { signedOut?: boolean; complete?: boolean; left?: keyof typeof CODES } = {}) {
  const fake = new OrganiserFake({ signedOut: o.signedOut ?? false, noOrganiser: true });
  await fake.install(page);
  const rpc = (name: string, body: unknown) => page.route(`**/rest/v1/rpc/${name}*`, (r) => json(r, body));
  await rpc('organiser_invite_preview_v1', preview);
  await rpc('set_my_role_intent_v1', { ok: true, roles: ['dancer', 'organiser'] });
  await rpc('claim_my_dancer_profile_v1', { ok: true, status: 'no_match', profile_id: null });
  await rpc('_my_dancer_profile_id_v1', 'p1');
  await rpc('profile_complete_v1', o.complete ?? true);
  await rpc('request_new_invite_v1', { ok: true });
  await rpc('redeem_organiser_invite_v1', { ok: true, status: 'redeemed', organiser_id: ORG });
  await rpc('organiser_onboarding_status_v1', statusFor(o.left ?? 3));
  await page.route('**/rest/v1/dancer_profiles*', (r) => json(r, o.complete === false ? { first_name: '', based_city_id: null, dance_role: null, avatar_url: null } : { first_name: 'Diego', based_city_id: 'c1', dance_role: 'leader', avatar_url: null }));
}

test.describe('Item 5: About with and without the site banner', () => {
  test('A1 /invite (no banner)', async ({ page }) => {
    await setup(page, OPEN, { complete: false });
    await page.goto(`/invite/${TOKEN}`);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await snap(page, 'A1-about-invite-no-banner');
  });
  test('A2 /parties (banner as before)', async ({ page }) => {
    await setup(page, OPEN, { complete: false });
    await page.goto('/parties');
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await snap(page, 'A2-parties-banner-unchanged');
  });
});

test.describe('Item 6: Request sent', () => {
  test('B1 before / B2 after', async ({ page }) => {
    await setup(page, { ...OPEN, status: 'expired' }, { signedOut: true });
    await page.goto(`/invite/${TOKEN}`);
    await page.getByTestId('invite-new-link').waitFor({ timeout: 30000 }).catch(() => undefined);
    await snap(page, 'B1-request-before');
    await page.getByTestId('invite-new-link').click().catch(() => undefined);
    await page.getByTestId('invite-new-link-done').waitFor({ timeout: 10000 }).catch(() => undefined);
    await snap(page, 'B2-request-sent');
  });
});

test.describe('Item 7: Done page by rows left', () => {
  for (const n of [0, 3, 10] as const) {
    test(`C Done with ${n} left`, async ({ page }) => {
      await setup(page, OPEN, { left: n });
      await page.goto(`/invite/${TOKEN}`);
      await page.getByTestId('invite-join').waitFor({ timeout: 30000 }).catch(() => undefined);
      await page.getByTestId('invite-join').click().catch(() => undefined);
      await page.getByTestId('join-done').waitFor({ timeout: 15000 }).catch(() => undefined);
      await page.waitForTimeout(800);
      await snap(page, `C-done-${n}-left`);
    });
  }
});

test.describe('Item 8: revoked link', () => {
  test('D1 join page', async ({ page }) => {
    await setup(page, { ...OPEN, status: 'revoked' }, { signedOut: true });
    await page.goto(`/invite/${TOKEN}`);
    await page.getByTestId('invite-new-link').waitFor({ timeout: 30000 }).catch(() => undefined);
    await snap(page, 'D1-revoked-join-page');
  });
  test('D2 legacy page route', async ({ page }) => {
    await setup(page, { ...OPEN, status: 'revoked' }, { signedOut: true });
    await page.goto(`/invite/${TOKEN}?legacy=1`);
    await page.getByTestId('invite-new-link').waitFor({ timeout: 30000 }).catch(() => undefined);
    await snap(page, 'D2-revoked-legacy');
  });
});
