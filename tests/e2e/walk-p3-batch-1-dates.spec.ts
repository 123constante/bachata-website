import { test, expect, type Page } from '@playwright/test';
import { appendFileSync, mkdirSync } from 'node:fs';
import { FRIDAY, OrganiserFake, PHONE, TODAY, ORG, ORG_NAME, json, type FakeSeries } from './helpers/organiserFake';
import { findGarbled } from './helpers/garbled';

// WALK (report only), PR #1316 p3-dates-fix-1, 390x844, every answer route-mocked. Run on the PR branch:
//   WALK_OUT=<dir> VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true npx playwright test tests/e2e/walk-p3-batch-1-dates.spec.ts --project=chromium --workers=1
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
  const garbled = findGarbled(text);
  await page.screenshot({ path: `${PICS}/${name}.png`, fullPage: false });
  appendFileSync(`${OUT}/observations.jsonl`, JSON.stringify({ row, pic: `${name}.png`, w19: { small: facts.small, sidewaysPx: facts.wide, garbled, errorCard: bad } }) + '\n');
  expect(bad, `${name}: the picture shows an error card`).toBe(false);
}

const STATUS_OFF = { v: 1, gate_on: false, is_admin: false, complete: true, person: { complete: true, missing: [] }, organisers: [{ id: ORG, name: ORG_NAME, role: 'owner', lifecycle: 'live', complete: true, missing: [], about: { done: true, skipped: false } }] };
const uid = (n: number) => `b1000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** An event with `n` weekly dates, ending 70 weeks after today; the workspace answers as the real read does (p_before / p_limit paging, has_more, whole-series total). */
async function bootBig(page: Page, n: number, id: string, name: string, path = 'dates') {
  const fake = new OrganiserFake({});
  fake.addSeries(fake.organisers[0], { id, name, category: 'party', default_start_date: '2026-01-06', recurrence_rule: { mode: 'weekly', weekdays: [2], end: { kind: 'none' } } as FakeSeries['recurrence_rule'] });
  const d0 = new Date('2026-10-06T12:00:00Z');
  const dates: string[] = [];
  for (let i = 0; i < n; i++) { const d = new Date(d0); d.setUTCDate(d0.getUTCDate() + 7 * (i - Math.floor(n / 4))); dates.push(d.toISOString().slice(0, 10)); }
  const cancelledIdx = new Set([Math.floor(n / 3), Math.floor(n / 3) + 1, 2]);
  await fake.install(page);
  await page.route('**/rest/v1/organiser_onboarding_status_v1*', (r) => r.fallback());
  await page.route('**/rest/v1/rpc/organiser_onboarding_status_v1*', (r) => json(r, STATUS_OFF));
  const calls: string[] = [];
  await page.route('**/rest/v1/rpc/admin_event_workspace_p5*', async (r) => {
    const body = JSON.parse(r.request().postData() ?? '{}') as { p_before?: string | null; p_limit?: number | null };
    const s = fake.series.get(id)!;
    const base = fake.workspace(s) as { meta: Record<string, unknown>; occurrences: unknown[] };
    const desc = dates.map((d, i) => ({ d, i })).reverse().filter((x) => !body.p_before || x.d < body.p_before);
    const lim = body.p_limit ?? 100;
    const page_ = desc.slice(0, lim);
    const hasMore = desc.length > lim;
    calls.push(`before=${body.p_before ?? 'null'} limit=${body.p_limit ?? 'null'} -> ${page_.length} rows, has_more=${hasMore}`);
    const occurrences = page_.map(({ d, i }) => ({ id: fake.occId(s, d), occurrence_date: d, lifecycle_status: cancelledIdx.has(i) ? 'cancelled' : 'scheduled', version: 1, has_override: false, session_overrides_count: 0, materialised_start_utc: `${d}T20:00:00+00:00`, added_sessions_count: 0 }));
    return json(r, { ...base, meta: { ...base.meta, has_more: hasMore, next_before: hasMore ? page_[page_.length - 1].d : null, total: n }, occurrences });
  });
  await page.goto(`/account/p3/events/${id}/${path}`);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.locator('[data-testid="p3-all-dates-screen"], [data-testid="p3-dates-empty"]').first().waitFor({ timeout: 25_000 });
  await page.waitForTimeout(500);
  return { fake, dates, calls };
}

for (const n of [132, 100, 99]) {
  test(`W-31 ${n} dates`, async ({ page }) => {
    const { calls, dates } = await bootBig(page, n, uid(n), `Weekly ${n}`);
    const t = async () => (await page.locator('body').innerText()).replace(/\n+/g, ' | ');
    note(`W-31/${n}`, `model ${dates.length} dates ${dates[0]}..${dates[dates.length - 1]}; first read: ${calls[0]}`);
    note(`W-31/${n}`, `Coming tab: rows=${await page.getByTestId('p3-date-row').count()}, partial="${await page.getByTestId('p3-partial').innerText().catch(() => 'none')}", older button="${await page.getByTestId('p3-older-dates').innerText().catch(() => 'none')}"`);
    await snap(page, `W-31/${n}`, `w31-${n}-0-coming`);
    if (n === 132) {
      const btn = page.getByTestId('p3-older-dates');
      await btn.scrollIntoViewIfNeeded();
      await snap(page, 'W-31/132', 'w31-132-1-older-button');
      await btn.click();
      await page.waitForTimeout(1200);
      note('W-31/132', `after click: reads=${calls.length}, last read: ${calls[calls.length - 1]}; older button=${await page.getByTestId('p3-older-dates').count()}, partial line=${await page.getByTestId('p3-partial').count()}`);
      await snap(page, 'W-31/132', 'w31-132-2-after-older');
      // tab counts, then Past
      note('W-31/132', `filter tabs: ${(await page.getByTestId('p3-date-filters').innerText()).replace(/\n+/g, ' | ')}`);
      await page.getByTestId('p3-filter-past').click();
      await page.waitForTimeout(500);
      const rows = page.getByTestId('p3-date-row');
      note('W-31/132', `Past tab rows=${await rows.count()}`);
      await snap(page, 'W-31/132', 'w31-132-3-past');
      await rows.last().scrollIntoViewIfNeeded();
      note('W-31/132', `oldest row text: ${(await rows.last().innerText()).replace(/\n+/g, ' | ')} (model oldest ${dates[0]})`);
      await snap(page, 'W-31/132', 'w31-132-4-past-bottom');
      await rows.last().click();
      await page.waitForTimeout(800);
      note('W-31/132', `oldest date sheet: ${(await page.locator('[role="dialog"]').innerText().catch(() => 'NO DIALOG')).replace(/\n+/g, ' | ').slice(0, 400)}`);
      await snap(page, 'W-31/132', 'w31-132-5-oldest-open');
    } else {
      note(`W-31/${n}`, `no older-dates control expected: older button count=${await page.getByTestId('p3-older-dates').count()}; text has "newest"=${/newest/.test(await t())}`);
      await page.getByTestId('p3-filter-past').click();
      await page.waitForTimeout(400);
      await snap(page, `W-31/${n}`, `w31-${n}-1-past`);
    }
  });
}

test('W-35 conflict, Start again, Put my changes back / Drop', async ({ page }) => {
  for (const choice of ['put', 'drop'] as const) {
    const fake = new OrganiserFake({});
    await fake.install(page);
    await page.route('**/rest/v1/rpc/organiser_onboarding_status_v1*', (r) => json(r, STATUS_OFF));
    await page.goto(`/account/p3/events/${FRIDAY}`);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.getByTestId('p3-open-date').first().click();
    await page.waitForTimeout(600);
    await snap(page, `W-35/${choice}`, `w35-${choice}-0-date-sheet`);
    await page.getByTestId('p3-date-act-details').click({ timeout: 5000 }).catch(() => note('W-35', 'no details action'));
    await page.waitForTimeout(500);
    await snap(page, `W-35/${choice}`, `w35-${choice}-0b-details`);
    await page.getByTestId('p3-own-name-edit').click({ timeout: 5000 }).catch(() => note('W-35', 'no own-name edit'));
    await page.waitForTimeout(500);
    const field = page.getByTestId('p3-own-name-text');
    await field.fill('Spring Special');
    await snap(page, `W-35/${choice}`, `w35-${choice}-1-typed`);
    fake.refuse('occurrence_command_p5', 'version_conflict: expected 1, got 2', 1);
    await page.getByTestId('p3-own-save').click();
    await page.waitForTimeout(1000);
    note(`W-35/${choice}`, `after conflict: save disabled=${await page.getByTestId('p3-own-save').isDisabled()}, why="${await page.getByTestId('p3-conflict-why').innerText().catch(() => 'none')}", start again present=${await page.getByTestId('p3-start-again').count()}, typed value kept="${await field.inputValue().catch(() => 'n/a')}"`);
    await snap(page, `W-35/${choice}`, `w35-${choice}-2-conflict`);
    await page.getByTestId('p3-start-again').click();
    await page.waitForTimeout(1200);
    note(`W-35/${choice}`, `after Start again: field="${await field.inputValue().catch(() => 'n/a')}", kept-offer="${await page.getByTestId('p3-kept-offer').innerText().catch(() => 'none')}"`);
    await snap(page, `W-35/${choice}`, `w35-${choice}-3-start-again`);
    await page.getByTestId(choice === 'put' ? 'p3-kept-put' : 'p3-kept-drop').click();
    await page.waitForTimeout(500);
    note(`W-35/${choice}`, `after ${choice}: field="${await field.inputValue().catch(() => 'n/a')}", save disabled=${await page.getByTestId('p3-own-save').isDisabled().catch(() => 'n/a')}`);
    await snap(page, `W-35/${choice}`, `w35-${choice}-4-after-choice`);
    const before = fake.sent('occurrence_command_p5').length;
    if (!(await page.getByTestId('p3-own-save').isDisabled().catch(() => true))) {
      await page.getByTestId('p3-own-save').click();
      await page.waitForTimeout(1000);
    }
    note(`W-35/${choice}`, `save: commands sent ${before} -> ${fake.sent('occurrence_command_p5').length}; dialog now="${(await page.locator('[role="dialog"]').innerText().catch(() => 'closed')).replace(/\n+/g, ' | ').slice(0, 200)}"`);
    await snap(page, `W-35/${choice}`, `w35-${choice}-5-saved`);
    await page.unroute('**/rest/v1/rpc/organiser_onboarding_status_v1*').catch(() => undefined);
  }
});
void TODAY;
