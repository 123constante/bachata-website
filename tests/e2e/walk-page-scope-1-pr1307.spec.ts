import { test, type Page } from '@playwright/test';
import fs from 'node:fs';
import { FakeOrganiser, OrganiserFake, PHONE, json } from './helpers/organiserFake';

// Walk of PR #1307 (F-26 page scope) at 390x844. READ-ONLY: every answer is simulated at the network boundary.
// NOT in the CI gate. Run: VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true npx playwright test tests/e2e/walk-page-scope-1-pr1307.spec.ts --project=chromium
// Pictures: docs/walk/page-scope-1-pr1307/<nn>-*.png ; text + sweep: texts.jsonl
test.use({ viewport: PHONE, reducedMotion: 'reduce' });
const OUT = 'docs/walk/page-scope-1-pr1307';
fs.mkdirSync(OUT, { recursive: true });

const O2 = 'a0000000-0000-4000-8000-000000000002';
const O3 = 'a0000000-0000-4000-8000-000000000003';
const SHARED = 'b0000000-0000-4000-8000-0000000000aa';
const ONLY2 = 'b0000000-0000-4000-8000-0000000000bb';
const ONLY3 = 'b0000000-0000-4000-8000-0000000000cc';

async function snap(page: Page, name: string, extra: Record<string, unknown> = {}) {
  await page.locator('h1,h2,h3,[data-testid="p3-page-name"]').first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => undefined);
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' }).catch(() => undefined);
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), undefined, { timeout: 10000 }).catch(() => undefined);
  await page.waitForTimeout(500);
  const full = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: PHONE.width, height: Math.max(full, PHONE.height) });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  const text = await page.evaluate(() => (document.body.innerText || '').replace(/\n{2,}/g, '\n'));
  const sweep = await page.evaluate(() => {
    const small = Array.from(document.querySelectorAll('button,a,[role=button]')).filter((e) => { const r = (e as HTMLElement).getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 44; }).map((e) => `${(e.textContent ?? '').trim().slice(0, 30)}(${Math.round((e as HTMLElement).getBoundingClientRect().height)}px)`);
    return { smallTaps: small, sideways: document.documentElement.scrollWidth > window.innerWidth + 1 };
  });
  const garbled = /Ã|â€|Â|�|&mdash;|&rsquo;|&hellip;|&amp;/.test(text);
  const errorCard = /Something went wrong|couldn.t reach Bachata Calendar/i.test(text);
  fs.appendFileSync(`${OUT}/texts.jsonl`, JSON.stringify({ name, url: page.url(), errorCard, garbled, ...sweep, text, ...extra }) + '\n');
  await page.setViewportSize(PHONE);
}

type Person = 1 | 2 | 3;
async function setup(page: Page, pages: Person | 0, opts: { admin?: boolean; remembered?: string } = {}) {
  const fake = new OrganiserFake(pages === 0 ? { noOrganiser: true } : {});
  if (pages >= 1) {
    const base = fake.organisers[0];
    base.name = 'Ritmo Bachata London';
    const mk = (id: string, name: string): FakeOrganiser => ({ ...base, id, name, series: [], is_primary: false } as FakeOrganiser);
    // Friday + Sunday belong to page 1 only; SHARED is run by pages 1 and 2 (and 3 when present).
    fake.addSeries(base, { id: SHARED, name: 'Shared Social', category: 'party', default_start_date: '2026-10-10', recurrence_rule: { mode: 'weekly', weekdays: [6], end: { kind: 'none' } } });
    if (pages >= 2) {
      const o2 = mk(O2, 'Zouk and Sway');
      fake.organisers.push(o2);
      fake.addSeries(o2, { id: ONLY2, name: 'Tuesday Practica', category: 'class', default_start_date: '2026-10-13', recurrence_rule: { mode: 'weekly', weekdays: [2], end: { kind: 'none' } } });
      o2.series.push(SHARED);
    }
    if (pages >= 3) {
      const o3 = mk(O3, 'Alpha Dance Co');
      fake.organisers.push(o3);
      fake.addSeries(o3, { id: ONLY3, name: 'Monday Footwork', category: 'class', default_start_date: '2026-10-12', recurrence_rule: { mode: 'weekly', weekdays: [1], end: { kind: 'none' } } });
      o3.series.push(SHARED);
    }
  }
  await fake.install(page);
  const status = { v: 1, gate_on: true, is_admin: !!opts.admin, complete: true, person: { complete: true, missing: [] },
    organisers: fake.organisers.map((o) => ({ id: o.id, name: o.name, role: o.role, lifecycle: 'live', complete: true, missing: [], about: { done: true, skipped: false } })) };
  await page.route('**/rest/v1/rpc/organiser_onboarding_status_v1*', (r) => json(r, status));
  const days = Array.from({ length: 30 }, (_, i) => { const d = new Date(Date.UTC(2026, 8, 9 + i, 12)); return d.toISOString().slice(0, 10); });
  await page.route('**/rest/v1/rpc/organiser_series_stats_v1*', (r) => json(r, {
    from: days[0], to: '2026-10-08',
    series: [...fake.series.keys()].map((id, i) => ({ series_id: id, name: fake.series.get(id)!.name, views_total: (i + 1) * 100, views_by_day: days.slice(-5).map((day) => ({ day, count: (i + 1) * 20 })) })),
  }));
  if (opts.remembered) await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [`org-r1-chosen-page:11111111-1111-4111-8111-111111111111`, opts.remembered]);
  return fake;
}
const go = async (page: Page, path: string) => { await page.goto(path); await page.waitForLoadState('networkidle').catch(() => undefined); };

for (const n of [1, 2, 3] as const) {
  test.describe(`person with ${n} page(s)`, () => {
    for (const [i, screen] of [['home', '/account/p3'], ['events', '/account/p3/events'], ['stats', '/account/p3/stats']] as const) {
      test(`${n}p ${screen}`, async ({ page }) => {
        await setup(page, n);
        await go(page, screen);
        await snap(page, `${n}p-${i}-${screen.split('/').pop()}`);
      });
    }
    if (n >= 2) {
      test(`${n}p switch in place on events (list open, then pick page 2)`, async ({ page }) => {
        await setup(page, n);
        await go(page, '/account/p3/events');
        await page.getByTestId('p3-page-switch').click();
        await snap(page, `${n}p-events-switch-open`);
        await page.getByTestId(`p3-page-pick-${O2}`).click();
        await page.waitForTimeout(500);
        await snap(page, `${n}p-events-after-switch`, { urlHasEvents: page.url().includes('/events') });
      });
      test(`${n}p switch in place on stats then home keeps choice`, async ({ page }) => {
        await setup(page, n);
        await go(page, '/account/p3/stats');
        await page.getByTestId('p3-page-switch').click();
        await page.getByTestId(`p3-page-pick-${O2}`).click();
        await page.waitForTimeout(500);
        await snap(page, `${n}p-stats-after-switch`);
        await go(page, '/account/p3');
        await snap(page, `${n}p-home-after-switch`);
      });
    }
  });
}

test('no page: home, events, stats', async ({ page }) => {
  await setup(page, 0);
  for (const [i, p] of [['home', '/account/p3'], ['events', '/account/p3/events'], ['stats', '/account/p3/stats']] as const) {
    await go(page, p);
    await snap(page, `0p-${i}`);
  }
});

test('admin flag, 3 pages (home, stats)', async ({ page }) => {
  await setup(page, 3, { admin: true });
  await go(page, '/account/p3');
  await snap(page, 'admin3-home');
  await go(page, '/account/p3/stats');
  await snap(page, 'admin3-stats');
});

test('chosen page remembered but gone -> fallback by name', async ({ page }) => {
  await setup(page, 2, { remembered: 'a0000000-0000-4000-8000-0000000000ff' });
  await go(page, '/account/p3/events');
  await snap(page, '2p-events-stale-choice');
});
