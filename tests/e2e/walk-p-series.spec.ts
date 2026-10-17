import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { FRIDAY, PHONE, OrganiserFake, type FakeOptions } from './helpers/organiserFake';

// THROWAWAY WALK SCRIPT (P-SERIES), NOT in the test:e2e gate list. Full-page screenshots at
// 390x844 of the P-SERIES screens against the route-mocked organiser fake, into
// docs/organiser-rebuild/walk-P-SERIES/. Run against the PRODUCTION build:
//   VITE_ENABLE_ORGANISER_SELF_SERVE=true npm run build && node scripts/_serve-build.mjs --port 4173 &
//   npx playwright test tests/e2e/walk-p-series.spec.ts --project=chromium
// (playwright.config.ts has reuseExistingServer, so it drives the already-running build server.)

test.use({ viewport: PHONE });
test.describe.configure({ mode: 'serial' });

const OUT = 'docs/organiser-rebuild/walk-P-SERIES';
mkdirSync(OUT, { recursive: true });

const DRAFT = 'b0000000-0000-4000-8000-0000000000d1';
const TEAMP = 'b0000000-0000-4000-8000-0000000000d2';
const STOPS = 'b0000000-0000-4000-8000-0000000000d3';
const NORULE = 'b0000000-0000-4000-8000-0000000000d4';
const IMG = 'https://pub-walk.r2.dev/'; // a host the CSP img-src allows (*.r2.dev)
// A 1x1 PNG served for every gallery picture.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

type Setup = (fake: OrganiserFake) => void;
/** Like openOrganiser, plus a workspace patch per series (stored passes the fake never carries). */
async function open(page: Page, path: string, setup?: Setup, wsPatch: Record<string, Record<string, unknown>> = {}, opts: FakeOptions = {}) {
  const fake = new OrganiserFake(opts);
  setup?.(fake);
  await fake.install(page);
  await page.route(`${IMG}**`, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await page.route('**/rest/v1/rpc/admin_event_workspace_p5', async (route) => {
    const body = (route.request().postDataJSON() ?? {}) as { p_series_id?: string };
    const patch = wsPatch[String(body.p_series_id)];
    const s = fake.series.get(String(body.p_series_id));
    if (!patch || !s) return route.fallback();
    const ws = fake.workspace(s) as { series: { series: Record<string, unknown> } };
    Object.assign(ws.series.series, patch);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ws) });
  });
  await page.goto(path);
  return fake;
}
/**
 * The organiser shell scrolls an INNER container, so fullPage stops at 844px. Shoot the top as
 * NN-name.png, then scroll that container a screen at a time: NN-name-b.png, -c.png ...
 */
const shot = async (page: Page, name: string, fromTop = true) => {
  await page.waitForTimeout(500); // entrance motion
  const mark = (top = fromTop) => page.evaluate((top) => {
    const all = Array.from(document.querySelectorAll<HTMLElement>('*')).filter((el) => {
      const o = getComputedStyle(el).overflowY;
      return (o === 'auto' || o === 'scroll') && el.scrollHeight > el.clientHeight + 4 && el.clientHeight > 300;
    });
    const el = all.sort((a, b) => b.scrollHeight - a.scrollHeight)[0] ?? (document.scrollingElement as HTMLElement);
    if (top) el.scrollTop = 0;
    return { st: el.scrollTop, sh: el.scrollHeight, ch: el.clientHeight };
  }, top);
  const step = (dy: number) => page.evaluate((d) => {
    const all = Array.from(document.querySelectorAll<HTMLElement>('*')).filter((el) => {
      const o = getComputedStyle(el).overflowY;
      return (o === 'auto' || o === 'scroll') && el.scrollHeight > el.clientHeight + 4 && el.clientHeight > 300;
    });
    const el = all.sort((a, b) => b.scrollHeight - a.scrollHeight)[0] ?? (document.scrollingElement as HTMLElement);
    el.scrollTop += d;
  }, dy);
  let m = await mark();
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  for (let i = 0; i < 5 && m.st + m.ch < m.sh - 2; i++) {
    await step(m.ch - 120);
    await page.waitForTimeout(250);
    const before = m.st;
    m = await mark(false);
    if (m.st <= before + 1) break; // the container is at its bottom
    await page.screenshot({ path: `${OUT}/${name}-${'bcdef'[i]}.png`, fullPage: true });
  }
};
const addDraft: Setup = (f) => {
  f.addSeries(f.organisers[0], { id: DRAFT, name: 'Wednesday Sensual', lifecycle_status: 'draft', category: null, default_venue_id: null,
    default_start_date: '2026-10-14', recurrence_rule: { mode: 'weekly', weekdays: [3], end: { kind: 'none' } }, version: 2 });
};
const ev = (id: string) => `/account/o/events/${id}`;

test('01-03 draft One event: Go live off, Discard, confirm', async ({ page }) => {
  await open(page, ev(DRAFT), addDraft);
  await expect(page.getByTestId('org-life-golive')).toBeVisible();
  await expect(page.getByTestId('org-life-golive-reason')).toContainText('Needs the next platform update');
  await expect(page.getByTestId('org-life-seelive-reason')).toBeVisible();
  await shot(page, '01-draft-one-event');
  await page.getByTestId('org-life-discard').click();
  await expect(page.getByText('Discard this draft?')).toBeVisible();
  await expect(page.getByTestId('org-life-discard-keep')).toBeVisible();
  await shot(page, '02-draft-discard-confirm');
});

test('03 live One event: See it live is a link', async ({ page }) => {
  await open(page, ev(FRIDAY));
  await expect(page.getByTestId('org-life-seelive')).toHaveAttribute('href', /\/event/);
  await shot(page, '03-live-one-event-see-it-live');
});

test('04-08 Details: rows, Gallery, Videos, ?edit=ends, ?edit=prices', async ({ page }) => {
  await open(page, `${ev(FRIDAY)}/details`, (f) => { f.series.get(FRIDAY)!.gallery = [`${IMG}g1.png`, `${IMG}g2.png`]; });
  for (const r of ['gallery', 'videos', 'ends', 'prices']) await expect(page.getByTestId(`org-detail-${r}`)).toBeVisible();
  await shot(page, '04-details-rows');
  await page.getByTestId('org-detail-gallery').click();
  await expect(page.getByTestId('org-sheet-gallery')).toBeVisible();
  await shot(page, '05-details-gallery-sheet');
  await page.goto(`${ev(FRIDAY)}/details`);
  await page.getByTestId('org-detail-videos').click();
  await expect(page.getByTestId('org-sheet-video')).toBeVisible();
  await shot(page, '06-details-videos-sheet');
  await page.goto(`${ev(FRIDAY)}/details?edit=ends`);
  await expect(page.getByTestId('org-detail-input')).toBeVisible();
  await shot(page, '07-details-edit-ends');
  await page.goto(`${ev(FRIDAY)}/details?edit=prices`);
  await expect(page.getByTestId('org-prices-empty')).toContainText('No prices yet');
  await shot(page, '08-details-edit-prices-empty');
});

test('09 Details: team-shaped price list is off, read-only', async ({ page }) => {
  await open(page, `${ev(TEAMP)}/details`,
    (f) => f.addSeries(f.organisers[0], { id: TEAMP, name: 'Summer Festival Weekend', default_start_date: '2026-10-09',
      recurrence_rule: { mode: 'weekly', weekdays: [5], end: { kind: 'until_date', date: '2026-11-27' } } }),
    { [TEAMP]: { passes: [
      { id: 'p1', name: 'Full pass', price: 90, currency: 'GBP', tier: 'Full', type: 'full_pass', quantity: '100' },
      { id: 'p2', name: 'Party pass', price: 35, currency: 'GBP', tier: 'Party', type: 'party_pass', quantity: '200' },
    ] } });
  await expect(page.getByTestId('org-detail-prices-reason')).toContainText('Bachata Calendar team');
  await page.getByTestId('org-detail-prices').scrollIntoViewIfNeeded();
  await shot(page, '09-details-prices-team-readonly');
});

test('10 ?do=stop: Which is the last date?', async ({ page }) => {
  await open(page, `${ev(STOPS)}?do=stop`,
    (f) => f.addSeries(f.organisers[0], { id: STOPS, name: 'Tuesday Bachata', default_start_date: '2026-10-13',
      recurrence_rule: { mode: 'weekly', weekdays: [2], end: { kind: 'until_date', date: '2026-11-03' } } }));
  await expect(page.getByText('Which is the last date?')).toBeVisible();
  await shot(page, '10-do-stop-last-date');
});

test('11-12 Make it weekly on a recurring event with no rule', async ({ page }) => {
  await open(page, ev(NORULE),
    (f) => f.addSeries(f.organisers[0], { id: NORULE, name: 'Saturday Social', default_start_date: '2026-10-10', recurrence_rule: null,
      extra_dates: ['2026-10-10', '2026-10-24'] }));
  await expect(page.getByTestId('org-event-weekly')).toBeVisible();
  await shot(page, '11-norule-one-event-make-weekly-row');
  await page.goto(`${ev(NORULE)}?do=weekly`);
  await expect(page.getByTestId('event-step')).toBeVisible();
  await shot(page, '12-do-weekly');
  const day = page.getByTestId('event-day-6');
  if (await day.count()) { await day.click(); await shot(page, '13-do-weekly-day-chosen'); }
});

test('14 New event wizard cover step: Save as draft + A1 note', async ({ page }) => {
  await open(page, `/account/o/new/${DRAFT}/cover`, addDraft);
  await expect(page.getByTestId('org-new-draft-note')).toBeVisible();
  await expect(page.getByText('Save as draft', { exact: false }).first()).toBeVisible();
  await shot(page, '14-new-cover-save-as-draft');
});
