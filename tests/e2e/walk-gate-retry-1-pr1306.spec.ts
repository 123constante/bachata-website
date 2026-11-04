import { test, type Page } from '@playwright/test';
import fs from 'node:fs';
import { FRIDAY, ORG, ORG_NAME, OrganiserFake, PHONE, json } from './helpers/organiserFake';

// Walk of PR #1306 (p3-gate-retry-1) at 390x844: Details and Prices open while details are left; the gate sheet at Save;
// ONE count (the sheet's "N things left"); typing kept. REPORT ONLY. Every server answer is a page.route mock; no prod access.
// NOT in the CI gate list. Needs the P3 flags:
//   VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true npx playwright test tests/e2e/walk-gate-retry-1-pr1306.spec.ts --project=chromium
// Pictures + texts.jsonl (text, controls with heights, sweep): docs/walk/gate-retry-1-pr1306/
test.use({ viewport: PHONE, reducedMotion: 'reduce' });

const OUT = 'docs/walk/gate-retry-1-pr1306';
fs.mkdirSync(OUT, { recursive: true });
const ORG2 = 'b0000000-0000-4000-8000-0000000000b2';

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
  await page.setViewportSize(PHONE);
  const text = await page.evaluate(() => (document.body.innerText || '').replace(/\n{2,}/g, '\n'));
  const sweep = await page.evaluate(() => {
    const vis = Array.from(document.querySelectorAll('button,a,input,select,textarea,[role=switch]')).filter((e) => {
      const r = (e as HTMLElement).getBoundingClientRect();
      return r.width > 0 && r.height > 0 && (e as HTMLInputElement).type !== 'hidden' && getComputedStyle(e).visibility !== 'hidden';
    });
    const small = vis.map((e) => ({ t: ((e.textContent ?? '').trim() || e.getAttribute('aria-label') || e.getAttribute('data-testid') || e.tagName).slice(0, 40), h: Math.round((e as HTMLElement).getBoundingClientRect().height), w: Math.round((e as HTMLElement).getBoundingClientRect().width) }))
      .filter((c) => c.h < 44 && !(c.w < 2));
    return { small, sideways: document.documentElement.scrollWidth > window.innerWidth + 1, scrollW: document.documentElement.scrollWidth };
  });
  const garbled = /â€|Ã.|Â|�|&mdash;|&hellip;|&rsquo;/.test(text);
  fs.appendFileSync(`${OUT}/texts.jsonl`, JSON.stringify({ name, url: page.url(), text, sweep: { ...sweep, garbled }, ...extra }) + '\n');
  // Recheck guard: an error page is a FAILED walk, never a picture of a state.
  if (/Something went wrong|couldn.t reach Bachata Calendar/i.test(text)) throw new Error('ERROR CARD on ' + name);
  return text;
}

const PERSON = ['first_name', 'city', 'dance_role', 'photo', 'nationality', 'languages', 'teach_answer', 'dj_answer'];
const ORGC = ['org_logo', 'contact_confirm'];
const pick = (n: number) => { const all = [...PERSON, ...ORGC]; return all.slice(0, n); };
const split = (codes: string[]) => ({ person: codes.filter((c) => PERSON.includes(c)), org: codes.filter((c) => ORGC.includes(c)) });
const statusFor = (n: number, orgId = ORG, two = false) => {
  const { person, org } = split(pick(n));
  const mk = (id: string, name: string, missing: string[]) => ({ id, name, role: 'owner', lifecycle: 'live', complete: missing.length === 0, missing, about: { done: false, skipped: false } });
  return {
    v: 1, gate_on: true, is_admin: false, complete: n === 0,
    person: { complete: person.length === 0, missing: person },
    organisers: two ? [mk(ORG, ORG_NAME, orgId === ORG ? org : []), mk(ORG2, 'Second Page', orgId === ORG2 ? org : [])] : [mk(ORG, ORG_NAME, org)],
  };
};
const REFUSAL = (n: number) => ({ code: 'P0001', message: 'onboarding_incomplete', details: JSON.stringify({ missing: pick(Math.max(n, 1)), organiser_id: ORG }), hint: null });

type P = { id: string; admin: boolean; left: number; refusedWhenOn: boolean; two?: boolean; statusFails?: boolean; progressReady: boolean };
const PEOPLE: P[] = [
  { id: 'P1', admin: false, left: 3, refusedWhenOn: true, progressReady: false },
  { id: 'P2', admin: false, left: 0, refusedWhenOn: false, progressReady: true },
  { id: 'P3a', admin: false, left: 6, refusedWhenOn: true, two: true, progressReady: false },
  { id: 'P3b', admin: false, left: 0, refusedWhenOn: false, two: true, progressReady: true },
  { id: 'P4', admin: true, left: 10, refusedWhenOn: false, progressReady: false },
  { id: 'P8', admin: false, left: 3, refusedWhenOn: true, statusFails: true, progressReady: false },
];
const progress = (ready: boolean) => ({ percent: ready ? 100 : 40, required_left: ready ? 0 : 5, publish_ready: ready, steps: [], declined: [] });

async function setup(page: Page, p: P, gateOn: boolean, leftOverride?: number) {
  const left = leftOverride ?? p.left;
  const fake = new OrganiserFake({});
  await fake.install(page);
  await page.route('**/rest/v1/rpc/admin_is_admin*', (r) => json(r, p.admin));
  await page.route('**/rest/v1/rpc/my_profile_progress_v1*', (r) => (p.statusFails ? json(r, { code: 'XX000', message: 'boom' }, 500) : json(r, progress(p.progressReady))));
  await page.route('**/rest/v1/rpc/organiser_onboarding_status_v1*', (r) => (p.statusFails ? json(r, { code: 'XX000', message: 'boom' }, 500) : json(r, statusFor(left, ORG, p.two))));
  await page.route('**/rest/v1/rpc/get_organiser_contact_settings_v1*', (r) => json(r, { contact_phone: null, contact_email: null, show_phone_publicly: false, show_email_publicly: false, claim_email: null }));
  const sent: string[] = [];
  const refused = gateOn && p.refusedWhenOn;
  await page.route('**/rest/v1/rpc/series_command_p5*', (r) => {
    const body = r.request().postData() ?? '';
    if (!/"dry_run":true/.test(body)) sent.push(body);
    return refused ? json(r, REFUSAL(left), 400) : json(r, { ok: true, new_version: 8, data: {} });
  });
  return { sent, refused };
}

const SCREENS = {
  details: { path: `/account/p3/events/${FRIDAY}/details`, ctl: 'p3-d-name', kept: 'p3-details-kept', lock: 'p3-details-lock', edit: async (page: Page) => { await page.getByTestId('p3-d-name').fill('Typed Before Refusal'); } },
  prices: { path: `/account/p3/events/${FRIDAY}/prices`, ctl: 'p3-free-switch', kept: 'p3-prices-kept', lock: 'p3-prices-lock', edit: async (page: Page) => { await page.getByTestId('p3-free-switch').click(); } },
} as const;

test.describe('gate-retry-1: person x gate x screen', () => {
  for (const p of PEOPLE) for (const gateOn of [true, false]) for (const sid of ['details', 'prices'] as const) {
    test(`${p.id} gate-${gateOn ? 'on' : 'off'} ${sid}`, async ({ page }) => {
      const sc = SCREENS[sid];
      const key = `${p.id}-g${gateOn ? 'on' : 'off'}-${sid}`;
      const { sent, refused } = await setup(page, p, gateOn);
      await page.goto(sc.path);
      await page.getByTestId(sc.ctl).waitFor({ timeout: 30000 });
      const lock = await page.getByTestId(sc.lock).count();
      await snap(page, `${key}-1-open`, { lockBox: lock, savesSent: sent.length });
      await sc.edit(page);
      await page.getByTestId('p3-save').click();
      if (refused) {
        await page.getByTestId('p3-gate').waitFor({ timeout: 10000 });
        await snap(page, `${key}-2-sheet`, { savesSent: sent.length, rows: await page.getByTestId('p3-gate-rows').locator('li').allInnerTexts().catch(() => []) });
        await page.getByTestId('p3-gate-go').click();
        // FINDING: Continue on a dirty screen meets the "Leave without saving?" guard. Picture it, then walk on through it.
        const guard = page.getByRole('button', { name: 'Leave and lose them' });
        if (await guard.waitFor({ timeout: 4000 }).then(() => true).catch(() => false)) {
          await snap(page, `${key}-2b-leave-guard`, { guard: true });
          await guard.click();
        }
        await page.getByTestId('p3-ob-title').waitFor({ timeout: 20000 });
        await page.waitForTimeout(500);
        const list = await snap(page, `${key}-3-checklist`);
        if (!list.includes('Back to your event')) throw new Error('no way back to the event');
        await page.getByText('Back to your event', { exact: true }).click();
        await page.getByTestId(sc.kept).waitFor({ timeout: 20000 });
        await snap(page, `${key}-4-kept`, { savesSent: sent.length });
      } else {
        await page.getByTestId('p3-event').waitFor({ timeout: 15000 }).catch(() => undefined);
        await page.waitForTimeout(500);
        await snap(page, `${key}-2-saved`, { savesSent: sent.length, gateOpen: await page.getByTestId('p3-gate').count() });
      }
    });
  }
});

test.describe('gate-retry-1: the one count on Home, event page and the sheet', () => {
  for (const n of [10, 6, 3, 1, 0]) {
    test(`P1 gate-on, ${n} left`, async ({ page }) => {
      const p = PEOPLE[0];
      const { sent } = await setup(page, p, true, n);
      const key = `count-${n}`;
      await page.goto(`/account/p3?o=${ORG}`);
      await page.waitForLoadState('networkidle').catch(() => undefined);
      await snap(page, `${key}-1-home`);
      await page.goto(SCREENS.details.path);
      await page.getByTestId('p3-d-name').waitFor({ timeout: 30000 });
      await snap(page, `${key}-2-details-open`);
      await SCREENS.details.edit(page);
      await page.getByTestId('p3-save').click();
      await page.getByTestId('p3-gate').waitFor({ timeout: 10000 });
      await snap(page, `${key}-3-sheet`, { savesSent: sent.length, count: await page.getByTestId('p3-gate-count').innerText().catch(() => null), rows: await page.getByTestId('p3-gate-rows').locator('li').allInnerTexts().catch(() => []) });
    });
  }
});
