import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// W3b-2: a date's own Photos and Price sheets (DateFieldSheets.tsx), static markup class for class,
// styled by the REAL theme/p3.css, at 390x844 and 360x640, light and dark (jsdom has no layout).
// Asserts: the sheet sits inside the viewport over a fixed scrim, the page does not scroll when
// it opens (Sheet focuses with preventScroll), no sideways scroll, the photos are 3 across, and
// every tap (remove x, Add photos, Save, Back, the ask buttons) is at least 44px high.

const css = readFileSync(join(process.cwd(), 'src/modules/organiser/p3/theme/p3.css'), 'utf8');
const VIEWS = [{ width: 390, height: 844 }, { width: 360, height: 640 }];

const photo = (i: number) =>
  `<div role="listitem" class="p3-photo" data-testid="p3-photo"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="" /><button type="button" class="p3-photo-x" aria-label="Remove this photo" data-testid="p3-photo-remove"><span aria-hidden="true">&times;</span></button></div>`.replace('p3-photo"', `p3-photo" data-i="${i}"`);
const ask = `<div class="p3-card p3-tight p3-stack-s" role="alertdialog" data-testid="p3-field-ask"><p class="p3-row-t p3-plain">Leave without saving? Your changes to this date will be lost.</p>
  <button type="button" class="p3-btn p3-btn-danger" data-testid="tap">Leave without saving</button><button type="button" class="p3-btn p3-btn-line" data-testid="tap">Keep editing</button></div>`;
const PHOTOS = (n: number) => `<div class="p3-scrim"><div class="p3-sheet" role="dialog" aria-modal="true" data-testid="p3-sheet">
  <div class="p3-sheet-head"><h3 id="p3-sheet-title">Photos</h3><button type="button" class="p3-link" data-testid="tap">Close</button></div>
  <button type="button" class="p3-link" data-testid="tap">&larr; Back</button>
  <p class="p3-note">Photos for this date only, on its event page. JPG, PNG or WebP.</p>
  <div role="list" class="p3-photos" data-testid="p3-photos">${Array.from({ length: n }, (_, i) => photo(i)).join('')}</div>
  <button type="button" class="p3-btn p3-btn-line" data-testid="tap">Add photos</button>
  ${ask}
  <div class="p3-stack-s"><button type="button" class="p3-btn" data-testid="tap">Save for this date</button><button type="button" class="p3-link" data-testid="tap">Undo my changes</button></div>
</div></div>`;
const PRICE = `<div class="p3-scrim"><div class="p3-sheet" role="dialog" aria-modal="true" data-testid="p3-sheet">
  <div class="p3-sheet-head"><h3 id="p3-sheet-title">Price</h3><button type="button" class="p3-link" data-testid="tap">Close</button></div>
  <button type="button" class="p3-link" data-testid="tap">&larr; Back</button>
  ${Array.from({ length: 3 }, (_, i) => `<div class="p3-card p3-tight p3-stack-s" data-testid="p3-price-row"><div class="p3-pair">
    <div class="p3-stack-s"><label class="p3-field">Name</label><input class="p3-in" value="Early bird ${i} with a long name" /></div>
    <div class="p3-stack-s"><label class="p3-field">Price</label><input class="p3-in" value="12.50" /></div></div>
    <label class="p3-field">Currency</label><select class="p3-in"><option>GBP</option></select>
    <button type="button" class="p3-link p3-danger-t" data-testid="tap">Remove this price</button></div>`).join('')}
  <button type="button" class="p3-btn p3-btn-line" data-testid="tap">Add a price</button>
  <div class="p3-stack-s"><button type="button" class="p3-btn" data-testid="tap">Save for this date</button></div>
</div></div>`;

async function mount(page: Page, sheet: string, theme: 'light' | 'dark') {
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
    <style>*, ::before, ::after { box-sizing: border-box; } html { font-size: 13.5px; } body { margin: 0; } ${css}</style></head>
    <body><div class="p3-theme" data-theme="${theme}"><div class="p3-frame"><header class="p3-top"><h1>Event</h1></header>
    <main class="p3-main">${'<p>row</p>'.repeat(80)}</main><nav class="p3-tabs"></nav></div>${sheet}</div></body></html>`);
  await page.evaluate(() => document.querySelector<HTMLElement>('[role="dialog"] button')?.focus({ preventScroll: true }));
}

for (const view of VIEWS) {
  for (const theme of ['light', 'dark'] as const) {
    test.describe(`${view.width}x${view.height} ${theme}`, () => {
      test.use({ viewport: view });
      for (const [name, sheet, n] of [['Photos (1)', PHOTOS(1), 1], ['Photos (many)', PHOTOS(7), 7], ['Price', PRICE, 0]] as const) {
        test(`${name}: inside the viewport, no page scroll, no sideways scroll, 44px taps`, async ({ page }) => {
          await mount(page, sheet, theme);
          const geo = await page.evaluate(() => {
            const r = (el: Element) => { const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, w: b.width, h: b.height }; };
            const tiles = [...document.querySelectorAll('[data-testid="p3-photo"]')].map(r);
            return {
              sheet: r(document.querySelector('[role="dialog"]')!),
              scrim: getComputedStyle(document.querySelector('.p3-scrim')!).position,
              taps: [...document.querySelectorAll('[data-testid="tap"], [data-testid="p3-photo-remove"]')].map((el) => ({ h: r(el).h, w: r(el).w, t: el.textContent })),
              firstRow: tiles.filter((t) => Math.abs(t.top - (tiles[0]?.top ?? 0)) < 1).length,
              tiles,
              scrollY: window.scrollY,
              overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
              sheetOverflowX: (document.querySelector('[role="dialog"]') as HTMLElement).scrollWidth - (document.querySelector('[role="dialog"]') as HTMLElement).clientWidth,
              bg: getComputedStyle(document.querySelector('[role="dialog"]')!).backgroundColor,
            };
          });
          expect(geo.scrim).toBe('fixed');
          expect(geo.sheet.left).toBeGreaterThanOrEqual(0);
          expect(geo.sheet.top).toBeGreaterThanOrEqual(0);
          expect(geo.sheet.right).toBeLessThanOrEqual(view.width + 0.5);
          expect(geo.sheet.bottom).toBeLessThanOrEqual(view.height + 0.5);
          expect(geo.scrollY).toBe(0);
          expect(geo.overflowX).toBeLessThanOrEqual(0);
          expect(geo.sheetOverflowX).toBeLessThanOrEqual(0);
          for (const t of geo.taps) expect(t.h, `tap "${t.t}" height`).toBeGreaterThanOrEqual(44);
          if (n) {
            expect(geo.tiles).toHaveLength(n);
            expect(geo.firstRow).toBe(Math.min(3, n));
            for (const t of geo.tiles) expect(t.right).toBeLessThanOrEqual(geo.sheet.right + 0.5);
          }
          expect(geo.bg).not.toBe('rgba(0, 0, 0, 0)');
        });
      }
    });
  }
}
