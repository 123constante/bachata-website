// People arc S2 critique: layout shift (with its sources), the frame boxes, the flag sticker vs the
// DANCER kicker, the invite, focus ring and the content-to-footer gap on /dancers/:id, flag ON.
// Serve a flag-ON build (scripts/_serve-build.mjs --port 4173), then:
//   SLUGS=elias,leoncio W=390 H=844 node docs/people-arc/s2/critique/probe.mjs
import { chromium } from 'playwright';
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const SLUGS = (process.env.SLUGS || 'carol-y-raul,leoncio,chloe-poyiatz,llf-malva-marina-montenegro,alex-boneva,aurora,elias,aitor-angelica-tbf').split(',');
const W = Number(process.env.W || 390), H = Number(process.env.H || 844);
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } : undefined;
const b = await chromium.launch({ proxy });
for (const slug of SLUGS) {
  const p = await b.newPage({ viewport: { width: W, height: H } });
  await p.addInitScript(() => { window.__cls = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls.push({ v: Math.round(e.value * 1000) / 1000, t: Math.round(e.startTime), src: (e.sources || []).map((s) => (s.node && (s.node.getAttribute?.('data-testid') || s.node.nodeName)) + ':' + Math.round(s.previousRect.y) + '->' + Math.round(s.currentRect.y)) }); }).observe({ type: 'layout-shift', buffered: true }); });
  const path = slug.startsWith('/') ? slug : `/dancers/${slug}`;
  await p.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(2500);
  const r = await p.evaluate(() => {
    const box = (id) => { const e = document.querySelector(`[data-testid="${id}"]`); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) }; };
    const card = document.querySelector('[data-testid="dancer-world-card"]');
    const kicker = card?.firstElementChild?.getBoundingClientRect();
    const flag = card?.querySelector('img,svg[role="img"],[aria-label]:not(h1)')?.getBoundingClientRect();
    const world = document.querySelector('[data-testid="world-page-slot"]') || document.querySelector('[data-testid="world-page"]');
    const foot = document.querySelector('footer');
    return {
      cls: window.__cls, total: Math.round(window.__cls.reduce((a, e) => a + e.v, 0) * 1000) / 1000,
      back: box('frame-back'), share: box('frame-share'), tabs: box('role-tabs'), invite: box('dancer-world-invite-button') || box('dj-invite'),
      flagOverKicker: kicker && flag ? Math.round(kicker.bottom - flag.top) : null,
      footerGap: foot && world ? Math.round(foot.getBoundingClientRect().top - world.getBoundingClientRect().bottom) : null,
      h1: document.querySelector('h1')?.textContent, h2: [...document.querySelectorAll('[data-testid="world-page"] h2')].map((e) => e.textContent),
      fontLink: !!document.getElementById('dj-page-fonts'),
    };
  });
  // Focus ring: tab to the first link inside the world and read its outline.
  await p.focus('[data-testid="dancer-world"] a, [data-testid="dj-world"] a').catch(() => {});
  r.focus = await p.evaluate(() => { const a = document.activeElement; if (!a || a === document.body) return null; const s = getComputedStyle(a); return `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor} off ${s.outlineOffset}`; });
  console.log(slug, JSON.stringify(r));
  await p.close();
}
await b.close();
