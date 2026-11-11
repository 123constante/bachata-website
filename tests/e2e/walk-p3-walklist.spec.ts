import { test, expect, type Page } from '@playwright/test';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { FRIDAY, SUNDAY, ORG, ORG_NAME, OrganiserFake, PHONE, VENUES, CITY, TODAY, json, refuse, type FakeSeries } from './helpers/organiserFake';
import { findGarbled } from './helpers/garbled';

// LOCAL-WALK-ONLY: this spec is NOT in any CI e2e list (package.json test:e2e / test:e2e:p3) and must not join one.
// It writes pictures and observations into docs/walk/ for a person to judge, asserts only the error-card guard, and
// costs minutes of fixed waits per row. Run it by hand with the command below; scripts/check-p3-specs-not-skipped.mjs
// treats specs in no gate script as local walks.
// WALK (report only): the first 12 rows of docs/design/p3-acceptance/WALKLIST.md at 390x844, every answer route-mocked.
//   VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true npx playwright test tests/e2e/walk-p3-walklist.spec.ts --project=chromium --workers=1
// Pictures -> docs/walk/p3-walklist-1/pics; observations -> docs/walk/p3-walklist-1/observations.jsonl (read by the report, never a verdict).
// The test never asserts the PASS condition: a picture is opened and judged by a person (RESULTS.md). It only asserts the guard.
const OUT = 'docs/walk/p3-walklist-1';
const PICS = `${OUT}/pics`;
mkdirSync(PICS, { recursive: true });
test.use({ viewport: PHONE, reducedMotion: 'reduce' });
test.describe.configure({ mode: "parallel" });

const note = (row: string, text: string) => appendFileSync(`${OUT}/observations.jsonl`, JSON.stringify({ row, text }) + '\n');

/** The picture guard: an error card is never a pass. Waits for animations and a settled layout, sweeps W-19 facts. */
async function snap(page: Page, row: string, name: string) {
  await page.waitForTimeout(500);
  await page.evaluate(() => Promise.race([Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))), new Promise((r) => setTimeout(r, 1500))])).catch(() => undefined);
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await page.waitForTimeout(150);
  const text = await page.locator('body').innerText();
  const bad = /Something went wrong|couldn.t reach Bachata Calendar/i.test(text);
  const facts = await page.evaluate(() => {
    const scope = (document.querySelector('[role="dialog"]') ?? document.body) as HTMLElement;
    const small: string[] = [];
    const roots = Array.from(document.querySelectorAll('.p3-theme, [role="dialog"]'));
    for (const el of Array.from(document.querySelectorAll('button, a, input, select, textarea, [role="tab"]')).filter((e) => roots.some((r) => r.contains(e)))) {
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height || b.bottom < 0 || b.top > innerHeight * 3) continue;
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      if ((el as HTMLElement).closest('[aria-hidden="true"]') || (el as HTMLElement).classList.contains('p3-ob-sr')) continue;
      if (b.height < 43.5 || b.width < 43.5) small.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}" ${Math.round(b.width)}x${Math.round(b.height)}`);
    }
    const clipped = Array.from(document.querySelectorAll('.p3-theme p, .p3-theme li, .p3-theme button, .p3-theme a, .p3-theme h2, .p3-theme span')).filter((el) => (el as HTMLElement).scrollWidth > (el as HTMLElement).clientWidth + 1 && getComputedStyle(el).overflow !== 'visible' && getComputedStyle(el).textOverflow === 'clip').map((el) => (el.textContent || '').trim().slice(0, 30));
    return { small, clipped, wide: document.documentElement.scrollWidth - document.documentElement.clientWidth, scope: scope.tagName };
  });
  const garbled = findGarbled(text);
  await page.screenshot({ path: `${PICS}/${name}.png`, fullPage: false });
  appendFileSync(`${OUT}/observations.jsonl`, JSON.stringify({ row, pic: `${name}.png`, w19: { small: facts.small, clipped: facts.clipped, sidewaysPx: facts.wide, garbled, errorCard: bad } }) + '\n');
  expect(bad, `${name}: the picture shows an error card`).toBe(false);
}

async function boot(page: Page, path: string, fake = new OrganiserFake({}), extra?: (p: Page, f: OrganiserFake) => Promise<void>) {
  await fake.install(page);
  await extra?.(page, fake);
  await page.goto(path);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.locator('.p3-main, [data-testid="p3-shell"], .p3-ob').first().waitFor({ timeout: 25_000 });
  await page.waitForTimeout(600);
  return fake;
}

const STATUS_OFF = { v: 1, gate_on: false, is_admin: false, complete: true, person: { complete: true, missing: [] }, organisers: [{ id: ORG, name: ORG_NAME, role: 'owner', lifecycle: 'live', complete: true, missing: [], about: { done: true, skipped: false } }] };
const statusOff = async (p: Page) => { await p.route('**/rest/v1/rpc/organiser_onboarding_status_v1*', (r) => json(r, STATUS_OFF)); };
const bootOff = (page: Page, path: string, fake?: OrganiserFake) => boot(page, path, fake, statusOff);

const addMany = (fake: OrganiserFake, over: Partial<FakeSeries> & { id: string; name: string }) => fake.addSeries(fake.organisers[0], over);
const uid = (n: number) => `b1000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

test('W-01 leave prompt', async ({ page }) => {
  await bootOff(page, `/account/p3/events/${FRIDAY}`);
  await page.getByTestId('p3-open-details').click();
  await page.waitForTimeout(600);
  const name = page.getByTestId('p3-d-name');
  await name.waitFor();
  const type = async () => { await name.click(); await name.pressSequentially(' XYZ'); };
  const prompt = page.getByText('Leave without saving?').first();
  const where = () => new URL(page.url()).pathname;
  // (a) Events tab
  await type();
  await snap(page, 'W-01', 'w01-0-dirty');
  await page.locator('a.p3-tab[data-tab="events"]').click();
  await page.waitForTimeout(400);
  note('W-01', `(a) Events tab: prompt visible=${await prompt.isVisible()}, path=${where()}`);
  await snap(page, 'W-01', 'w01-a-events-tab');
  if (await prompt.isVisible()) {
    await page.getByRole('button', { name: 'Keep editing' }).click();
    await page.waitForTimeout(300);
    note('W-01', `(a) Keep editing: path=${where()}, name value="${await name.inputValue()}"`);
    await snap(page, 'W-01', 'w01-a-keep');
  }
  // (b) phone Back
  await page.goBack().catch(() => undefined);
  await page.waitForTimeout(500);
  note('W-01', `(b) history back: prompt visible=${await prompt.isVisible()}, path=${where()}`);
  await snap(page, 'W-01', 'w01-b-history-back');
  if (await prompt.isVisible()) { await page.getByRole('button', { name: 'Keep editing' }).click(); await page.waitForTimeout(300); }
  note('W-01', `(b) after: path=${where()}, name value="${await name.inputValue().catch(() => 'n/a')}"`);
  // (c) Back link
  const back = page.getByRole('link', { name: /Back/ }).first();
  await back.click();
  await page.waitForTimeout(400);
  note('W-01', `(c) Back link: prompt visible=${await prompt.isVisible()}, path=${where()}`);
  await snap(page, 'W-01', 'w01-c-back-link');
  if (await prompt.isVisible()) {
    await page.getByRole('button', { name: 'Leave and lose them' }).click();
    await page.waitForTimeout(500);
    note('W-01', `(c) Leave and lose them: path=${where()}`);
    await snap(page, 'W-01', 'w01-c-left');
  }
});

test('W-02 remove an event', async ({ page }) => {
  const SPARE = uid(2);
  const fake = new OrganiserFake({});
  addMany(fake, { id: SPARE, name: 'Spare Night', category: 'party', lifecycle_status: 'draft', default_start_date: '2026-11-20', format: 'one_off' });
  await bootOff(page, `/account/p3/events/${SPARE}`, fake);
  await snap(page, 'W-02', 'w02-0-before');
  await page.getByTestId('p3-open-status').click();
  await page.waitForTimeout(400);
  await snap(page, 'W-02', 'w02-1-status-sheet');
  const remove = page.getByTestId('p3-status-row-remove');
  if (await remove.count()) {
    await remove.click();
    await page.waitForTimeout(300);
    await snap(page, 'W-02', 'w02-2-remove-confirm');
    await page.getByTestId('p3-remove-confirm').click();
    await page.waitForTimeout(800);
  } else note('W-02', 'no Remove row in the status sheet for a draft one-off');
  note('W-02', `after remove: path=${new URL(page.url()).pathname}, status tag="${await page.getByTestId('p3-status').first().innerText().catch(() => 'n/a')}"`);
  await snap(page, 'W-02', 'w02-3-after-remove');
  await page.goto(`/account/p3/events/${SPARE}`);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(1200);
  const tag = await page.getByTestId('p3-status').first().innerText().catch(() => 'n/a');
  const dis = async (id: string) => { const l = page.getByTestId(id); return (await l.count()) ? `disabled=${await l.first().isDisabled()}` : 'absent'; };
  note('W-02', `reloaded deep link: tag="${tag}", add-date ${await dis('p3-add-date')}, add-why="${await page.getByTestId('p3-add-why').innerText().catch(() => 'none')}", repeat row ${await dis('p3-open-repeat')}`);
  await snap(page, 'W-02', 'w02-4-reloaded');
});

test('W-09 rooms in the Session sheet', async ({ page }) => {
  await bootOff(page, `/account/p3/events/${FRIDAY}`);
  await snap(page, 'W-09', 'w09-0-event');
  await page.getByTestId('p3-open-session').first().click();
  await page.waitForTimeout(600);
  note('W-09', `sheet text: ${(await page.locator('[role="dialog"]').innerText().catch(() => 'no dialog')).replace(/\n+/g, ' | ').slice(0, 600)}`);
  await snap(page, 'W-09', 'w09-1-session-sheet');
});

test('W-10 line-up search', async ({ page }) => {
  await bootOff(page, `/account/p3/events/${FRIDAY}`);
  await page.getByTestId('p3-open-session').first().click();
  await page.waitForTimeout(500);
  const dlg = page.locator('[role="dialog"]');
  const open = dlg.getByRole('button', { name: /line-?up|teacher|people|add/i });
  note('W-10', `buttons in sheet: ${(await dlg.getByRole('button').allInnerTexts()).join(' | ')}`);
  const lineBtn = dlg.getByTestId('p3-lineup-open');
  void open; void lineBtn;
  await snap(page, 'W-10', 'w10-0-session');
  // open the line-up sheet through whichever control names the people
  const cand = dlg.locator('button', { hasText: /Ana Ruiz|Add teacher|Add someone|line-?up|Teacher/i }).first();
  if (await cand.count()) { await cand.click(); await page.waitForTimeout(500); }
  await snap(page, 'W-10', 'w10-1-lineup');
  const search = page.getByTestId('p3-lineup-search');
  if (await search.count()) {
    await search.fill('Cleo');
    await page.waitForTimeout(900);
    note('W-10', `search "Cleo": results=${await page.getByTestId('p3-lineup-result').count()}`);
    await snap(page, 'W-10', 'w10-2-search-hit');
    await search.fill('Zzqxv Nobody');
    await page.waitForTimeout(900);
    note('W-10', `search nobody: nomatch="${await page.getByTestId('p3-lineup-nomatch').innerText().catch(() => 'none')}"`);
    await snap(page, 'W-10', 'w10-3-search-empty');
  } else note('W-10', 'no line-up search box reached');
});

const PAGE_B = 'b9000000-0000-4000-8000-0000000000b1';
test('W-16 not yours', async ({ page }) => {
  const fake = new OrganiserFake({});
  await fake.install(page);
  await statusOff(page);
  // page B's event: every read answers what a manager of another page gets
  await page.route('**/rest/v1/rpc/admin_event_workspace_p5*', (r) => String(r.request().postData()).includes(PAGE_B) ? refuse(r, 'permission_denied') : r.fallback());
  await page.route('**/rest/v1/rpc/*history*', (r) => json(r, { code: '42501', message: 'not_a_member', details: null, hint: null }, 403));
  for (const sub of ['', '/dates', '/details', '/prices', '/history', '/door']) {
    await page.goto(`/account/p3/events/${PAGE_B}${sub}`);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.waitForTimeout(1500);
    const txt = (await page.locator('body').innerText()).replace(/\n+/g, ' | ');
    const fields = await page.locator('input:not([type=hidden]), textarea').count();
    note('W-16', `${sub || '/'}: path=${new URL(page.url()).pathname}, editable fields=${fields}, notYours=${/Not yours/i.test(txt)}, text=${txt.slice(txt.indexOf('Skip'), 400).slice(0, 300)}`);
    await snap(page, 'W-16', `w16-${(sub || 'event').replace('/', '')}`);
  }
});

const GATE_STATUS = {
  v: 1, gate_on: true, is_admin: false, complete: false,
  person: { complete: false, missing: ['nationality', 'languages'] },
  organisers: [{ id: ORG, name: ORG_NAME, role: 'owner', lifecycle: 'live', complete: false, missing: ['org_logo', 'contact_confirm'], about: { done: false, skipped: false } }],
};
const REFUSAL = { code: 'P0001', message: 'onboarding_incomplete', details: JSON.stringify({ missing: ['nationality', 'org_logo'], organiser_id: ORG }), hint: 'Finish your details' };
async function gateOn(page: Page) {
  await page.route('**/rest/v1/rpc/organiser_onboarding_status_v1*', (r) => json(r, GATE_STATUS));
  await page.route('**/rest/v1/rpc/series_command_p5*', (r) => json(r, REFUSAL, 400));
  await page.route('**/rest/v1/rpc/occurrence_command_p5*', (r) => json(r, REFUSAL, 400));
}

test('W-20 gate sheet and W-26 after Continue', async ({ page }) => {
  const SPARE = uid(3);
  const fake = new OrganiserFake({});
  addMany(fake, { id: SPARE, name: 'Draft Night', category: 'party', lifecycle_status: 'draft', default_start_date: '2026-11-20', format: 'one_off' });
  await boot(page, `/account/p3/events/${FRIDAY}`, fake, gateOn);
  await snap(page, 'W-20', 'w20-0-event');
  await page.getByTestId('p3-open-status').click();
  await page.waitForTimeout(400);
  await snap(page, 'W-20', 'w20-1-status-sheet');
  note('W-20', `status rows: ${await page.locator('[data-testid^="p3-status-row-"]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-testid')}${(e as HTMLButtonElement).disabled ? '(disabled)' : ''}`).join(', '))}`);
  await page.locator('[data-testid^="p3-status-row-"]:not([disabled])').first().click({ timeout: 4000 }).catch(() => note('W-20', 'no enabled status row'));
  await page.waitForTimeout(900);
  note('W-20', `put-live gate: ${(await page.getByTestId('p3-gate').innerText().catch(() => 'NO GATE SHEET')).replace(/\n+/g, ' | ')}`);
  await snap(page, 'W-20', 'w20-2-put-live-gate');
  await page.getByTestId('p3-gate-not-now').click().catch(() => undefined);
  await page.waitForTimeout(400);
  note('W-20', `Not now: path=${new URL(page.url()).pathname}, gate gone=${(await page.getByTestId('p3-gate').count()) === 0}`);
  await snap(page, 'W-20', 'w20-3-not-now');
  // Cancel this date on the live Friday series
  await page.goto(`/account/p3/events/${FRIDAY}`);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.getByTestId('p3-open-date').first().click();
  await page.waitForTimeout(500);
  await page.getByTestId('p3-date-act-cancel').click().catch(() => note('W-20', 'no cancel action row'));
  await page.waitForTimeout(400);
  const reason = page.locator('[role="dialog"] input[type=radio], [role="dialog"] [role=radio], [role="dialog"] select').first();
  if (await reason.count()) await reason.click().catch(() => undefined);
  await page.getByRole('button', { name: 'Venue closed' }).click().catch(() => note('W-20', 'no reason button'));
  await snap(page, 'W-20', 'w20-4-cancel-sheet');
  await page.getByTestId('p3-date-cancel-go').click().catch(() => note('W-20', 'cancel-go not clickable'));
  await page.waitForTimeout(900);
  note('W-20', `cancel gate: ${(await page.getByTestId('p3-gate').innerText().catch(() => 'NO GATE SHEET')).replace(/\n+/g, ' | ')}`);
  await snap(page, 'W-20', 'w20-5-cancel-gate');
  // W-26: Continue
  const go = page.getByTestId('p3-gate-go');
  if (await go.count()) {
    note('W-26', `Continue href=${await go.getAttribute('href')}`);
    await go.click();
    await page.waitForTimeout(1500);
    note('W-26', `after Continue: path=${new URL(page.url()).pathname + new URL(page.url()).search}, text=${(await page.locator('body').innerText()).replace(/\n+/g, ' | ').slice(0, 300)}`);
    await snap(page, 'W-26', 'w26-0-after-continue');
  }
});

test('W-29 big list (116 series)', async ({ page }) => {
  const fake = new OrganiserFake({});
  for (let i = 0; i < 114; i++) addMany(fake, { id: uid(100 + i), name: `Series ${String(i + 1).padStart(3, '0')}`, category: 'party', default_start_date: '2026-11-20', format: 'one_off' });
  await bootOff(page, '/account/p3/events', fake);
  await snap(page, 'W-29', 'w29-0-top');
  const total = await page.locator('[data-testid="p3-events"] li, [data-testid="p3-events"] a.p3-row').count();
  const bodyText = await page.locator('body').innerText();
  note('W-29', `mock series=${fake.organisers[0].series.length}; rows in DOM=${total}; "Series 114" present=${bodyText.includes('Series 114')}; count text=${(bodyText.match(/\b1\d\d\b[^\n]{0,30}/g) ?? []).slice(0, 4).join(' || ')}`);
  await page.evaluate(() => { for (const el of [document.scrollingElement, document.querySelector('.p3-main')]) (el as HTMLElement | null)?.scrollTo(0, 1e9); });
  await page.waitForTimeout(600);
  await snap(page, 'W-29', 'w29-1-bottom');
  note('W-29', `after scroll to end: last row text="${(await page.locator('body').innerText()).includes('Series 114')}"`);
});

test('W-31 dates cap (132 dates)', async ({ page }) => {
  const W130 = uid(31);
  const fake = new OrganiserFake({});
  // weekly from 2026-09-01 (Tuesday) for 132 weeks: 5 weeks past by TODAY=2026-10-08 is not 30 -> start earlier
  const start = '2024-03-05'; // Tuesday; 30 Tuesdays before 2026-10-08 would be mid-Mar 2026 -> use dedicated dates below
  const s = addMany(fake, { id: W130, name: 'Weekly 130', category: 'party', default_start_date: start, recurrence_rule: { mode: 'weekly', weekdays: [2], end: { kind: 'none' } } as FakeSeries['recurrence_rule'] });
  void s;
  // answer the workspace with the 132-date shape the real read has: newest 100 only, has_more + total
  const dates: string[] = [];
  const d0 = new Date('2026-08-26T12:00:00Z'); // 30 past Tuesdays end 2026-10-06; then 102 future
  for (let i = 0; i < 132; i++) { const d = new Date(d0); d.setUTCDate(d0.getUTCDate() + 7 * (i - 29)); dates.push(d.toISOString().slice(0, 10)); }
  note('W-31', `model: ${dates.length} dates ${dates[0]}..${dates[dates.length - 1]}, past=${dates.filter((x) => x < TODAY).length}, cancelled=3, skipped=2`);
  const capRoute = async (p: Page) => {
    await statusOff(p);
    await p.route('**/rest/v1/rpc/admin_event_workspace_p5*', async (r) => {
      const base = fake.workspace(fake.series.get(W130)!) as { meta: Record<string, unknown>; occurrences: Array<Record<string, unknown>> };
      const all = dates.map((d, i) => ({ id: fake.occId(fake.series.get(W130)!, d), occurrence_date: d, lifecycle_status: [40, 50, 60].includes(i) ? 'cancelled' : 'scheduled', version: 1, has_override: false, session_overrides_count: 0, materialised_start_utc: `${d}T20:00:00+00:00`, added_sessions_count: 0 })).reverse();
      return json(r, { ...base, meta: { ...base.meta, has_more: true, total: 132 }, occurrences: all.slice(0, 100) });
    });
    };
  await boot(page, `/account/p3/events/${W130}/dates`, fake, capRoute);
  const t = (await page.locator('body').innerText()).replace(/\n+/g, ' | ');
  note('W-31', `dates screen: rows=${await page.getByTestId('p3-date-row').count()}, has "100 of 132"=${/100 of 132/.test(t)}, has Load more=${/Load more/i.test(t)}, partial note="${(t.match(/[^|]*newest[^|]*/) ?? ['none'])[0].trim()}"`);
  await snap(page, 'W-31', 'w31-0-dates');
  await page.evaluate(() => { for (const el of [document.scrollingElement, document.querySelector('.p3-main')]) (el as HTMLElement | null)?.scrollTo(0, 1e9); });
  await page.waitForTimeout(500);
  await snap(page, 'W-31', 'w31-1-dates-bottom');
});

test('W-33 move a guest-list date', async ({ page }) => {
  const fake = await bootOff(page, `/account/p3/events/${FRIDAY}`);
  await page.getByTestId('p3-open-date').first().click();
  await page.waitForTimeout(500);
  await page.getByTestId('p3-date-act-move').click().catch(() => note('W-33', 'no move action row'));
  await page.waitForTimeout(400);
  note('W-33', `move sheet text: ${(await page.locator('[role="dialog"]').innerText().catch(() => 'no dialog')).replace(/\n+/g, ' | ').slice(0, 500)}`);
  await snap(page, 'W-33', 'w33-0-move-sheet');
  const day = page.locator('#p3-move-day');
  if (await day.count()) { await day.fill('2026-10-17'); await page.waitForTimeout(300); await snap(page, 'W-33', 'w33-1-move-chosen'); }
  void fake;
});

test('W-35 two saves, stale view', async ({ page }) => {
  const fake = await bootOff(page, `/account/p3/events/${FRIDAY}`);
  await page.getByTestId('p3-open-date').first().click();
  await page.waitForTimeout(500);
  await page.getByTestId('p3-date-act-time').click().catch(() => note('W-35', 'no time action row'));
  await page.waitForTimeout(400);
  await snap(page, 'W-35', 'w35-0-time-sheet');
  const start = page.locator('#p3-time-start');
  if (await start.count()) {
    await start.fill('19:30');
    await page.getByTestId('p3-time-go').click();
    await page.waitForTimeout(900);
    await snap(page, 'W-35', 'w35-1-first-save');
    note('W-35', `first save sent=${fake.sent('occurrence_command_p5').length} occurrence commands`);
    // reopen the same date from the stale view; the second answer is a version conflict
    fake.refuse('occurrence_command_p5', 'version_conflict: expected 1, got 2', 2);
    await page.getByTestId('p3-open-date').first().click().catch(() => undefined);
    await page.waitForTimeout(500);
    await page.getByTestId('p3-date-act-time').click().catch(() => undefined);
    await page.waitForTimeout(300);
    if (await page.locator('#p3-time-start').count()) {
      await page.locator('#p3-time-start').fill('18:45');
      await page.getByTestId('p3-time-go').click();
      await page.waitForTimeout(1000);
      note('W-35', `second save: ${(await page.locator('[role="dialog"]').innerText().catch(() => 'no dialog')).replace(/\n+/g, ' | ').slice(0, 400)}`);
      await snap(page, 'W-35', 'w35-2-conflict');
    }
  }
});

test('W-36 festival rows and course scope reasons', async ({ page }) => {
  const FEST = uid(36), COURSE = uid(37);
  const fake = new OrganiserFake({});
  addMany(fake, { id: FEST, name: 'Summer Festival', category: 'festival', format: 'festival', default_start_date: '2026-11-20' });
  addMany(fake, { id: COURSE, name: 'Beginner Course', category: 'class', format: 'course', default_start_date: '2026-10-12', recurrence_rule: { mode: 'weekly', weekdays: [1], end: { kind: 'until_date', date: '2026-12-07' } } as FakeSeries['recurrence_rule'] });
  await bootOff(page, `/account/p3/events/${FEST}`, fake);
  await snap(page, 'W-36', 'w36-0-festival');
  note('W-36', `festival sessions section: ${(await page.getByTestId('p3-sessions').innerText().catch(() => 'none')).replace(/\n+/g, ' | ').slice(0, 400)}; sessions-ask="${await page.getByTestId('p3-sessions-ask').innerText().catch(() => 'none')}"`);
  await page.getByTestId('p3-open-session').first().click({ timeout: 3000 }).catch(() => note('W-36', 'festival session rows are not buttons'));
  await page.waitForTimeout(500);
  await snap(page, 'W-36', 'w36-1-festival-session');
  await page.goto(`/account/p3/events/${COURSE}`);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(800);
  await snap(page, 'W-36', 'w36-2-course');
  await page.getByTestId('p3-open-session').first().click({ timeout: 3000 }).catch(() => note('W-36', 'course session rows are not buttons'));
  await page.waitForTimeout(600);
  note('W-36', `course session sheet: ${(await page.locator('[role="dialog"]').innerText().catch(() => 'no dialog')).replace(/\n+/g, ' | ').slice(0, 700)}`);
  await snap(page, 'W-36', 'w36-3-course-session');
});
