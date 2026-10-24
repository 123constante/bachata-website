// Screenshots + design-gate numbers for the W2-D hub mockups (run build.mjs first):
//   node docs/mockups/w2d-hub/shot.mjs
// Writes <option>-<shape>.png (390x844 viewport, first screen), seam/<option>-<shape>-full.png (whole page,
// for the seam column; scratch, not committed: delete seam/ after a run), tap.png, overview.png (3 columns: A, B, C; one row per shape) and report.json.
// Per view: scrollWidth, smallest tap box, text contrast (each text element against its nearest painted
// background; text on a gradient is reported, not guessed), empty gap on the first screen, and the
// largest one-CSS-row colour step in a pixel column outside every card (x = 4) from under the header to the end.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
const dir = new URL('.', import.meta.url).pathname;
mkdirSync(`${dir}seam`, { recursive: true });
const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

const measure = () => page.evaluate(() => {
  const rgb = (s) => (s.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage !== 'none' && e.tagName !== 'svg') return { gradient: true, el: e.className }; const c = rgb(cs.backgroundColor); if (c.length === 4 ? c[3] > 0 : c.length === 3) return { c: c.slice(0, 3) }; } return { c: [30, 20, 16] }; };
  const texts = [...document.querySelectorAll('body *')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && e.getClientRects().length);
  let min = 99, minAt = '', onGradient = [];
  for (const e of texts) {
    const b = bgOf(e);
    if (b.gradient) { onGradient.push(`${e.tagName}.${e.className}:${e.textContent.trim().slice(0, 20)}`); continue; }
    const r = ratio(rgb(getComputedStyle(e).color), b.c);
    if (r < min) { min = r; minAt = `${e.tagName}.${e.className}:${e.textContent.trim().slice(0, 30)}`; }
  }
  const taps = [...document.querySelectorAll('a, button, [data-tap]')].filter((e) => e.getClientRects().length).map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) }; });
  const smallest = taps.reduce((m, t) => (Math.min(t.w, t.h) < Math.min(m.w, m.h) ? t : m), { w: 999, h: 999 });
  const body = document.querySelector('.hub-body');
  const kids = [...body.querySelectorAll('*')].filter((e) => e.getClientRects().length && e.textContent.trim());
  const lastContent = Math.max(...kids.map((e) => e.getBoundingClientRect().bottom));
  const fadeTop = document.querySelector('[data-seam=fade]').getBoundingClientRect().top;
  return { scrollWidth: document.documentElement.scrollWidth, h1: document.querySelectorAll('h1').length, minContrast: +min.toFixed(2), minContrastAt: minAt, textOnGradient: onGradient, tapCount: taps.length, smallestTap: smallest, lastContentBottom: Math.round(lastContent), fadeTop: Math.round(fadeTop), emptyGapAboveFade: Math.round(fadeTop - lastContent), pageHeight: document.documentElement.scrollHeight };
});

const seam = (file) => page.evaluate(async (src) => {
  const img = new Image(); img.src = src; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(8, 0, 1, img.height).data; // x = 4 CSS px at 2x
  const px = []; for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]);
  let max = 0, at = 0;
  for (let y = 56 * 2 + 2; y < px.length; y += 2) { const s = Math.max(...px[y].map((v, k) => Math.abs(v - px[y - 2][k]))); if (s > max) { max = s; at = y / 2; } }
  return { maxStepPerCssRow: max, atCssY: at, fadeFrom: px[px.length - 1 - 2 * 200], footer: px[px.length - 4] };
}, file);

const report = {};
const shapes = ['s1', 's2', 's3', 's4'];
for (const o of ['a', 'b', 'c']) for (const s of shapes) {
  await page.goto(`file://${dir}${o}.html#${s}`);
  await page.waitForTimeout(100);
  const name = `${o}-${s}`;
  await page.screenshot({ path: `${dir}${name}.png` });
  const full = await page.screenshot({ fullPage: true });
  writeFileSync(`${dir}seam/${name}-full.png`, full);
  report[name] = { ...(await measure()), seam: await seam(`data:image/png;base64,${full.toString('base64')}`) };
  console.log(name, JSON.stringify(report[name]));
}
await page.goto(`file://${dir}tap.html`);
await page.screenshot({ path: `${dir}tap.png` });
report.tap = await measure();
console.log('tap', JSON.stringify(report.tap));

// Contact sheet: 3 columns (A, B, C), one row per shape.
const labels = { s1: '1. dancer + DJ, gigs', s2: '2. dancer + DJ, no photo', s3: '3. dancer + teacher (closed)', s4: '4. three roles' };
const cell = (o, s) => `<figure><img src="file://${dir}${o}-${s}.png"><figcaption>${o.toUpperCase()} &middot; ${labels[s]}</figcaption></figure>`;
const sheet = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#1E1410;color:#FBEBDD;font:600 16px system-ui;padding:16px}
h1{font-size:22px;margin:0 0 12px}.g{display:grid;grid-template-columns:repeat(3,260px);gap:16px}figure{margin:0}img{width:260px;display:block;border-radius:8px}figcaption{margin-top:4px;font-size:13px}</style>
<h1>W2-D person hub: A stacked cards &middot; B role switcher &middot; C hero + Also</h1><div class="g">${shapes.map((s) => ['a', 'b', 'c'].map((o) => cell(o, s)).join('')).join('')}</div>`;
writeFileSync(`${dir}seam/overview.html`, sheet);
const sp = await (await br.newContext({ viewport: { width: 844, height: 800 }, deviceScaleFactor: 1 })).newPage();
await sp.goto(`file://${dir}seam/overview.html`);
await sp.waitForTimeout(300);
await sp.screenshot({ path: `${dir}overview.png`, fullPage: true });
report.errors = errors;
writeFileSync(`${dir}report.json`, JSON.stringify(report, null, 2) + '\n');
await br.close();
