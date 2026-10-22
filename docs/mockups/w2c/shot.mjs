// W2-C mockups: one 390x844 picture per view + self-running checks (contrast, tap size, clipped
// text, page width, seam step at x = 6). Run: node docs/mockups/w2c/shot.mjs
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const page0 = pathToFileURL(join(here, 'index.html')).href;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto(page0);
const views = await page.evaluate(() => window.__VIEWS);
const report = {};

for (const id of views) {
  await page.goto(`${page0}?view=${id}`);
  const r = await page.evaluate(() => {
    const rgb = (s) => (s.match(/[\d.]+/g) || []).map(Number);
    const lum = ([r, g, b]) => [r, g, b].map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; })
      .reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
    // Nearest painted background: the first ancestor with an opaque colour, or the first stop of a gradient.
    const bgOf = (el) => {
      for (let e = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        const c = rgb(cs.backgroundColor);
        if (c.length >= 3 && (c[3] ?? 1) > 0.5) return c.slice(0, 3);
        const gm = cs.backgroundImage.match(/rgba?\([^)]+\)|#[0-9a-f]{6}/i);
        if (gm && !/rgba\([^)]*,\s*0\)/.test(gm[0])) return rgb(gm[0]).slice(0, 3);
      }
      return [16, 18, 20];
    };
    let min = 99, minAt = '';
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = walker.nextNode());) {
      if (!n.textContent.trim()) continue;
      const el = n.parentElement;
      if (el.closest('.site-head, .site-foot, script, style')) continue;
      const cs = getComputedStyle(el);
      if (cs.color === 'rgba(0, 0, 0, 0)' || cs.visibility === 'hidden') continue;
      const v = ratio(rgb(cs.color).slice(0, 3), bgOf(el));
      if (v < min) { min = v; minAt = n.textContent.trim().slice(0, 30); }
    }
    const small = [...document.querySelectorAll('[data-tap], .phone a, .phone button')]
      .filter((e) => !e.closest('.site-head, .site-foot'))
      .map((e) => e.getBoundingClientRect()).filter((b) => b.width && (b.height < 44 || b.width < 44)).length;
    const clipped = [...document.querySelectorAll('.phone *')].filter((e) => {
      const cs = getComputedStyle(e);
      return /hidden|clip/.test(cs.overflowX) && e.scrollWidth > e.clientWidth + 1 && e.textContent.trim() && !e.querySelector('*') ;
    }).map((e) => e.textContent.trim().slice(0, 30));
    const h1 = document.querySelectorAll('h1');
    return { minContrast: +min.toFixed(2), minAt, smallTaps: small, clipped, scrollWidth: document.documentElement.scrollWidth, h1: h1.length,
      h1Lines: h1.length ? Math.round(h1[0].getBoundingClientRect().height / parseFloat(getComputedStyle(h1[0]).lineHeight)) : 0 };
  });
  const buf = await page.screenshot({ path: join(here, `${id}.png`), fullPage: true });
  // Seam: largest one-row colour step in a pixel column outside the cards (x = 6).
  // (decoded in the page's own canvas: no PNG library in the repo)
  const { step, at, height } = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const col = g.getImageData(6, 0, 1, img.height).data;
    let step = 0, at = 0;
    for (let y = 59; y < img.height - 80; y++) {
      const d = Math.max(...[0, 1, 2].map((k) => Math.abs(col[y * 4 + k] - col[(y + 1) * 4 + k])));
      if (d > step) { step = d; at = y; }
    }
    return { step, at, height: img.height };
  }, buf.toString('base64'));
  report[id] = { ...r, seamMaxStep: step, seamAtY: at, height };
  console.log(id, JSON.stringify(report[id]));
}
// No gallery.png (1.8 MB): open index.html with no ?view= for the labelled gallery.
writeFileSync(join(here, 'report.json'), JSON.stringify(report, null, 2) + '\n');
await browser.close();
