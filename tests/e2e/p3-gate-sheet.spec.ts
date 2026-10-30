import { test, expect, type Page, type Route } from '@playwright/test';
import { FRIDAY, ORG, OrganiserFake, PHONE, json } from './helpers/organiserFake';

// P3-GATE: the A1 "A few details first" sheet at 390x844 with a FLOWING clock (page.clock.install, never paused).
//
// Part 1 (in the test:e2e gate, needs no flag): the REAL GateHost -> GateSheet -> Sheet and the real theme/p3.css,
// mounted by tests/e2e/harness/gateHarness.tsx inside the dev server's module graph (review fix round: the first
// push measured hand-written markup, which could not fail on a change to the shipped code). A refused write is
// sent from a button at the bottom of a scrolled page, against the organiser fake (signed in) and a status read
// with the prod-maximum ten missing items (survey 2026-10-30) or one. Asserts: the sheet, Continue and Not now sit
// inside the viewport; opening it does not scroll the page (Sheet focuses with preventScroll); focus is in the
// sheet; no sideways scroll; every tap >= 44x44; light and dark.
//
// Part 2 (the real app on the route-mocked organiser fake): runs only when the dev server has the P3 flag:
//   VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true npx playwright test tests/e2e/p3-gate-sheet.spec.ts --project=chromium
// The gate flag is OFF on prod, so the refusal is simulated exactly as _require_onboarding_complete_v1 raises it.

const CLOCK = new Date('2026-10-30T18:30:00Z');
const TEN = { person: ['first_name', 'city', 'dance_role', 'photo', 'nationality', 'languages', 'teach_answer'], page: ['org_logo', 'org_link', 'contact_confirm'] };
const ONE = { person: ['nationality'], page: [] as string[] };
const statusOf = (m: { person: string[]; page: string[] }) => ({
  v: 1, gate_on: true, is_admin: false, complete: false,
  person: { complete: m.person.length === 0, missing: m.person },
  organisers: [{ id: ORG, name: 'Ritmo Bachata London', role: 'owner', lifecycle: 'live', complete: false, missing: m.page, about: { done: false, skipped: false } }],
});

async function mountReal(page: Page, theme: 'light' | 'dark', m: { person: string[]; page: string[] }) {
  await page.clock.install({ time: CLOCK });
  const fake = new OrganiserFake();
  await fake.install(page);
  await page.route('**/rest/v1/rpc/organiser_onboarding_status_v1*', (r) => json(r, statusOf(m)));
  // Record every focus() call: in a fixed, in-view sheet Chromium would not scroll even without preventScroll, so
  // the scrollY check alone cannot see that option go; this pins it (review fix round, proven by mutation).
  await page.addInitScript(() => {
    const w = window as unknown as { __focus: Array<{ inDialog: boolean; preventScroll: boolean }> };
    w.__focus = [];
    const orig = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function focus(this: HTMLElement, o?: FocusOptions) {
      w.__focus.push({ inDialog: !!this.closest('[role="dialog"]'), preventScroll: o?.preventScroll === true });
      return orig.call(this, o);
    };
  });
  await page.goto('/auth');
  await page.waitForLoadState('domcontentloaded');
  const url = '/tests/e2e/harness/gateHarness.tsx';
  await page.evaluate(async ({ url, theme }) => {
    const mod = await import(/* @vite-ignore */ url);
    mod.mount(theme);
  }, { url, theme });
  const save = page.getByTestId('harness-refuse');
  await save.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => window.scrollY);
  await save.click();
  return before;
}

test.describe('Part 1: the real A1 gate sheet (gate)', () => {
  test.use({ viewport: PHONE });
  for (const theme of ['light', 'dark'] as const) {
    for (const [label, m] of [['10 items', TEN], ['1 item', ONE]] as const) {
      test(`${theme}, ${label}: sheet, Continue and Not now inside 390x844; opening it does not scroll the page; 44px taps`, async ({ page }) => {
        const before = await mountReal(page, theme, m);
        const n = m.person.length + m.page.length;
        await expect(page.getByTestId('p3-gate-count')).toHaveText(n === 1 ? '1 thing left' : `${n} things left`);
        await page.clock.runFor(1000); // the clock flows; nothing may move the boxes
        const geo = await page.evaluate(() => {
          const r = (el: Element) => { const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, w: b.width, h: b.height }; };
          const gate = document.querySelector('[data-testid="p3-gate"]')!;
          const sheet = gate.closest('[role="dialog"]') as HTMLElement;
          const go = document.querySelector('[data-testid="p3-gate-go"]')!;
          const c = r(go);
          const hit = document.elementFromPoint((c.left + c.right) / 2, (c.top + c.bottom) / 2);
          return {
            sheet: r(sheet),
            go: c,
            notNow: r(document.querySelector('[data-testid="p3-gate-not-now"]')!),
            goReachable: hit === go || go.contains(hit),
            focusInSheet: sheet.contains(document.activeElement),
            name: document.getElementById(sheet.getAttribute('aria-labelledby') ?? '')?.textContent,
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
        expect(geo.focusInSheet, 'focus moved into the sheet').toBe(true);
        const focus = await page.evaluate(() => (window as unknown as { __focus: Array<{ inDialog: boolean; preventScroll: boolean }> }).__focus.filter((f) => f.inDialog));
        expect(focus.length, 'the sheet focused one of its controls').toBeGreaterThan(0);
        for (const f of focus) expect(f.preventScroll, 'the sheet focuses with { preventScroll: true }').toBe(true);
        expect(geo.name).toBe('A few details first');
        expect(geo.scrollY, 'opening the sheet did not scroll the page').toBe(before);
        expect(geo.overflowX).toBeLessThanOrEqual(0);
        expect(geo.clipped).toEqual([]);
        for (const t of geo.taps) {
          expect(t.h, `tap "${t.t}" height`).toBeGreaterThanOrEqual(44);
          expect(t.w, `tap "${t.t}" width`).toBeGreaterThanOrEqual(44);
        }
        await expect(page.getByTestId('p3-gate-go')).toHaveAttribute('href', `/account/p3/start?o=${ORG}&at=review`);
        await page.screenshot({ path: `test-results/p3-gate-sheet-${theme}-${n}.png` });
        await page.getByTestId('p3-gate-not-now').click();
        await expect(page.getByTestId('p3-gate')).toHaveCount(0);
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
