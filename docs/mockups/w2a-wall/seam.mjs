// Seam measurement (W2-A seam fix): node docs/mockups/w2a-wall/seam.mjs <baseUrl> <label> [width] [--shots]
// Production build, flag ON, 390x844 (or width). Samples the screenshot pixel column x=4 (page ground,
// outside every pill and tile) across the seam zone: 48px outside the wall's edge and 72px inside it
// (the 64px fade + 8). Reports the largest colour step between adjacent rows. The /djs footer starts
// ~54px under the wall (site-wide, same with the flag OFF), so the window stops short of it. Exits 1 if any step is >= 6 in any channel (a hard line).
// --shots also saves the tall wall -> next-section capture.
import { chromium } from 'playwright';
const [base, label, w = '390', shots] = process.argv.slice(2);
const dir = new URL('.', import.meta.url).pathname;
const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const ctx = await br.newContext({ viewport: { width: +w, height: 844 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const out = {};
for (const path of ['/dancers', '/djs']) {
  await page.goto(base + path, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="wall-tile"]', { timeout: 30000 });
  await page.waitForTimeout(1500);
  for (const seam of ['top', 'bottom']) {
    const y = await page.evaluate((s) => {
      const r = document.querySelector('[data-testid="wall-root"]').getBoundingClientRect();
      const abs = (s === 'top' ? r.top : r.bottom) + scrollY;
      scrollTo(0, Math.max(0, abs - 422)); return abs - scrollY;
    }, seam);
    await page.waitForTimeout(600);
    const yy = await page.evaluate((s) => { const r = document.querySelector('[data-testid="wall-root"]').getBoundingClientRect(); return s === 'top' ? r.top : r.bottom; }, seam);
    const buf = await page.screenshot();
    const [lo, hi] = seam === 'top' ? [-48, 72] : [-72, 48];
    const rows = await page.evaluate(async ({ b64, y0, x, lo, hi }) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const res = [];
      for (let y = Math.round(y0) + lo; y <= Math.round(y0) + hi; y++) { if (y < 0 || y >= img.height) continue; const d = g.getImageData(x, y, 1, 1).data; res.push([y - Math.round(y0), d[0], d[1], d[2]]); }
      return res;
    }, { b64: buf.toString('base64'), y0: yy, x: 4, lo, hi });
    if (rows.length !== hi - lo + 1) { console.error(`${path} ${seam}: window cut by the viewport (${rows.length} of ${hi - lo + 1} rows)`); process.exit(2); }
    let max = 0, at = null;
    for (let i = 1; i < rows.length; i++) { const d = Math.max(...[1, 2, 3].map((k) => Math.abs(rows[i][k] - rows[i - 1][k]))); if (d > max) { max = d; at = rows[i][0]; } }
    const pick = (o) => rows.find((r) => r[0] === o)?.slice(1);
    if (shots === '--shots' && seam === 'bottom') {
      await page.setViewportSize({ width: +w, height: 1400 });
      await page.evaluate(() => { const r = document.querySelector('[data-testid="wall-root"]').getBoundingClientRect(); scrollTo(0, r.bottom + scrollY - 900); });
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${dir}on-${path.slice(1)}-wall-to-next.png` });
      await page.setViewportSize({ width: +w, height: 844 });
    }
    out[`${path} ${seam}`] = { maxRowDelta: max, atOffset: at, above48: pick(-48), above8: pick(-8), below8: pick(8), below48: pick(48) };
  }
}
console.log(label, w, JSON.stringify(out, null, 1));
await br.close();
const worst = Math.max(...Object.values(out).map((v) => v.maxRowDelta));
if (worst >= 6) { console.error(`HARD SEAM: max row step ${worst} >= 6`); process.exit(1); }
