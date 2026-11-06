import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import { FRIDAY, ORG, ORG_NAME, OrganiserFake, PHONE, json } from './helpers/organiserFake';

// Walk of p3-gate-guard-1 at 390x844 (reuses walk-gate-retry-1-pr1306.spec.ts from claude/walk-gate-retry-1-pr1306):
// gate on, Details and Prices: refuse, Continue -> the checklist with NO "Leave without saving?", Back to your event,
// typing kept; and the Events tab / phone Back / Back link with typing still ask. Every server answer is a page.route
// mock; no prod access. NOT in the CI gate list. Needs the P3 flags:
//   VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true npx playwright test tests/e2e/walk-p3-gate-guard-1.spec.ts --project=chromium
// P8 is mocked HONESTLY now: the status read fails ONCE (the sheet's read) and answers after, as a blip does. The old
// walk failed it on every read forever, so the checklist (which needs the same read) could only show its own
// "We couldn't load your page. Try again." screen: that cell is kept as P8x and pictured as such.
test.use({ viewport: PHONE, reducedMotion: 'reduce' });

const OUT = 'docs/walk/p3-gate-guard-1';
fs.mkdirSync(OUT, { recursive: true });
const ORG2 = 'b0000000-0000-4000-8000-0000000000b2';

async function snap(page: Page, name: string, extra: Record<string, unknown> = {}) {
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' }).catch(() => undefined);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  const text = await page.evaluate(() => (document.body.innerText || '').replace(/\n{2,}/g, '\n'));
  const small = await page.evaluate(() => Array.from(document.querySelectorAll('.p3-theme button,.p3-theme a,.p3-theme input,.p3-theme textarea'))
    .map((e) => ({ t: ((e.textContent ?? '').trim() || e.getAttribute('data-testid') || e.tagName).slice(0, 30), r: (e as HTMLElement).getBoundingClientRect() }))
    .filter((c) => c.r.width > 1 && c.r.height > 0 && c.r.height < 44).map((c) => `${c.t}:${Math.round(c.r.height)}`));
  fs.appendFileSync(`${OUT}/texts.jsonl`, JSON.stringify({ name, url: page.url(), small, text: text.slice(0, 600), ...extra }) + '\n');
  if (/Something went wrong|couldn.t reach Bachata Calendar/i.test(text)) throw new Error('ERROR CARD on ' + name);
  return text;
}

const PERSON = ['first_name', 'city', 'dance_role', 'photo', 'nationality', 'languages', 'teach_answer', 'dj_answer'];
const ORGC = ['org_logo', 'contact_confirm'];
const pick = (n: number) => [...PERSON, ...ORGC].slice(0, n);
const statusFor = (n: number, two = false) => {
  const codes = pick(n);
  const person = codes.filter((c) => PERSON.includes(c));
  const org = codes.filter((c) => ORGC.includes(c));
  const mk = (id: string, name: string, missing: string[]) => ({ id, name, role: 'owner', lifecycle: 'live', complete: missing.length === 0, missing, about: { done: false, skipped: false } });
  return {
    v: 1, gate_on: true, is_admin: false, complete: n === 0,
    person: { complete: person.length === 0, missing: person },
    organisers: two ? [mk(ORG, ORG_NAME, org), mk(ORG2, 'Second Page', [])] : [mk(ORG, ORG_NAME, org)],
  };
};
const REFUSAL = (n: number) => ({ code: 'P0001', message: 'onboarding_incomplete', details: JSON.stringify({ missing: pick(Math.max(n, 1)), organiser_id: ORG }), hint: null });

type P = { id: string; left: number; two?: boolean; statusFailsOnce?: boolean; statusFailsAlways?: boolean };
const PEOPLE: P[] = [
  { id: 'P1', left: 3 },
  { id: 'P3a', left: 6, two: true },
  { id: 'P8', left: 3, statusFailsOnce: true },
];

async function setup(page: Page, p: P) {
  const fake = new OrganiserFake({});
  await fake.install(page);
  let statusReads = 0;
  await page.route('**/rest/v1/rpc/admin_is_admin*', (r) => json(r, false));
  await page.route('**/rest/v1/rpc/my_profile_progress_v1*', (r) => json(r, { percent: 40, required_left: 5, publish_ready: false, steps: [], declined: [] }));
  await page.route('**/rest/v1/rpc/organiser_onboarding_status_v1*', (r) => {
    statusReads += 1;
    const fail = p.statusFailsAlways || (p.statusFailsOnce && statusReads === 1);
    return fail ? json(r, { code: 'XX000', message: 'boom' }, 500) : json(r, statusFor(p.left, p.two));
  });
  await page.route('**/rest/v1/rpc/get_organiser_contact_settings_v1*', (r) => json(r, { contact_phone: null, contact_email: null, show_phone_publicly: false, show_email_publicly: false, claim_email: null }));
  const sent: string[] = [];
  await page.route('**/rest/v1/rpc/series_command_p5*', (r) => {
    const body = r.request().postData() ?? '';
    if (!/"dry_run":true/.test(body)) sent.push(body);
    return json(r, REFUSAL(p.left), 400);
  });
  return { sent };
}

const SCREENS = {
  details: { path: `/account/p3/events/${FRIDAY}/details`, ctl: 'p3-d-name', kept: 'p3-details-kept', edit: async (page: Page) => { await page.getByTestId('p3-d-name').fill('Typed Before Refusal'); }, typed: async (page: Page) => (await page.getByTestId('p3-d-name').inputValue()) === 'Typed Before Refusal' },
  prices: { path: `/account/p3/events/${FRIDAY}/prices`, ctl: 'p3-free-switch', kept: 'p3-prices-kept', edit: async (page: Page) => { await page.getByTestId('p3-free-switch').click(); }, typed: async (page: Page) => page.getByTestId('p3-free-switch').isChecked() },
} as const;

async function refuse(page: Page, p: P, sid: keyof typeof SCREENS, viaEvent = false) {
  const sc = SCREENS[sid];
  const r = await setup(page, p);
  if (viaEvent) {
    // an in-app arrival, so phone Back is a router Back (as on a phone), not a full page load
    await page.goto(`/account/p3/events/${FRIDAY}`);
    await page.getByTestId(`p3-open-${sid}`).click();
  } else {
    await page.goto(sc.path);
  }
  await page.getByTestId(sc.ctl).waitFor({ timeout: 30000 });
  await sc.edit(page);
  await page.getByTestId('p3-save').click();
  await page.getByTestId('p3-gate').waitFor({ timeout: 10000 });
  return r;
}

test.describe('gate-guard-1: gate Continue goes straight to the checklist', () => {
  for (const p of PEOPLE) for (const sid of ['details', 'prices'] as const) {
    test(`${p.id} gate-on ${sid}`, async ({ page }) => {
      const sc = SCREENS[sid];
      const key = `${p.id}-${sid}`;
      const { sent } = await refuse(page, p, sid);
      if (sid === 'details') {
        const h = await page.getByTestId('p3-d-name').evaluate((e) => Math.round(e.getBoundingClientRect().height));
        fs.appendFileSync(`${OUT}/texts.jsonl`, JSON.stringify({ name: `${key}-name-height`, nameFieldPx: h }) + '\n');
        expect(h).toBeGreaterThanOrEqual(44);
      }
      await snap(page, `${key}-1-sheet`, { savesSent: sent.length });
      await page.getByTestId('p3-gate-go').click();
      await page.getByTestId('p3-ob-title').waitFor({ timeout: 20000 });
      expect(await page.getByTestId('p3-leave-go').count()).toBe(0);
      const list = await snap(page, `${key}-2-checklist`, { leaveSheet: await page.getByTestId('p3-leave-go').count() });
      expect(list).toContain('Back to your event');
      expect(list).not.toContain('Leave without saving');
      await page.getByText('Back to your event', { exact: true }).click();
      await page.getByTestId(sc.kept).waitFor({ timeout: 20000 });
      expect(await sc.typed(page)).toBe(true);
      await snap(page, `${key}-3-kept`, { savesSent: sent.length });
      expect(sent).toHaveLength(1);
    });
  }
});

test.describe('gate-guard-1: other exits with typing still ask', () => {
  for (const sid of ['details', 'prices'] as const) for (const exit of ['events-tab', 'phone-back', 'back-link'] as const) {
    test(`P1 ${sid} ${exit} after Not now`, async ({ page }) => {
      const sc = SCREENS[sid];
      const { sent } = await refuse(page, PEOPLE[0], sid, true);
      await page.getByTestId('p3-gate-not-now').click();
      await page.getByTestId('p3-gate').waitFor({ state: 'detached' });
      if (exit === 'events-tab') await page.locator('nav[aria-label="Main"] a[data-tab="events"]').click();
      if (exit === 'phone-back') await page.goBack().catch(() => undefined);
      if (exit === 'back-link') await page.getByTestId('p3-edit-back').click();
      await page.getByTestId('p3-leave-go').waitFor({ timeout: 10000 });
      await snap(page, `P1-${sid}-${exit}-leave-sheet`, { savesSent: sent.length });
      await page.getByTestId('p3-keep-editing').click();
      expect(new URL(page.url()).pathname).toBe(sc.path);
      expect(await sc.typed(page)).toBe(true);
    });
  }
});

test('P8x status read fails on EVERY read: the checklist says so in words, the typing is kept', async ({ page }) => {
  const p: P = { id: 'P8x', left: 3, statusFailsAlways: true };
  const { sent } = await refuse(page, p, 'details');
  await snap(page, 'P8x-details-1-sheet');
  await page.getByTestId('p3-gate-go').click();
  expect(await page.getByTestId('p3-leave-go').count()).toBe(0);
  await page.getByTestId('p3-ob-readfail').waitFor({ timeout: 20000 });
  await snap(page, 'P8x-details-2-checklist-readfail', { savesSent: sent.length, kept: await page.evaluate((id) => !!sessionStorage.getItem(`p3-kept-edit:${id}`), FRIDAY) });
  expect(await page.evaluate((id) => sessionStorage.getItem(`p3-kept-edit:${id}`), FRIDAY)).toContain('Typed Before Refusal');
});
