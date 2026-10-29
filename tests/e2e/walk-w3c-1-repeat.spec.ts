import { test, expect, type Page, type Route } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FRIDAY, OrganiserFake, PHONE, expectNoHorizontalScroll, json } from './helpers/organiserFake';

// P3 W3c-1 Repeat sheet walk at 390x844 with a FLOWING clock (page.clock.install, never paused).
//
// Part 1 (in the test:e2e gate, needs no flag): static markup that mirrors RepeatSheet.tsx class for
// class (worst case: weekly editor, last date, More options open, every preview line, 8 dates, an
// error, the sticky Save), portalled beside the P3 frame as the real sheet is, styled by the REAL
// theme/p3.css with html at 13.5px (the phone font size). Asserts the sheet, its Save button and
// the toast sit inside the viewport, no sideways scroll, no clipped text, every tap >= 44px and
// text contrast >= 4.5, light and dark.
//
// Part 2 (the real app on the route-mocked organiser fake, prod-shaped: a weekly series of 12
// Fridays): runs only when the dev server has the P3 flag, as walk-p3-w3b1.spec.ts does:
//   VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true npx playwright test tests/e2e/walk-w3c-1-repeat.spec.ts --project=chromium

const css = readFileSync(join(process.cwd(), 'src/modules/organiser/p3/theme/p3.css'), 'utf8');
const CLOCK = new Date('2026-10-28T18:30:00Z');

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const chips = DAYS.map((d, i) => `<button type="button" data-testid="tap" aria-pressed="${i === 0 || i === 4}">${d}</button>`).join('');
const next8 = ['Friday 30 October', 'Monday 2 November', 'Friday 6 November', 'Monday 9 November', 'Friday 13 November', 'Monday 16 November', 'Friday 20 November', 'Monday 23 November']
  .map((d) => `<li>${d}</li>`).join('');
const SHEET = `<div class="p3-theme p3-portal" data-theme="THEME"><div class="p3-scrim"><div class="p3-sheet" role="dialog" aria-modal="true" data-testid="p3-sheet">
  <div class="p3-sheet-head"><h3 id="p3-sheet-title">Repeat</h3><button type="button" class="p3-link" data-testid="tap">Close</button></div>
  <div class="p3-sheet-body p3-stack-s">
    <fieldset class="p3-ask"><legend class="p3-sr">How it repeats</legend><div class="p3-stack-s">
      <div class="p3-seg p3-seg2" role="group"><button type="button" data-testid="tap" aria-pressed="true">Every week</button><button type="button" data-testid="tap" aria-pressed="false">Every month</button></div>
      <p class="p3-field">On which days?</p><div class="p3-chips" role="group">${chips}</div>
      <p class="p3-field">How it ends</p>
      <div class="p3-seg" role="group"><button type="button" data-testid="tap" aria-pressed="false">Keeps going</button><button type="button" data-testid="tap" aria-pressed="false">Stops after</button><button type="button" data-testid="tap" aria-pressed="true">Stops on a date</button></div>
      <label class="p3-field" for="u">Last date (up to 2 years ahead)</label><input id="u" class="p3-in" type="date" data-testid="tap" value="2027-06-30" />
      <button type="button" class="p3-link" aria-expanded="true" data-testid="tap">More options</button>
      <label class="p3-field" for="i">Repeat every</label><select id="i" class="p3-in" data-testid="tap"><option>Every 2 weeks</option></select>
    </div></fieldset>
    <div class="p3-card p3-inset">Every 2 weeks on Monday and Friday, last date Wednesday 30 June 2027.</div>
    <div class="p3-stack-s">
      <p class="p3-note">2 dates added.</p>
      <p class="p3-error">This removes 3 dates already on the calendar.</p>
      <p class="p3-error">1 date has bookings, so it is cancelled instead of removed.</p>
      <p class="p3-note">2 dates keep their own changes.</p>
      <p class="p3-note">Only the next 30 dates are listed now. The other 22 are added as those pass.</p>
      <p class="p3-field">The next dates</p><ul class="p3-plain-list">${next8}</ul>
    </div>
  </div>
  <div class="p3-sheet-foot"><div class="p3-stack-s">
    <p class="p3-error" role="alert">The last date can be at most 2 years from today. Pick an earlier date, or choose Keeps going.</p>
    <button type="button" class="p3-btn" data-testid="save">Save the new pattern</button>
    <button type="button" class="p3-link" data-testid="tap">Undo my changes</button>
  </div></div>
</div></div></div>`;
const TOAST = '<div class="p3-toast" role="status" data-testid="toast"><span>Saved. The dates follow the new pattern.</span></div>';

async function mount(page: Page, theme: 'light' | 'dark') {
  await page.clock.install({ time: CLOCK });
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
    <style>*, ::before, ::after { box-sizing: border-box; } html { font-size: 13.5px; } body { margin: 0; } ${css}</style></head>
    <body><div class="p3-theme p3-frame" data-theme="${theme}"><header class="p3-top"><h1>Event</h1></header>
    <main class="p3-main">${'<p>row</p>'.repeat(80)}</main><nav class="p3-tabs"></nav>${TOAST}</div>${SHEET.replace('THEME', theme)}</body></html>`);
  await page.evaluate(() => document.querySelector<HTMLElement>('[role="dialog"] button')?.focus({ preventScroll: true }));
}

/** Text contrast of every text-bearing element in the sheet against its first opaque background. */
const contrast = (sel: string) => {
    const lum = (c: number[]) => {
      const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
    };
    const rgba = (s: string) => (s.match(/[\d.]+/g) ?? []).map(Number);
    const bgOf = (el: Element | null): number[] => {
      for (let e = el; e; e = e.parentElement) {
        const c = rgba(getComputedStyle(e).backgroundColor);
        if (c.length >= 3 && (c.length < 4 || c[3] > 0.5)) return c;
      }
      return [255, 255, 255];
    };
    const out: Array<{ t: string; ratio: number }> = [];
    for (const el of document.querySelectorAll(`${sel} *`)) {
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim());
      if (!own || el.closest('.p3-sr')) continue;
      const a = lum(rgba(getComputedStyle(el).color));
      const b = lum(bgOf(el));
      out.push({ t: el.textContent!.trim().slice(0, 40), ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) });
    }
  return out;
};

test.describe('Part 1: Repeat sheet geometry (gate)', () => {
  test.use({ viewport: PHONE });
  for (const theme of ['light', 'dark'] as const) {
    test(`${theme}: sheet, Save and toast inside 390x844, no sideways scroll, 44px taps, contrast >= 4.5`, async ({ page }) => {
      await mount(page, theme);
      await page.clock.runFor(1000); // the clock flows; nothing may move the boxes
      const geo = await page.evaluate(() => {
        const r = (el: Element) => { const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, w: b.width, h: b.height }; };
        const sheet = document.querySelector('[role="dialog"]') as HTMLElement;
        return {
          sheet: r(sheet),
          save: r(document.querySelector('[data-testid="save"]')!),
          toast: r(document.querySelector('[data-testid="toast"]')!),
          scrim: getComputedStyle(document.querySelector('.p3-scrim')!).position,
          portalParent: document.querySelector('.p3-portal')!.parentElement!.tagName,
          taps: [...document.querySelectorAll('[data-testid="tap"], [data-testid="save"]')].map((el) => ({ h: r(el).h, t: el.textContent })),
          clipped: [...sheet.querySelectorAll('p, li, button, label, .p3-card')].filter((el) => (el as HTMLElement).scrollWidth > (el as HTMLElement).clientWidth + 1).map((el) => el.textContent),
          overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          sheetOverflowX: sheet.scrollWidth - sheet.clientWidth,
          scrollY: window.scrollY,
        };
      });
      expect(geo.portalParent).toBe('BODY');
      expect(geo.scrim).toBe('fixed');
      for (const box of [geo.sheet, geo.save, geo.toast]) {
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.top).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(PHONE.width + 0.5);
        expect(box.bottom).toBeLessThanOrEqual(PHONE.height + 0.5);
      }
      expect(geo.scrollY).toBe(0);
      expect(geo.overflowX).toBeLessThanOrEqual(0);
      expect(geo.sheetOverflowX).toBeLessThanOrEqual(0);
      expect(geo.clipped).toEqual([]);
      for (const t of geo.taps) expect(t.h, `tap "${t.t}" height`).toBeGreaterThanOrEqual(44);
      const ratios = await page.evaluate(contrast, '[role="dialog"]');
      expect(ratios.length).toBeGreaterThan(10);
      for (const c of ratios) expect(c.ratio, `contrast of "${c.t}"`).toBeGreaterThanOrEqual(4.5);
    });
  }
});

// ---- Part 2: the real app (P3 flag on in the dev server) -----------------------------------

const P3_ON = process.env.VITE_ENABLE_ORGANISER_P3 === 'true';
type Env = { command: { kind: string; payload: Record<string, unknown> } };

async function openReal(page: Page) {
  await page.clock.install({ time: CLOCK });
  const fake = new OrganiserFake();
  await fake.install(page);
  const dry: Env[] = [];
  // registered after the fake's own route: answers set_recurrence dry runs in the live shape; the rest falls back to the fake
  await page.route('**/rest/v1/rpc/series_command_p5*', async (route: Route) => {
    const env = (route.request().postDataJSON() as { p_envelope: Env }).p_envelope;
    if (env.command.kind !== 'series.set_recurrence' || env.command.payload.dry_run !== true) return route.fallback();
    dry.push(env);
    return json(route, { ok: true, new_version: 1, dry_run: true, data: {
      recurrence_rule: env.command.payload, materialise: null, dry_run: true, date_cap: null, dates_considered: 20,
      will_add: ['2026-11-02', '2026-11-09'], will_remove: [], will_cancel_booked: [], keeps_own_changes: [],
      next_8: ['2026-10-30', '2026-11-02', '2026-11-06', '2026-11-09', '2026-11-13', '2026-11-16', '2026-11-20', '2026-11-23'],
    } });
  });
  await page.goto(`/account/p3/events/${FRIDAY}`);
  return { fake, dry };
}

test.describe('Part 2: the real Repeat sheet on the organiser fake', () => {
  test.skip(!P3_ON, 'needs VITE_ENABLE_ORGANISER_P3=true in the dev server (a walk, like walk-p3-w3b1)');
  test.use({ viewport: PHONE });

  test('open without scrolling the page, untouched sends nothing, a change previews then saves once, toast in view', async ({ page }) => {
    const { fake, dry } = await openReal(page);
    const row = page.getByTestId('p3-open-repeat');
    await expect(page.getByTestId('p3-repeat-row')).toContainText('Every Friday');
    const before = await page.evaluate(() => document.querySelector('.p3-main')?.scrollTop ?? 0);
    await row.click();
    const sheet = page.getByTestId('p3-sheet');
    await expect(sheet).toBeVisible();
    expect(await page.evaluate(() => document.querySelector('.p3-main')?.scrollTop ?? 0)).toBe(before);
    await expect(page.getByTestId('p3-repeat-save')).toBeDisabled();
    await page.getByRole('button', { name: 'Close' }).click();
    expect(fake.envelopes().filter((e) => e.command.kind === 'series.set_recurrence')).toHaveLength(0);

    await row.click();
    await page.getByRole('button', { name: 'Monday' }).click();
    await expect(page.getByTestId('p3-repeat-line-added')).toHaveText('2 dates added.');
    await expect(page.getByTestId('p3-repeat-next').getByRole('listitem')).toHaveCount(8);
    expect(dry).toHaveLength(1);
    const save = page.getByTestId('p3-repeat-save');
    await expect(save).toBeEnabled();
    await expect.poll(async () => {
      const b = (await sheet.boundingBox())!;
      const s = (await save.boundingBox())!;
      return [b, s].every((x) => x.x >= 0 && x.y >= 0 && x.x + x.width <= PHONE.width + 0.5 && x.y + x.height <= PHONE.height + 0.5);
    }).toBe(true);
    await page.screenshot({ path: 'test-results/walk-w3c-1-repeat-sheet.png' });
    await save.click();
    await expect(sheet).toHaveCount(0);
    const saves = fake.envelopes().filter((e) => e.command.kind === 'series.set_recurrence');
    expect(saves).toHaveLength(1);
    expect(saves[0].command.payload).toEqual({ mode: 'weekly', interval: 1, weekdays: [1, 5], end: { kind: 'until_date', date: '2026-12-25' } });
    const toast = page.getByText('Saved. The dates follow the new pattern.');
    await expect(toast).toBeVisible();
    const t = (await toast.boundingBox())!;
    expect(t.y + t.height).toBeLessThanOrEqual(PHONE.height + 0.5);
    await expectNoHorizontalScroll(page);
  });
});
