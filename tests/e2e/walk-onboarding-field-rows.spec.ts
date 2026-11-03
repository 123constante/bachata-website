import { test, type Page } from '@playwright/test';
import fs from 'node:fs';
import { ORG, ORG_NAME, OrganiserFake, PHONE, json } from './helpers/organiserFake';
import { DANCER_SHAPES } from '../../src/modules/dancer-app/api/fixtures';

// Walk of the Review-checklist field rows the first walk skipped (brief walk-onboarding-field-rows), 390x844.
// READ-ONLY: every server answer is simulated at the network boundary (page.route). No product code touched, no prod access.
// NOT in the CI gate list. Run: VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true npx playwright test tests/e2e/walk-onboarding-field-rows.spec.ts --project=chromium --workers=1
// Pictures: docs/walk/onboarding-field-rows/<nn>-*.png ; words on screen: texts.jsonl
test.use({ viewport: PHONE });
const OUT = 'docs/walk/onboarding-field-rows';
fs.mkdirSync(OUT, { recursive: true });

async function snap(page: Page, name: string, extra: Record<string, unknown> = {}) {
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' }).catch(() => undefined);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  const text = await page.evaluate(() => (document.body.innerText || '').replace(/\n{2,}/g, '\n'));
  const controls = await page.evaluate(() => Array.from(document.querySelectorAll('button,a,input,textarea')).filter((e) => (e as HTMLElement).offsetWidth > 0).map((e) => {
    const el = e as HTMLInputElement;
    const t = (el.textContent ?? '').trim() || el.placeholder || el.getAttribute('aria-label') || '';
    return `${el.tagName.toLowerCase()}:${t}${el.disabled || el.getAttribute('aria-disabled') === 'true' ? ' [DISABLED]' : ''}`;
  }));
  fs.appendFileSync(`${OUT}/texts.jsonl`, JSON.stringify({ name, url: page.url(), text, controls, ...extra }) + '\n');
}

const rpcUrl = (n: string) => `**/rest/v1/rpc/${n}*`;
const WITH_ME = DANCER_SHAPES.fourFieldComplete.profile as Record<string, unknown>;
type Opts = { igSave?: (body: Record<string, unknown>) => { status: number; body: unknown } | 'hang' | 'abort' | null; holdMs?: number };

/** Review with exactly one thing left (`code`); a successful write removes it from the status, as the server would. */
async function setup(page: Page, code: string, opts: Opts = {}) {
  const fake = new OrganiserFake({});
  await fake.install(page);
  let missing = [code];
  const person = ['instagram', 'dj_answer', 'dj_genres', 'teach_answer', 'teach_years', 'teach_levels'];
  const status = () => ({
    v: 1, gate_on: true, is_admin: false, complete: missing.length === 0,
    person: { complete: !missing.some((m) => person.includes(m)), missing: missing.filter((m) => person.includes(m)) },
    organisers: [{ id: ORG, name: ORG_NAME, role: 'owner', lifecycle: 'live', complete: !missing.some((m) => !person.includes(m)), missing: missing.filter((m) => !person.includes(m)), about: { done: true, skipped: false } }],
  });
  const log: string[] = [];
  await page.route('https://img.example/**', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>' }));
  await page.route(rpcUrl('get_organiser_contact_settings_v1'), (r) => json(r, { contact_phone: '+447700900123', contact_email: null, show_phone_publicly: true, show_email_publicly: false, claim_email: null }));
  await page.route(`**/rest/v1/organiser_profiles?*id=eq.${ORG}*`, (r) => json(r, { id: ORG, name: ORG_NAME, avatar_url: 'https://img.example/l.png', website: null, instagram: 'ritmo', socials: null, organisation_category: 'Promoter', city_id: null, bio: 'About us' }));
  await page.route(rpcUrl('organiser_onboarding_status_v1'), (r) => json(r, status()));
  await page.route(rpcUrl('my_dancer_edit_v1'), (r) => json(r, { ...WITH_ME, instagram: null }));
  await page.route(rpcUrl('dancer_area_gate_v1'), (r) => json(r, { open: false, allowed: true }));
  await page.route(rpcUrl('my_role_intent_v1'), (r) => json(r, { roles: [], declined: [] }));
  await page.route(rpcUrl('my_role_details_v1'), (r) => json(r, { role: (r.request().postDataJSON() as { p_role: string }).p_role, person_id: 'p1', details: {} }));
  const done = async (r: Parameters<Parameters<Page['route']>[1]>[0], body: unknown = { ok: true }) => {
    if (opts.holdMs) await new Promise((res) => setTimeout(res, opts.holdMs));
    return json(r, body);
  };
  for (const n of ['set_my_role_intent_v1', 'set_my_role_declined_v1', 'save_my_role_v1']) {
    await page.route(rpcUrl(n), async (r) => { log.push(`${n} ${r.request().postData()}`); missing = []; return done(r, n === 'save_my_role_v1' ? { role: (r.request().postDataJSON() as { p_role: string }).p_role, person_id: 'p1', details: {}, changed: true, changed_keys: ['x'] } : { roles: [], declined: [], changed: true }); });
  }
  await page.route(rpcUrl('organiser_profile_update_p5_v1'), async (r) => { log.push(`update_p5 ${r.request().postData()}`); missing = []; return done(r); });
  await page.route(rpcUrl('save_my_dancer_profile_v2'), async (r) => {
    const body = (r.request().postDataJSON() as { p_payload: Record<string, unknown> }).p_payload;
    log.push(`save_dancer ${JSON.stringify(body)}`);
    const o = opts.igSave?.(body);
    if (o === 'hang') return new Promise(() => undefined);
    if (o === 'abort') return r.abort('failed');
    if (o) return json(r, o.body, o.status);
    if (opts.holdMs) await new Promise((res) => setTimeout(res, opts.holdMs));
    missing = [];
    return json(r, { ...WITH_ME, ...body });
  });
  return { log };
}

const REVIEW = `/account/p3/start?at=review&o=${ORG}`;
async function toReview(page: Page, tag: string) {
  await page.goto(REVIEW);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.getByTestId('p3-ob-review-next').waitFor({ timeout: 30000 }).catch(() => undefined);
  await snap(page, `${tag}-a-review`);
}
const step = async (page: Page) => (await page.getByTestId('p3-ob-shell').getAttribute('data-screen').catch(() => null)) ?? 'none';

// ---- Instagram (opens the /app editor, not an onboarding screen) ----
const IG_ROW = 'p3-ob-review-instagram';
test.describe('instagram', () => {
  test('01 enter + success', async ({ page }) => {
    const { log } = await setup(page, 'instagram');
    await toReview(page, '01');
    await page.getByTestId(IG_ROW).click();
    await page.getByTestId('dancer-screen-edit').waitFor({ timeout: 20000 }).catch(() => undefined);
    await snap(page, '01-b-entered');
    await page.locator('#instagram').fill('@simon.bachata');
    await snap(page, '01-c-typed');
    await page.getByTestId('edit-save').click();
    await page.waitForTimeout(1500);
    await snap(page, '01-d-after-save', { log, screen: await step(page) });
  });
  const refusals: [string, string, Opts['igSave']][] = [
    ['02-invalid-22023', 'simon', () => ({ status: 400, body: { code: '22023', message: 'invalid_handle', details: 'instagram', hint: null } })],
    ['03-taken-23505', 'simon.bachata', () => ({ status: 409, body: { code: '23505', message: 'duplicate key value violates unique constraint "dancer_profiles_instagram_normalized_uidx"', details: 'Key (instagram_normalized)=(simon.bachata) already exists.', hint: null } })],
    ['04-network-failure', 'simon.bachata', () => 'abort'],
    ['05-server-500', 'simon.bachata', () => ({ status: 500, body: { code: 'XX000', message: 'internal error', details: null, hint: null } })],
  ];
  for (const [n, handle, igSave] of refusals) {
    test(n, async ({ page }) => {
      const { log } = await setup(page, 'instagram', { igSave });
      await toReview(page, n);
      await page.getByTestId(IG_ROW).click();
      await page.getByTestId('dancer-screen-edit').waitFor({ timeout: 20000 }).catch(() => undefined);
      await page.locator('#instagram').fill(handle);
      await page.getByTestId('edit-save').click();
      await page.waitForTimeout(1500);
      await snap(page, `${n}-b-after-save`, { log });
    });
  }
  test('06 client-side invalid handle (bad shape, nothing sent)', async ({ page }) => {
    const { log } = await setup(page, 'instagram');
    await toReview(page, '06');
    await page.getByTestId(IG_ROW).click();
    await page.getByTestId('dancer-screen-edit').waitFor({ timeout: 20000 }).catch(() => undefined);
    await page.locator('#instagram').fill('https://example.com/simon');
    await snap(page, '06-b-typed');
    await page.getByTestId('edit-save').click({ force: true, timeout: 3000 }).catch(() => undefined);
    await page.waitForTimeout(800);
    await snap(page, '06-c-after-tap', { log });
  });
  test('07 slow save (held 4s), double tap', async ({ page }) => {
    const { log } = await setup(page, 'instagram', { holdMs: 4000 });
    await toReview(page, '07');
    await page.getByTestId(IG_ROW).click();
    await page.getByTestId('dancer-screen-edit').waitFor({ timeout: 20000 }).catch(() => undefined);
    await page.locator('#instagram').fill('@simon.bachata');
    await page.getByTestId('edit-save').click();
    await page.waitForTimeout(300);
    await page.getByTestId('edit-save').click({ force: true, timeout: 1000 }).catch(() => undefined);
    await snap(page, '07-b-pending-0_3s');
    await page.waitForTimeout(2000);
    await snap(page, '07-c-pending-2_3s');
    await page.waitForTimeout(3000);
    await snap(page, '07-d-after', { log });
  });
});

// ---- Onboarding screens: generic driver ----
async function drive(page: Page, tag: string, row: string, plan: (page: Page, s: string) => Promise<void>, log: string[], maxSteps = 6) {
  await toReview(page, tag);
  await page.getByTestId(`p3-ob-review-${row}`).click();
  for (let i = 0; i < maxSteps; i++) {
    await page.waitForTimeout(700);
    const s = await step(page);
    await snap(page, `${tag}-${String.fromCharCode(98 + i)}-${s}-entered`, { screen: s });
    if (s === 'review' || s === 'none' || s === 'live') break;
    await plan(page, s);
    await snap(page, `${tag}-${String.fromCharCode(98 + i)}-${s}-filled`, { screen: s });
    const before = s;
    await page.getByTestId('p3-ob-continue').click({ timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(900);
    if ((await step(page)) === before) {
      await snap(page, `${tag}-${String.fromCharCode(98 + i)}-${s}-stuck`, { log });
      break;
    }
  }
  await snap(page, `${tag}-z-end`, { log, screen: await step(page) });
}
const tapFirst = async (page: Page, pattern: RegExp) => { const t = page.locator(`[data-testid^="p3-ob-"]`).filter({ hasText: pattern }).first(); if (await t.count()) await t.click(); };
const plan = (answers: { yes?: boolean; genres?: string; years?: string; link?: string }) => async (page: Page, s: string) => {
  if (s === 'teach' || s === 'dj') await page.getByRole('radio', { name: answers.yes === false ? /^No/ : /^Yes/ }).first().click().catch(() => tapFirst(page, answers.yes === false ? /^No/ : /^Yes/));
  if (s === 'djgenres') await page.getByTestId('p3-ob-djgenres').fill(answers.genres ?? 'Bachata sensual, Dominican');
  if (s === 'years') await page.getByTestId('p3-ob-years').fill(answers.years ?? '4');
  if (s === 'levels' || s === 'styles') await page.locator('.p3-ob-tile, .p3-ob-chip').first().click().catch(() => undefined);
  if (s === 'link') await page.getByTestId('p3-ob-link').fill(answers.link ?? '@ritmobachata');
};

for (const [n, row, a] of [
  ['10', 'dj_genres', {}], ['11', 'dj_answer', { yes: true }], ['12', 'dj_answer', { yes: false }],
  ['13', 'teach_years', {}], ['14', 'teach_levels', {}], ['15', 'teach_answer', { yes: true }], ['16', 'teach_answer', { yes: false }],
  ['17', 'org_link', {}], ['18', 'org_link', { link: 'not a link !!' }],
] as const) {
  test(`${n} ${row}${'yes' in a ? (a.yes ? ' yes' : ' no') : ''}${'link' in a ? ' invalid' : ''}`, async ({ page }) => {
    const { log } = await setup(page, row);
    await drive(page, `${n}-${row}`, row, plan(a), log);
  });
}
test('19 slow save on dj_genres (held 4s)', async ({ page }) => {
  const { log } = await setup(page, 'dj_genres', { holdMs: 4000 });
  await toReview(page, '19');
  await page.getByTestId('p3-ob-review-dj_genres').click();
  await page.getByTestId('p3-ob-djgenres').fill('Bachata');
  await page.getByTestId('p3-ob-continue').click();
  await page.waitForTimeout(300);
  await page.getByTestId('p3-ob-continue').click({ force: true, timeout: 1000 }).catch(() => undefined);
  await snap(page, '19-b-pending-0_3s');
  await page.waitForTimeout(5000);
  await snap(page, '19-c-after', { log });
});
test('20 network failure on dj_genres save', async ({ page }) => {
  const { log } = await setup(page, 'dj_genres');
  await page.route(rpcUrl('save_my_role_v1'), (r) => r.abort('failed'));
  await toReview(page, '20');
  await page.getByTestId('p3-ob-review-dj_genres').click();
  await page.getByTestId('p3-ob-djgenres').fill('Bachata');
  await page.getByTestId('p3-ob-continue').click();
  await page.waitForTimeout(1500);
  await snap(page, '20-b-after', { log });
});
test('21 way back to the event from a row', async ({ page }) => {
  await setup(page, 'dj_genres');
  await toReview(page, '21');
  await page.getByTestId('p3-ob-review-dj_genres').click();
  await page.waitForTimeout(700);
  await snap(page, '21-b-row');
  await page.getByTestId('p3-ob-back').click();
  await page.waitForTimeout(800);
  await snap(page, '21-c-after-back', { screen: await step(page) });
});
