import { chromium } from 'playwright';
const BASE = 'http://localhost:4173';
const SLUGS = (process.env.SLUGS || 'papacito,jeff,ramiro-zapata,nico,carlos-de-la-cruz,chong,bobby-blanco,brito,dj-chino-bzuk26').split(',');
const W = Number(process.env.W || 390), H = Number(process.env.H || 844);
const b = await chromium.launch();
for (const slug of SLUGS) {
  const ctx = await b.newContext({ viewport: { width: W, height: H } });
  const p = await ctx.newPage();
  await p.addInitScript(() => { window.__cls = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls.push({ v: e.value, t: Math.round(e.startTime), src: (e.sources || []).map((s) => (s.node && (s.node.getAttribute?.('data-testid') || s.node.nodeName)) + ':' + Math.round(s.previousRect.y) + '->' + Math.round(s.currentRect.y)) }); }).observe({ type: 'layout-shift', buffered: true }); });
  await p.goto(`${BASE}/djs/${slug}`, { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-testid="dj-world"]', { timeout: 20000 });
  await p.waitForTimeout(1500);
  const r = await p.evaluate(() => {
    const box = (id) => { const e = document.querySelector(`[data-testid="${id}"]`); if (!e) return null; const r = e.getBoundingClientRect(); return { y: Math.round(r.top + scrollY), h: Math.round(r.height), w: Math.round(r.width) }; };
    const foot = document.querySelector('footer'); const fy = foot ? Math.round(foot.getBoundingClientRect().top + scrollY) : null;
    const world = document.querySelector('[data-testid="dj-world"]').getBoundingClientRect();
    return { cls: window.__cls, tabs: box('role-tabs'), back: box('frame-back'), invite: box('dj-invite'), empty: box('dj-empty-action'), book: box('dj-book'),
      worldBottom: Math.round(world.bottom + scrollY), footerY: fy, docH: document.documentElement.scrollHeight,
      backHref: document.querySelector('[data-testid="frame-back"]')?.getAttribute('href'), h1: document.querySelector('h1')?.textContent,
      body: getComputedStyle(document.body).backgroundColor, header: getComputedStyle(document.querySelector('header') || document.body).backgroundColor };
  });
  console.log(slug, JSON.stringify(r));
  await ctx.close();
}
await b.close();
