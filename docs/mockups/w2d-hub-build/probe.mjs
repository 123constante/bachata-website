// Critique probes (W2-D stage 5): (1) a one-role person's role-page Back control, (2) layout shift while the
// gig list is late (the timeline read is held back 2.5s), (3) the flag-OFF footer is untouched elsewhere.
// Run against local dev on prod reads: node docs/mockups/w2d-hub-build/probe.mjs
import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:5199';
const ONE_ROLE = { dancer: '00422bf9-1f6e-4d15-b598-dcfbc1a7d5f3', dj: '59150b2d-0963-4cea-80fd-76c2d48ab23c' };
const LATE = {
  'dancer-dj-teacher-nogig': '225cfe43-1558-4342-a4a4-09900f33b7de',
  'dancer-dj-teacher-gig': '005a7329-90a3-4d81-8854-296a4a6db673',
  'dancer-dj-nogig': '061c6300-763c-4496-9556-2f883b3b7723',
};
const b = await chromium.launch(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } } : {});
const out = { back: {}, shift: {} };
for (const [name, id] of Object.entries(ONE_ROLE)) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto(`${BASE}/people/${id}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  const landed = new URL(p.url()).pathname;
  const back = await p.evaluate(() => {
    const a = [...document.querySelectorAll('a')].find((x) => /^\s*Back/.test(x.textContent || ''));
    return a ? { text: a.textContent.trim(), href: a.getAttribute('href') } : null;
  });
  let after = null;
  if (back) {
    await p.click(`a[href="${back.href}"]`);
    await p.waitForTimeout(2000);
    after = new URL(p.url()).pathname;
  }
  out.back[name] = { landed, back, afterTap: after, loops: after === landed };
  await p.close();
}
for (const [name, id] of Object.entries(LATE)) {
  out.shift[name] = {};
  for (const w of [360, 390]) {
    const p = await b.newPage({ viewport: { width: w, height: 844 } });
    await p.route('**/rpc/get_profile_event_timeline_v2', async (r) => { await new Promise((s) => setTimeout(s, 2500)); await r.continue(); });
    await p.goto(`${BASE}/people/${id}`, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('[data-testid=person-hub]');
    await p.waitForTimeout(1200);
    const snap = () => p.evaluate(() => {
      const q = (s) => document.querySelector(s);
      const r = (el) => (el ? Math.round(el.getBoundingClientRect().top + scrollY) : null);
      const dj = q('[data-testid=hub-also-card][data-role=dj]');
      return {
        line: q('[data-testid=hub-line]')?.textContent, djCard: dj?.textContent,
        alsoH: Math.round(q('[data-testid=hub-also]')?.getBoundingClientRect().height ?? 0),
        aboutTop: r(q('[data-testid=hub-about]')), lineH: Math.round(q('[data-testid=hub-line]')?.getBoundingClientRect().height ?? 0),
      };
    });
    const before = await snap();
    await p.waitForTimeout(3500);
    const done = await snap();
    out.shift[name][w] = { before, done, aboutMoved: (done.aboutTop ?? 0) - (before.aboutTop ?? 0), alsoGrew: done.alsoH - before.alsoH };
    await p.close();
  }
}
await b.close();
console.log(JSON.stringify(out, null, 1));
