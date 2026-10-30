import { test, expect, type Page, type Route } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FRIDAY, ORG, OrganiserFake, PHONE, json } from './helpers/organiserFake';

// P3-GATE: the A1 "A few details first" sheet at 390x844 with a FLOWING clock (page.clock.install, never paused).
//
// Part 1 (in the test:e2e gate, needs no flag): static markup that mirrors GateSheet.tsx (inside Sheet.tsx) class
// for class, worst case first: ten missing items (the prod maximum, survey 2026-10-30), styled by the REAL
// theme/p3.css with html at 13.5px (the phone font size), over a page scrolled down. Asserts the sheet, Continue
// and Not now sit inside the viewport, focusing the sheet (focus({ preventScroll: true }), as Sheet does) does not
// scroll the page, no sideways scroll, every tap >= 44px, light and dark.
//
// Part 2 (the real app on the route-mocked organiser fake): runs only when the dev server has the P3 flag:
//   VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true npx playwright test tests/e2e/p3-gate-sheet.spec.ts --project=chromium
// The gate flag is OFF on prod, so the refusal is simulated exactly as _require_onboarding_complete_v1 raises it.

const css = readFileSync(join(process.cwd(), 'src/modules/organiser/p3/theme/p3.css'), 'utf8');
const CLOCK = new Date('2026-10-30T18:30:00Z');
const ROWS = ['Your first name', 'Your city', 'How you dance', 'Your photo', 'Nationality', 'Languages', 'Do you teach?', 'Page logo', 'Page link', 'Contact number'];

const SHEET = (rows: string[]) => `<div class="p3-scrim"><div class="p3-sheet" role="dialog" aria-modal="true" aria-labelledby="p3-sheet-title" data-testid="p3-sheet">
  <div class="p3-sheet-head"><h3 id="p3-sheet-title">A few details first</h3><button type="button" class="p3-link" data-testid="tap">Close</button></div>
  <div data-testid="p3-gate">
    <p class="p3-plain">We ask everyone who runs a page. It takes about five minutes and you only do it once.</p>
    <p class="p3-note p3-gap-t">${rows.length} things left</p>
    <ul class="p3-card p3-tight p3-list">${rows.map((r) => `<li class="p3-gate-row">${r}</li>`).join('')}</ul>
  </div>
  <div class="p3-sheet-foot"><div class="p3-stack-s">
    <a class="p3-btn p3-gate-go" href="/account/p3/start?o=o1&amp;at=review" data-testid="go">Continue</a>
    <button type="button" class="p3-btn p3-btn-line" data-testid="not-now">Not now</button>
  </div></div>
</div></div>`;

async function mount(page: Page, theme: 'light' | 'dark', rows: string[]) {
  await page.clock.install({ time: CLOCK });
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
    <style>*, ::before, ::after { box-sizing: border-box; } html { font-size: 13.5px; } body { margin: 0; } ${css}</style></head>
    <body><div class="p3-theme p3-frame" data-theme="${theme}"><header class="p3-top"><h1>Event</h1></header>
    <main class="p3-main">${'<p>row</p>'.repeat(80)}</main><nav class="p3-tabs"></nav><div id="host"></div></div></body></html>`);
  await page.evaluate(() => window.scrollTo(0, 400));
  const before = await page.evaluate(() => window.scrollY);
  // what GateHost + Sheet do: draw the sheet, then focus its first button without scrolling
  await page.evaluate((html) => {
    document.getElementById('host')!.innerHTML = html;
    document.querySelector<HTMLElement>('[role="dialog"] button:not([disabled])')?.focus({ preventScroll: true });
  }, SHEET(rows));
  return before;
}

test.describe('Part 1: A1 gate sheet geometry (gate)', () => {
  test.use({ viewport: PHONE });
  for (const theme of ['light', 'dark'] as const) {
    for (const rows of [ROWS, ROWS.slice(0, 1)]) {
      test(`${theme}, ${rows.length} item(s): sheet, Continue and Not now inside 390x844; opening it does not scroll the page; 44px taps`, async ({ page }) => {
        const before = await mount(page, theme, rows);
        await page.clock.runFor(1000); // the clock flows; nothing may move the boxes
        const geo = await page.evaluate(() => {
          const r = (el: Element) => { const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, w: b.width, h: b.height }; };
          const sheet = document.querySelector('[role="dialog"]') as HTMLElement;
          const go = document.querySelector('[data-testid="go"]')!;
          const c = r(go);
          const hit = document.elementFromPoint((c.left + c.right) / 2, (c.top + c.bottom) / 2);
          return {
            sheet: r(sheet),
            go: c,
            notNow: r(document.querySelector('[data-testid="not-now"]')!),
            goReachable: hit === go || go.contains(hit),
            focused: document.activeElement?.textContent,
            taps: [...sheet.querySelectorAll('button, a')].map((el) => ({ h: r(el).h, w: r(el).w, t: el.textContent })),
            clipped: [...sheet.querySelectorAll('p, li, button, a')].filter((el) => (el as HTMLElement).scrollWidth > (el as HTMLElement).clientWidth + 1).map((el) => el.textContent),
            overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            scrollY: window.scrollY,
          };
        });
        for (const box of [geo.sheet, geo.go, geo.notNow]) {
          expect(box.left).toBeGreaterThanOrEqual(0);
          expect(box.top).toBeGreaterThanOrEqual(0);
          expect(box.right).toBeLessThanOrEqual(PHONE.width + 0.5);
          expect(box.bottom).toBeLessThanOrEqual(PHONE.height + 0.5);
        }
        expect(geo.goReachable, 'a tap on Continue reaches Continue').toBe(true);
        expect(geo.focused).toBe('Close');
        expect(geo.scrollY, 'opening the sheet did not scroll the page').toBe(before);
        expect(geo.overflowX).toBeLessThanOrEqual(0);
        expect(geo.clipped).toEqual([]);
        for (const t of geo.taps) {
          expect(t.h, `tap "${t.t}" height`).toBeGreaterThanOrEqual(44);
          expect(t.w, `tap "${t.t}" width`).toBeGreaterThanOrEqual(44);
        }
        await page.screenshot({ path: `test-results/p3-gate-sheet-${theme}-${rows.length}.png` });
      });
    }
  }
});

// ---- Part 2: the real app (P3 flag on in the dev server) -----------------------------------

const P3_ON = process.env.VITE_ENABLE_ORGANISER_P3 === 'true';
const REFUSAL = { code: 'P0001', message: 'onboarding_incomplete', details: JSON.stringify({ missing: ['nationality', 'org_logo'], organiser_id: ORG }), hint: 'Finish your details' };
const STATUS = {
  v: 1, gate_on: true, is_admin: false, complete: false,
  person: { complete: false, missing: ['nationality', 'languages', 'teach_answer'] },
  organisers: [{ id: ORG, name: 'Ritmo Bachata London', role: 'owner', lifecycle: 'live', complete: false, missing: ['org_logo', 'contact_confirm'], about: { done: false, skipped: false } }],
};

async function openReal(page: Page) {
  await page.clock.install({ time: CLOCK });
  const fake = new OrganiserFake();
  await fake.install(page);
  const sent: string[] = [];
  // registered after the fake's own routes: every event write is refused by the (simulated) onboarding gate
  await page.route('**/rest/v1/rpc/series_command_p5*', async (route: Route) => {
    sent.push(route.request().postData() ?? '');
    return json(route, REFUSAL, 400);
  });
  await page.route('**/rest/v1/rpc/organiser_onboarding_status_v1*', (r) => json(r, STATUS));
  await page.goto(`/account/p3/events/${FRIDAY}`);
  return sent;
}

test.describe('Part 2: a refused write opens the real gate sheet', () => {
  test.skip(!P3_ON, 'needs VITE_ENABLE_ORGANISER_P3=true in the dev server (a walk, like walk-w3c-1-repeat)');
  test.use({ viewport: PHONE });

  test('Hide is refused: the sheet lists 5 things, Continue goes to the page\u2019s Review, Not now leaves the event page as it was', async ({ page }) => {
    const sent = await openReal(page);
    await page.getByTestId('p3-open-status').click();
    const scrollBefore = await page.evaluate(() => [window.scrollY, document.querySelector('.p3-main')?.scrollTop ?? 0]);
    await page.locator('[data-testid^="p3-status-row-"]').first().click();
    const gate = page.getByTestId('p3-gate');
    await expect(gate).toBeVisible();
    expect(sent.length).toBeGreaterThan(0);
    await expect(page.getByText('5 things left')).toBeVisible();
    await expect(page.getByText('Finish your details first, then you can add or change your events.')).toHaveCount(0);
    await page.clock.runFor(1000);
    const go = page.getByTestId('p3-gate-go');
    await expect(go).toHaveAttribute('href', `/account/p3/start?o=${ORG}&at=review`);
    for (const el of [page.locator('[role="dialog"]', { has: gate }), go, page.getByTestId('p3-gate-not-now')]) {
      const b = (await el.boundingBox())!;
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(PHONE.width + 0.5);
      expect(b.y + b.height).toBeLessThanOrEqual(PHONE.height + 0.5);
    }
    expect(await page.evaluate(() => [window.scrollY, document.querySelector('.p3-main')?.scrollTop ?? 0])).toEqual(scrollBefore);
    await page.screenshot({ path: 'test-results/p3-gate-sheet-real.png' });
    await page.getByTestId('p3-gate-not-now').click();
    await expect(gate).toHaveCount(0);
    await expect(page.getByTestId('p3-event')).toBeVisible();
  });
});
