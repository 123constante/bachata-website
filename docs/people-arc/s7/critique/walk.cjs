const { chromium } = require('playwright');
const [base, label, slugList, sizeList] = process.argv.slice(2);
const slugs = slugList.split(','); const sizes = (sizeList || '390x844,360x800').split(',').map((s) => s.split('x').map(Number));
(async () => {
  const browser = await chromium.launch(); const out = [];
  for (const slug of slugs) for (const [w, hgt] of sizes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: hgt }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); const errs = []; const rpcs = [];
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text().slice(0, 160)); });
    page.on('pageerror', (e) => errs.push('PAGEERROR ' + String(e).slice(0, 160)));
    page.on('request', (r) => { const u = r.url(); if (u.includes('supabase.co')) rpcs.push(u.replace(/^.*\/(rest|rpc)\/v1\//, '').split('?')[0]); });
    await page.addInitScript(() => { window.__shifts = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__shifts.push({ v: e.value, t: e.startTime }); }).observe({ type: 'layout-shift', buffered: true }); });
    const res = await page.goto(`${base}/dancers/${slug}`, { waitUntil: 'load' });
    const html = await res.text();
    const servedTabs = [...html.matchAll(/data-testid="role-tab"[^>]*?>/g)].length;
    const teacherLinks = (html.match(/href="\/teachers\//g) || []).length;
    await page.waitForTimeout(6000);
    const shifts = await page.evaluate(() => window.__shifts);
    let best = 0, cur = 0, start = 0, last = -1e9;
    for (const s of shifts) { if (s.t - last > 1000 || s.t - start > 5000) { cur = 0; start = s.t; } cur += s.v; last = s.t; best = Math.max(best, cur); }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    const tabsNow = await page.locator('[data-testid="role-tab"]').count();
    out.push({ label, slug, size: `${w}x${hgt}`, status: res.status(), cls: +best.toFixed(3), servedTabs, tabsNow, teacherLinks, overflow, errs: errs.filter((e) => !/Failed to load resource|favicon|ERR_|net::/.test(e)), supabase: rpcs });
    await ctx.close();
  }
  await browser.close(); console.log(JSON.stringify(out));
})();
