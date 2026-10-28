import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Review r3 S1 (W-T fix 3): the ticketing toast column must never sit over the open sheet's
// confirm button. Static markup that mirrors StackSheet / RefundSheet / TypeSheet / TicketsEntry
// class for class, styled by the REAL theme/p3.css, at 390x844 in Chromium (jsdom has no layout).
// The class names it mirrors are pinned in src/modules/organiser/p3/tickets/__tests__ (cascade +
// matrix tests); this spec owns the geometry. Needs no server and no flag.

const PHONE = { width: 390, height: 844 };
const css = readFileSync(join(process.cwd(), 'src/modules/organiser/p3/theme/p3.css'), 'utf8');

const ALERT = "Refund for Ana's order did not start. Payments are not switched on for this account yet.";
const toasts = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    i % 2 === 0
      ? `<div class="p3-toast" role="alert" data-testid="tix-toast"><span>${ALERT}</span><button type="button" class="p3-link p3-toast-act" data-testid="tix-toast-dismiss">Dismiss</button></div>`
      : `<div class="p3-toast" role="status" data-testid="tix-toast"><span>"Door": Ticket saved.</span></div>`,
  ).join('');

const sheet = (full: boolean, testId: string, body: string, foot: string) => `
  <div class="p3-scrim"><div class="${full ? 'p3-sheet p3-sheet-full' : 'p3-sheet'}" role="dialog" aria-modal="true" data-testid="${testId}">
    <div class="p3-sheet-head p3-stack-head"><h3 class="p3-grow" tabindex="-1">${testId}</h3><button type="button" class="p3-link">Close</button></div>
    <div class="p3-sheet-body">${body}</div>
    <div class="p3-sheet-foot"><div class="p3-stack-s">${foot}</div></div>
  </div></div>`;

const rows = Array.from({ length: 30 }, (_, i) => `<li class="p3-row p3-row-col"><div class="p3-type"><span class="p3-row-t">Ticket ${i}</span></div></li>`).join('');
const TALL = sheet(true, 'tix-tall', `<ul>${rows}</ul>`, '<button type="button" class="p3-btn" data-testid="tix-add">Add a ticket</button>');
const REFUND = sheet(
  false,
  'tix-refund',
  '<div class="p3-stack-s"><p class="p3-row-t p3-plain">Ana gets GBP 24.00 back on the card they paid with. This cannot be undone.</p><div class="p3-card p3-inset"><div class="p3-row-s">Order</div><div class="p3-row-t">Ana, 1 ticket, GBP 24.00</div></div></div>',
  '<button type="button" class="p3-btn p3-btn-danger" data-testid="confirm">Refund GBP 24.00</button><button type="button" class="p3-btn p3-btn-line">Keep the order</button>',
);
const ADD = sheet(
  true,
  'tix-sheet',
  '<div class="p3-stack-s"><p class="p3-row-t">Review</p><p class="p3-row-s">Late bird, GBP 12.00, 40 places</p></div>',
  '<button type="button" class="p3-btn" data-testid="confirm">Put on sale</button><button type="button" class="p3-btn p3-btn-line">Save as draft</button>',
);

async function mount(page: Page, sheets: string, n: number) {
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
    <style>*, ::before, ::after { box-sizing: border-box; } body { margin: 0; } ${css}</style></head>
    <body><div class="p3-theme"><div class="p3-frame"><header class="p3-top"><h1>Event</h1></header><main class="p3-main"></main><nav class="p3-tabs"></nav></div>
    ${sheets}<div class="p3-toast-stack">${toasts(n)}</div></div></body></html>`);
}

const overlaps = (a: DOMRectLike, b: DOMRectLike) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
type DOMRectLike = { left: number; top: number; right: number; bottom: number };

test.use({ viewport: PHONE });

for (const [name, sheets] of [['Refund sheet over the tall sheet', TALL + REFUND], ['add sheet over the tall sheet', TALL + ADD]] as const) {
  for (const n of [1, 3, 6]) {
    test(`${name}: ${n} toast(s) never cover the confirm button, all inside the viewport`, async ({ page }) => {
      await mount(page, sheets, n);
      const geo = await page.evaluate(() => {
        const r = (el: Element) => { const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom }; };
        const confirm = document.querySelector('[data-testid="confirm"]')!;
        const c = r(confirm);
        const hit = document.elementFromPoint((c.left + c.right) / 2, (c.top + c.bottom) / 2);
        const stack = document.querySelector('.p3-toast-stack')!;
        // Every toast box, including those scrolled out of the 40dvh column, as the column clips them.
        const col = r(stack);
        const shown = [...document.querySelectorAll('[data-testid="tix-toast"]')].map(r).map((t) => ({
          left: t.left, right: t.right, top: Math.max(t.top, col.top), bottom: Math.min(t.bottom, col.bottom),
        })).filter((t) => t.bottom > t.top);
        return {
          confirm: c,
          hitIsConfirm: hit === confirm || confirm.contains(hit),
          toasts: shown,
          column: col,
          sheets: [...document.querySelectorAll('[role="dialog"]')].map(r),
          scrollY: window.scrollY,
          overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      expect(geo.toasts.length).toBeGreaterThan(0);
      for (const t of geo.toasts) expect(overlaps(t, geo.confirm), `toast ${JSON.stringify(t)} over confirm ${JSON.stringify(geo.confirm)}`).toBe(false);
      expect(geo.hitIsConfirm, 'a tap at the confirm centre reaches the confirm button').toBe(true);
      for (const box of [geo.confirm, geo.column, ...geo.sheets]) {
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.top).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(PHONE.width + 0.5);
        expect(box.bottom).toBeLessThanOrEqual(PHONE.height + 0.5);
      }
      expect(geo.scrollY).toBe(0);
      expect(geo.overflowX).toBeLessThanOrEqual(0);
    });
  }
}
