// S4 critique probe: layout shifts (with sources), the frame boxes on the teacher, DJ and dancer worlds,
// the seams (header / page box / the layout below it / footer), the tap boxes and sideways scroll.
// Copy under node_modules/.cache/ and run against the served flag-ON build.
import { chromium } from 'playwright';
const BASE = 'http://localhost:4173';
const PAGES = (process.env.PAGES || 'teachers/melita-somos,teachers/viola-palmai,teachers/llf-enoch-lopez,teachers/magda-sobolewska,djs/papacito,dancers/ramiro-zapata').split(',');
const W = Number(process.env.W || 390), H = Number(process.env.H || 844);
const b = await chromium.launch();
for (const path of PAGES) {
  const ctx = await b.newContext({ viewport: { width: W, height: H } });
  const p = await ctx.newPage();
  await p.addInitScript(() => { window.__cls = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls.push({ v: Math.round(e.value * 1000) / 1000, t: Math.round(e.startTime), src: (e.sources || []).map((s) => (s.node && (s.node.getAttribute?.('data-testid') || s.node.nodeName)) + ':' + Math.round(s.previousRect.y) + '->' + Math.round(s.currentRect.y)) }); }).observe({ type: 'layout-shift', buffered: true }); });
  await p.goto(`${BASE}/${path}`, { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-testid="person-frame"]', { timeout: 20000 });
  await p.waitForTimeout(2000);
  const r = await p.evaluate(() => {
    const box = (id) => { const e = document.querySelector(`[data-testid="${id}"]`); if (!e) return null; const r = e.getBoundingClientRect(); return `L${Math.round(r.left)} T${Math.round(r.top + scrollY)} ${Math.round(r.width)}x${Math.round(r.height)}`; };
    const bg = (el) => el ? getComputedStyle(el).backgroundColor : null;
    const page = document.querySelector('[data-testid="world-page"]');
    const pr = page.getBoundingClientRect();
    const foot = document.querySelector('footer');
    const taps = [...document.querySelectorAll('[data-testid="person-frame"] a, [data-testid="person-frame"] button')].filter((e) => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).map((e) => e.textContent.trim().slice(0, 20));
    return {
      card: box('teacher-card'), classes: box('teacher-classes'), empty: box('teacher-empty'), details: box('teacher-details'), contact: box('teacher-contact'), invite: box('teacher-invite') ?? box('dj-invite') ?? box('dancer-world-invite'),
      cls: window.__cls, back: box('frame-back'), share: box('frame-share'), tabs: box('role-tabs'),
      bar: Math.round(document.querySelector('[data-testid="frame-back"]').parentElement.getBoundingClientRect().width),
      pageBottom: Math.round(pr.bottom + scrollY), footerTop: foot ? Math.round(foot.getBoundingClientRect().top + scrollY) : null,
      body: bg(document.body), html: bg(document.documentElement), pageBg: bg(page), pageImg: getComputedStyle(page).backgroundImage.slice(0, 40),
      h1: document.querySelector('h1')?.textContent, backHref: document.querySelector('[data-testid="frame-back"]')?.getAttribute('href'),
      sideways: document.documentElement.scrollWidth > innerWidth, taps,
    };
  });
  console.log(path, W, JSON.stringify(r));
  await ctx.close();
}
await b.close();
