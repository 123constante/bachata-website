// Screenshots every direction x shape x tab x width and runs the Design Gate stage-4 self-checks
// on the rendered DOM. Writes shots/*.png and checks.json. Run: node docs/people-arc/mockups/src/capture.mjs
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..');
const shots = join(dir, 'shots');
mkdirSync(shots, { recursive: true });
const SHAPES = [
  ['thin-dancer', ['dancer'], false], ['thin-teacher', ['teacher'], false], ['dj-2gigs', ['dj'], true],
  ['rich', ['teacher', 'dj', 'dancer'], true], ['long-name', ['dancer'], false],
];
const SIZES = [[390, 844], [360, 800]];

// In-page checks: contrast of every text run on its solid ground, tap size of every control,
// clipping, sideways scroll, tab-row presence, and at least one action.
function audit() {
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(',').map((x) => parseFloat(x)); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const groundOf = (el) => { for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.backgroundImage !== 'none' && !e.dataset.photo) return { img: true }; const c = parse(s.backgroundColor); if (c && c.a > 0.99) return c; } return parse(getComputedStyle(document.body).backgroundColor); };
  const texts = []; const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement; if (seen.has(el) || el.closest('script,style')) continue; seen.add(el);
    const fg = parse(getComputedStyle(el).color); const bg = groundOf(el);
    if (bg.img) { texts.push({ text: n.textContent.trim().slice(0, 30), ratio: null, note: 'on image stand-in' }); continue; }
    const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
    texts.push({ text: n.textContent.trim().slice(0, 30), color: getComputedStyle(el).color, ratio: Math.round(((a + 0.05) / (b + 0.05)) * 100) / 100 });
  }
  const taps = [...document.querySelectorAll('main a, main button, header a, header button')].map((e) => { const r = e.getBoundingClientRect(); return { text: e.textContent.trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) }; });
  const clipped = [...document.querySelectorAll('main *')].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'visible').map((e) => e.textContent.trim().slice(0, 30));
  const off = [...document.querySelectorAll('main *')].filter((e) => e.getBoundingClientRect().right > innerWidth + 0.5).map((e) => e.textContent.trim().slice(0, 30));
  return {
    texts, taps, clipped, offscreen: off,
    sideways: document.documentElement.scrollWidth > innerWidth,
    tabRows: document.querySelectorAll('[role=tablist]').length,
    actions: document.querySelectorAll('[data-action]').length,
  };
}

const browser = await chromium.launch();
const results = [];
for (const letter of ['a', 'b', 'c']) {
  const url = pathToFileURL(join(dir, `${letter}.html`)).href;
  for (const [shape, tabs, multi] of SHAPES) {
    for (const tab of tabs) {
      for (const [w, h] of SIZES) {
        const page = await browser.newPage({ viewport: { width: w, height: h } });
        await page.goto(`${url}?view=page&shape=${shape}&tab=${tab}`);
        const file = `${letter}-${shape}-${tab}-${w}.png`;
        await page.screenshot({ path: join(shots, file), fullPage: true });
        const r = await page.evaluate(audit);
        results.push({ letter, shape, tab, w, h, multi, file, ...r });
        await page.close();
      }
    }
  }
  for (const v of ['tile', 'og']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${url}?view=${v}`);
    await page.screenshot({ path: join(shots, `${letter}-${v}-390.png`), fullPage: true });
    await page.close();
  }
}
await browser.close();
writeFileSync(join(dir, 'checks.json'), JSON.stringify(results, null, 1));

const sum = {};
for (const r of results) {
  const s = (sum[r.letter] ||= { pages: 0, minContrast: 99, lowContrast: [], smallTaps: [], clipped: 0, offscreen: 0, sideways: 0, tabRowWrong: 0, noAction: 0 });
  s.pages++;
  for (const t of r.texts) if (t.ratio !== null) { s.minContrast = Math.min(s.minContrast, t.ratio); if (t.ratio < 4.5) s.lowContrast.push(`${r.file}: "${t.text}" ${t.ratio}`); }
  for (const t of r.taps) if (t.w < 44 || t.h < 44) s.smallTaps.push(`${r.file}: "${t.text}" ${t.w}x${t.h}`);
  s.clipped += r.clipped.length; s.offscreen += r.offscreen.length; s.sideways += r.sideways ? 1 : 0;
  s.tabRowWrong += (r.multi ? r.tabRows !== 1 : r.tabRows !== 0) ? 1 : 0; s.noAction += r.actions ? 0 : 1;
}
writeFileSync(join(dir, 'checks-summary.json'), JSON.stringify(sum, null, 1));
console.log(JSON.stringify(sum, null, 1));
