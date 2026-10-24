const { chromium } = require('playwright');
const [base, from, to] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const p = await ctx.newPage();
  const errs = []; p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)); });
  await p.goto(`${base}/dancers/${from}`, { waitUntil: 'load' }); await p.waitForTimeout(4000);
  const reqs = []; p.on('request', (r) => { const u = r.url(); if (u.includes('supabase.co') || u.includes('.data')) reqs.push(u.replace(/^https?:\/\/[^/]+/, '').split('?')[0]); });
  const keys = await p.evaluate(() => Object.keys(window).filter((k) => /react|router/i.test(k)));
  // observe tab count over time after navigation
  await p.evaluate(() => { window.__tabSeries = []; const t0 = performance.now(); const tick = () => { window.__tabSeries.push([Math.round(performance.now() - t0), document.querySelectorAll('[data-testid="role-tab"]').length, location.pathname]); if (performance.now() - t0 < 5000) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  await p.evaluate((to) => window.__reactRouterDataRouter ? window.__reactRouterDataRouter.navigate(`/dancers/${to}`) : null, to);
  await p.waitForTimeout(5500);
  const series = await p.evaluate(() => window.__tabSeries);
  const changes = series.filter((s, i) => i === 0 || s[1] !== series[i - 1][1] || s[2] !== series[i - 1][2]);
  console.log(JSON.stringify({ keys, path: await p.evaluate(() => location.pathname), tabChanges: changes, reqs, errs }));
  await b.close();
})();
