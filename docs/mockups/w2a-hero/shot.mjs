// Walk script: VITE_MOCKS=true dev server running, then
//   node docs/mockups/w2a-hero/shot.mjs http://127.0.0.1:5199
// 390x844. Fixtures (not live reads): photos are drawn silhouettes, so real photo crops are NOT verified.
// Contrast: text is made transparent, the page re-shot, and the background sampled behind each text
// element's centre; foreground is its computed colour. Text >= 4.5 passes (large/bold >= 3 is NOT used).
import { chromium } from 'playwright';
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
const [base] = process.argv.slice(2);
const dir = new URL('.', import.meta.url).pathname;
const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const parse = (s) => s.match(/[\d.]+/g).slice(0, 3).map(Number);
const report = {}; const contrast = {};
const views = [['d1', 'd1-slim'], ['d2', 'd2-today'], ['d3', 'd3-slim-join'], ['j1', 'j1-today'], ['j2', 'j2-new']];
for (const [view, name] of views) {
  await page.goto(`${base}/__mock/w2a-hero/${view}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="wall-tile"], img', { timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${dir}${name}.png` });
  report[name] = await page.evaluate(() => {
    const first = document.querySelector('[data-testid="wall-tile"]');
    const top = first ? first.getBoundingClientRect().top + scrollY : null;
    return { scrollWidth: document.documentElement.scrollWidth, innerWidth, firstTileTop: top, firstTileTopViewport: first ? first.getBoundingClientRect().top : null,
      screensDown: top == null ? null : +(top / innerHeight).toFixed(2), pageHeight: document.documentElement.scrollHeight };
  });
  if (view === 'd2') {
    await page.evaluate(() => window.scrollTo(0, document.querySelector('[data-testid="wall-tile"]').getBoundingClientRect().top + scrollY - 70));
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${dir}d2-today-scrolled.png` });
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  // contrast pass
  const items = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('h1, h3, p, a, span, button, label')) {
      const t = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(' ');
      if (!t) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.top > 800 || r.bottom < 0) continue;
      const cs = getComputedStyle(el);
      out.push({ text: t.slice(0, 40), color: cs.color, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), opacity: +cs.opacity });
    }
    return out;
  });
  await page.addStyleTag({ content: '*{color:transparent !important;text-shadow:none !important} img,svg{visibility:hidden !important}' });
  await page.waitForTimeout(300);
  const raw = await sharp(await page.screenshot()).raw().toBuffer({ resolveWithObject: true });
  contrast[name] = items.map((it) => {
    const i = (Math.min(raw.info.height - 1, it.y) * raw.info.width + Math.min(raw.info.width - 1, it.x)) * raw.info.channels;
    const bg = [raw.data[i], raw.data[i + 1], raw.data[i + 2]];
    const fg = parse(it.color);
    const r = ratio(fg, bg);
    return { text: it.text, fg: `rgb(${fg})`, bg: `rgb(${bg})`, ratio: +r.toFixed(2), pass: r >= 4.5 };
  });
}
writeFileSync(`${dir}contrast.json`, JSON.stringify({ viewport: '390x844', metrics: report, contrast, pageErrors: errors }, null, 1));
console.log(JSON.stringify(report, null, 1));
for (const [k, v] of Object.entries(contrast)) console.log(k, 'fails:', v.filter((x) => !x.pass).map((x) => `${x.text} ${x.ratio}`));
console.log('errors', errors);
await br.close();
