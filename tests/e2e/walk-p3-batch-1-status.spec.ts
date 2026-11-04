import { test, expect, type Page } from '@playwright/test';
import { appendFileSync, mkdirSync } from 'node:fs';
import { OrganiserFake, PHONE, ORG, ORG_NAME, json } from './helpers/organiserFake';

// WALK (report only), PR #1315 p3-event-status-1, 390x844, every answer route-mocked. Run on the PR branch:
//   WALK_OUT=<dir> VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true npx playwright test tests/e2e/walk-p3-batch-1-status.spec.ts --project=chromium --workers=1
// Pictures -> $WALK_OUT/pics, facts -> $WALK_OUT/observations.jsonl. The test asserts only the picture guard; a person judges each picture.
const OUT = process.env.WALK_OUT ?? 'docs/walk/p3-batch-1';
const PICS = `${OUT}/pics`;
mkdirSync(PICS, { recursive: true });
test.use({ viewport: PHONE, reducedMotion: 'reduce' });
const note = (row: string, text: string) => appendFileSync(`${OUT}/observations.jsonl`, JSON.stringify({ row, text }) + '\n');

async function snap(page: Page, row: string, name: string) {
  await page.waitForTimeout(500);
  await page.evaluate(() => Promise.race([Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))), new Promise((r) => setTimeout(r, 1500))])).catch(() => undefined);
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await page.waitForTimeout(150);
  const text = await page.locator('body').innerText();
  const bad = /Something went wrong|couldn.t reach Bachata Calendar|We couldn.t load this event/i.test(text);
  const facts = await page.evaluate(() => {
    const small: string[] = [];
    const roots = Array.from(document.querySelectorAll('.p3-theme, [role="dialog"]'));
    for (const el of Array.from(document.querySelectorAll('button, a, input, select, textarea, [role="tab"]')).filter((e) => roots.some((r) => r.contains(e)))) {
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height || b.bottom < 0 || b.top > innerHeight * 3) continue;
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      if ((el as HTMLElement).closest('[aria-hidden="true"]') || (el as HTMLElement).classList.contains('p3-ob-sr')) continue;
      if (b.height < 43.5 || b.width < 43.5) small.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}" ${Math.round(b.width)}x${Math.round(b.height)}`);
    }
    return { small, wide: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  const garbled = (text.match(/\u00c3.|\u00e2\u20ac.|&(mdash|hellip|rsquo|amp|nbsp|lsquo|ldquo|rdquo);|\ufffd/g) ?? []);
  await page.screenshot({ path: `${PICS}/${name}.png`, fullPage: false });
  appendFileSync(`${OUT}/observations.jsonl`, JSON.stringify({ row, pic: `${name}.png`, w19: { small: facts.small, sidewaysPx: facts.wide, garbled, errorCard: bad } }) + '\n');
  expect(bad, `${name}: the picture shows an error card`).toBe(false);
}

const mkStatus = (orgs: Array<{ id: string; name: string }>) => ({ v: 1, gate_on: false, is_admin: false, complete: true, person: { complete: true, missing: [] }, organisers: orgs.map((o) => ({ id: o.id, name: o.name, role: 'owner', lifecycle: 'live', complete: true, missing: [], about: { done: true, skipped: false } })) });
const STATS = { from: '2026-09-09', to: '2026-10-08', series: [] };
async function mocks(page: Page, fake: OrganiserFake, delayHomeMs = 0) {
  await fake.install(page);
  await page.route('**/rest/v1/rpc/organiser_onboarding_status_v1*', (r) => json(r, mkStatus(fake.organisers)));
  await page.route('**/rest/v1/rpc/organiser_series_stats_v1*', (r) => json(r, STATS));
  if (delayHomeMs) await page.route('**/rest/v1/rpc/organiser_home_v1*', async (r) => { await new Promise((x) => setTimeout(x, delayHomeMs)); await r.fallback(); });
}
const go = async (page: Page, path: string, waitFor = true) => {
  await page.goto(path);
  if (waitFor) { await page.waitForLoadState('networkidle').catch(() => undefined); await page.locator('.p3-main, [data-testid="p3-shell"]').first().waitFor({ timeout: 25_000 }); }
  await page.waitForTimeout(600);
};
const body = async (page: Page) => (await page.locator('body').innerText()).replace(/\n+/g, ' | ').slice(0, 500);

test('no-page person: Events and Stats', async ({ page }) => {
  const fake = new OrganiserFake({ noOrganiser: true });
  await mocks(page, fake);
  for (const [name, path] of [['events', '/account/p3/events'], ['stats', '/account/p3/stats']] as const) {
    await go(page, path);
    note(`nopage/${name}`, `path=${new URL(page.url()).pathname}; card="${await page.locator('[data-testid="p3-events-nopage"], [data-testid="p3-stats-nopage"]').first().innerText().catch(() => 'NONE')}"; link href=${await page.getByTestId('p3-nopage-start').getAttribute('href').catch(() => 'none')}; body=${await body(page)}`);
    await snap(page, `nopage/${name}`, `nopage-${name}`);
  }
  await go(page, '/account/p3');
  note('nopage/home', `path after Home=${new URL(page.url()).pathname}; body=${await body(page)}`);
  await snap(page, 'nopage/home', 'nopage-home');
});

test('Switch list tick', async ({ page }) => {
  const fake = new OrganiserFake({});
  const second = { ...fake.organisers[0], id: 'a0000000-0000-4000-8000-0000000000b2', name: 'Salsa y Bachata Leeds', series: [] as string[], role: 'manager' as const };
  fake.organisers.push(second);
  fake.addSeries(second, { id: 'b2000000-0000-4000-8000-000000000001', name: 'Leeds Thursday', category: 'party', default_start_date: '2026-10-15' });
  await mocks(page, fake);
  for (const [name, path] of [['home', '/account/p3'], ['events', '/account/p3/events'], ['stats', '/account/p3/stats']] as const) {
    await go(page, path);
    await snap(page, `switch/${name}`, `switch-${name}-0-closed`);
    await page.getByTestId('p3-page-switch').click();
    await page.waitForTimeout(400);
    note(`switch/${name}`, `ticks=${await page.getByTestId('p3-page-current').count()}, tick row="${await page.locator('[data-testid^="p3-page-pick-"]:has([data-testid="p3-page-current"])').innerText().catch(() => 'none')}", aria-current=${await page.locator('[data-testid^="p3-page-pick-"][aria-current]').count()}, rows=${await page.locator('[data-testid^="p3-page-pick-"]').count()}`);
    await snap(page, `switch/${name}`, `switch-${name}-1-open`);
    if (name === 'events') {
      await page.locator('[data-testid^="p3-page-pick-"]:not(:has([data-testid="p3-page-current"]))').first().click();
      await page.waitForTimeout(600);
      note('switch/events', `after pick: path=${new URL(page.url()).pathname}, page name="${await page.getByTestId('p3-page-name').innerText()}"`);
      await snap(page, 'switch/events', 'switch-events-2-picked');
      await page.getByTestId('p3-page-switch').click();
      await page.waitForTimeout(300);
      note('switch/events', `tick after pick on row="${await page.locator('[data-testid^="p3-page-pick-"]:has([data-testid="p3-page-current"])').innerText().catch(() => 'none')}"`);
      await snap(page, 'switch/events', 'switch-events-3-reopened');
    }
  }
});

test('loading state while the home read is slow', async ({ page }) => {
  const fake = new OrganiserFake({});
  fake.organisers.push({ ...fake.organisers[0], id: 'a0000000-0000-4000-8000-0000000000b2', name: 'Salsa y Bachata Leeds', series: [], role: 'manager' as const });
  await mocks(page, fake, 5000);
  for (const [name, path] of [['home', '/account/p3'], ['events', '/account/p3/events'], ['stats', '/account/p3/stats']] as const) {
    await page.goto(path);
    await page.locator('.p3-main, [data-testid="p3-shell"], .p3-ob').first().waitFor({ timeout: 25_000 }).catch(() => undefined);
    await page.waitForTimeout(1500);
    note(`loading/${name}`, `at 1.5s: body=${await body(page)}; page-name shown=${await page.getByTestId('p3-page-name').count()}; rows=${await page.getByTestId('p3-row').count()}`);
    await snap(page, `loading/${name}`, `loading-${name}`);
    await page.waitForTimeout(5500);
    note(`loading/${name}`, `after load: page-name="${await page.getByTestId('p3-page-name').innerText().catch(() => 'none')}"`);
    await snap(page, `loading/${name}`, `loaded-${name}`);
  }
});
