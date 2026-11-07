import { chromium } from 'playwright';
import fs from 'node:fs';
const OUT = 'docs/mockups/s10-wall/';
const B = 'http://127.0.0.1:4174/__mock/s10/';
const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const rgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
const browser = await chromium.launch({ executablePath: process.env.CHROME });
const out = { generated: 'S10, measured from rendered DOM computed styles', frames: {} };
async function frame(name, path, w, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 844 }, deviceScaleFactor: 2, isMobile: w < 500 });
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', (e) => errs.push(String(e)));
  await pg.goto(B + path, { waitUntil: 'networkidle' });
  await pg.waitForSelector('[data-ready="1"]', { timeout: 30000 });
  await pg.waitForTimeout(1500);
  await pg.screenshot({ path: OUT + name + '.png', fullPage: opts.full !== false });
  const m = await pg.evaluate(() => {
    const px = (e, p) => getComputedStyle(e)[p];
    const r = {};
    r.scrollWidth = document.documentElement.scrollWidth; r.innerWidth = innerWidth;
    r.tiles = document.querySelectorAll('[data-testid=wall-tile]').length;
    r.namesClipped = [...document.querySelectorAll('[data-testid=tile-name]')].filter((e) => e.scrollHeight > e.clientHeight + 1).length;
    const rect = document.querySelector('[data-testid=wall-tile]')?.getBoundingClientRect();
    r.tileW = rect && Math.round(rect.width * 10) / 10;
    const page = document.querySelector('[data-testid=wall-root],[data-testid=sheet-root]');
    r.pageBg = page && px(page, 'backgroundColor');
    r.chips = [...document.querySelectorAll('[data-testid=role-chip],[data-testid=sheet-chip]')].map((e) => ({ role: e.dataset.role || e.textContent, bg: px(e, 'backgroundColor'), text: px(e, 'color'), border: px(e, 'borderTopColor'), parentBg: px(e.closest('[data-testid=wall-root],[data-testid=sheet-root],[data-testid=person-sheet]'), 'backgroundColor') }));
    r.dates = [...document.querySelectorAll('[data-testid=date-chip]')].slice(0, 1).map((e) => ({ bg: px(e, 'backgroundColor'), text: px(e, 'color'), border: px(e, 'borderTopColor'), tileBg: px(e.parentElement.firstElementChild, 'backgroundColor') }));
    r.names = [...document.querySelectorAll('[data-testid=tile-name]')].slice(0, 1).map((e) => ({ text: px(e, 'color') }));
    return r;
  });
  const seen = {};
  const chips = [];
  for (const c of m.chips) {
    const key = c.role + c.bg; if (seen[key]) continue; seen[key] = 1;
    const page = rgb(m.pageBg || c.parentBg);
    chips.push({ role: c.role, textOnChip: +ratio(rgb(c.text), rgb(c.bg)).toFixed(2), fillVsPage: +ratio(rgb(c.bg), page).toFixed(2), borderVsPage: +ratio(rgb(c.border), page).toFixed(2), edgeVsPage: +Math.max(ratio(rgb(c.bg), page), ratio(rgb(c.border), page)).toFixed(2) });
  }
  out.frames[name] = { scrollWidth: m.scrollWidth, innerWidth: m.innerWidth, noHorizontalScroll: m.scrollWidth <= m.innerWidth, tiles: m.tiles, tileWidth: m.tileW, namesClipped: m.namesClipped, pageErrors: errs.length, nameOnPage: m.names[0] && +ratio(rgb(m.names[0].text), rgb(m.pageBg)).toFixed(2), chips, dateChip: m.dates[0] && { textOnChip: +ratio(rgb(m.dates[0].text), rgb(m.dates[0].bg)).toFixed(2), chipVsTile: +ratio(rgb(m.dates[0].bg), rgb(m.dates[0].tileBg)).toFixed(2), borderVsTile: +ratio(rgb(m.dates[0].border), rgb(m.dates[0].tileBg)).toFixed(2) } };
  await ctx.close();
}
const sid = process.env.SID || '';
await frame('01-wall-cream', 'wall?base=cream', 390);
await frame('02-wall-dark', 'wall?base=dark', 390);
await frame('03-side-by-side', 'side', 840);
await frame('04-full-page-cream', 'page?base=cream', 390);
await frame('05-full-page-dark', 'page?base=dark', 390);
await frame('06-sheet-cream', `sheet?base=cream&id=${sid}`, 390);
await frame('07-sheet-dark', `sheet?base=dark&id=${sid}`, 390);
await frame('08-photo-layout-proof', 'photo', 840);
fs.writeFileSync(OUT + 'contrast.json', JSON.stringify(out, null, 2));
await browser.close();
console.log(JSON.stringify(Object.fromEntries(Object.entries(out.frames).map(([k, v]) => [k, { sw: v.scrollWidth, tiles: v.tiles, clip: v.namesClipped, err: v.pageErrors, minEdge: Math.min(...v.chips.map((c) => c.edgeVsPage)), minText: Math.min(...v.chips.map((c) => c.textOnChip)) }]))));
