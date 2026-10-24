// usage: node cls.cjs <baseUrl> <label>
const { chromium } = require('playwright');
const base = process.argv[2], label = process.argv[3];
const slugs = (process.argv[4] || 'brito,bobby-blanco,b,ben').split(',');
const shots = process.argv[5];
const sizes = [[390, 844], [360, 800]];
(async () => {
  const browser = await chromium.launch();
  const out = [];
  for (const slug of slugs) for (const [w, hgt] of sizes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: hgt }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const errs = [];
    page.on('console', (m) => { if (m.type() === 'error' && /hydrat|did not match|Minified React error #4(18|19|23|25)/i.test(m.text())) errs.push(m.text().slice(0, 120)); });
    await page.addInitScript(() => {
      window.__shifts = [];
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__shifts.push({ v: e.value, t: e.startTime }); }).observe({ type: 'layout-shift', buffered: true });
    });
    const res = await page.goto(`${base}/dancers/${slug}`, { waitUntil: 'load' });
    const html = await res.text();
    const servedTabs = (html.match(/data-testid="role-tab"/g) || []).length;
    const servedReserve = html.includes('dancer-world-preview-reserve');
    await page.waitForTimeout(6000);
    const shifts = await page.evaluate(() => window.__shifts);
    // CLS = largest session window (1s gap, 5s cap)
    let best = 0, cur = 0, start = 0, last = -1e9;
    for (const s of shifts) { if (s.t - last > 1000 || s.t - start > 5000) { cur = 0; start = s.t; } cur += s.v; last = s.t; best = Math.max(best, cur); }
    if (shots) await page.screenshot({ path: `${shots}/${label}-${slug}-${w}.png`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    const tabsNow = await page.locator('[data-testid="role-tab"]').count();
    out.push({ label, slug, size: `${w}x${hgt}`, status: res.status(), cls: +best.toFixed(3), servedTabs, tabsNow, servedReserve, hydrationErrors: errs.length, overflow, reserveNow: await page.locator('[data-testid="dancer-world-preview-reserve"]').count() });
    await ctx.close();
  }
  await browser.close();
  console.log(JSON.stringify(out));
})();
