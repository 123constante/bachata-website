import { chromium } from 'playwright';
import sharp from 'sharp';
const BASE = 'http://127.0.0.1:5199';
const OUT = 'docs/mockups/w2d-hub-build';
const HUBS = {
  'dancer-teacher': '017dee9f-c30a-45e3-b2b9-01dab3cb8062',
  'dancer-dj-teacher-gig': '005a7329-90a3-4d81-8854-296a4a6db673',
  'dancer-dj-teacher-nogig': '225cfe43-1558-4342-a4a4-09900f33b7de',
  'dancer-dj-gig': '11549aa4-599a-4be1-96e2-262f0696f9b1',
  'dancer-dj-nogig': '061c6300-763c-4496-9556-2f883b3b7723',
  'dj-teacher': 'a8f270d4-4d39-46da-920f-81da41135a0e',
};
const REDIRECTS = { dancer: '00422bf9-1f6e-4d15-b598-dcfbc1a7d5f3', dj: '59150b2d-0963-4cea-80fd-76c2d48ab23c', teacher: '0786f332-8082-4574-aad4-df56be2be5d7', none: '0f5f2045-167c-483f-a725-a5e8890ccfa3' };
const b = await chromium.launch();
const report = { hubs: {}, redirects: {} };
const measure = () => {
  const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return [0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]), m[3] ?? 1]; };
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.backgroundImage !== 'none' && e.getAttribute('data-hub-footer-join') === null) return { grad: true }; const c = s.backgroundColor; if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return { c }; } return { c: getComputedStyle(document.body).backgroundColor }; };
  const hub = document.querySelector('[data-testid=person-hub]');
  let minC = 99, minAt = '', grad = 0;
  for (const el of hub.querySelectorAll('*')) {
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own || el.closest('.sr-only')) continue;
    const r = el.getBoundingClientRect(); if (!r.width) continue;
    const bg = bgOf(el); if (bg.grad) { grad++; continue; }
    const [l1] = lum(getComputedStyle(el).color), [l2] = lum(bg.c);
    const cr = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    if (cr < minC) { minC = cr; minAt = el.textContent.trim().slice(0, 30); }
  }
  let minTap = 999, tapAt = '';
  for (const el of hub.querySelectorAll('a,button')) { const r = el.getBoundingClientRect(); const m = Math.min(r.width, r.height); if (m < minTap) { minTap = m; tapAt = el.textContent.trim().slice(0, 30); } }
  const clipped = [];
  for (const el of hub.querySelectorAll('*')) if (!el.matches(".sr-only") && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible' && el.textContent.trim()) clipped.push(`${el.tagName}:${el.textContent.trim().slice(0, 20)}:${el.scrollWidth}/${el.clientWidth}`);
  const top = hub.getBoundingClientRect().top + scrollY;
  const footer = document.querySelector('footer.site-footer').getBoundingClientRect().top + scrollY;
  return { minContrast: +minC.toFixed(2), minContrastAt: minAt, textOnGradient: grad, minTap: Math.round(minTap), minTapAt: tapAt, clipped, scrollWidth: document.documentElement.scrollWidth, hubTop: Math.round(top), footerTop: Math.round(footer), docH: document.documentElement.scrollHeight, lead: hub.dataset.lead };
};
for (const [name, id] of Object.entries(HUBS)) {
  report.hubs[name] = {};
  for (const w of [360, 390, 430]) {
    const p = await b.newPage({ viewport: { width: w, height: 844 }, deviceScaleFactor: 1 });
    await p.goto(`${BASE}/people/${id}`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(800);
    const m = await p.evaluate(measure);
    // Seam: x=4 column from under the hub top to 40px into the footer, one CSS px per row, max channel step.
    const buf = await p.screenshot({ fullPage: true });
    const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
    let step = 0, at = 0;
    const px = (y) => { const i = (y * info.width + 4) * info.channels; return [data[i], data[i + 1], data[i + 2]]; };
    for (let y = m.hubTop + 1; y < Math.min(info.height - 1, m.footerTop + 40); y++) { const a = px(y - 1), c = px(y); const d = Math.max(...a.map((v, k) => Math.abs(v - c[k]))); if (d > step) { step = d; at = y; } }
    m.seamStep = step; m.seamAt = at;
    report.hubs[name][w] = m;
    if (w === 390) await p.screenshot({ path: `${OUT}/${name}.png` });
    if (w === 390 && name === 'dancer-dj-teacher-gig') await p.screenshot({ path: `${OUT}/${name}-full.png`, fullPage: true });
    await p.close();
  }
}
for (const [name, id] of Object.entries(REDIRECTS)) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto(`${BASE}/people/${id}`, { waitUntil: 'networkidle' });
  report.redirects[name] = { landed: new URL(p.url()).pathname, historyLength: await p.evaluate(() => history.length) };
  await p.close();
}
// Wall: /dancers tiles (photo fallback), screenshot near the Jxjx tile.
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
await p.goto(`${BASE}/dancers`, { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
report.wall = await p.evaluate(() => {
  const faces = [...document.querySelectorAll('[data-testid=wall-face]')];
  const broken = [...document.querySelectorAll('[data-testid=wall-face] img')].filter((i) => i.complete && i.naturalWidth === 0).length;
  const jx = [...document.querySelectorAll('[data-testid=wall-tile]')].find((t) => /jxjx/i.test(t.textContent));
  return { tiles: faces.length, brokenImgs: broken, jxjx: jx ? { face: jx.querySelector('[data-testid=wall-face]').dataset.face, href: jx.getAttribute('href') } : null };
});
const jx = await p.$('[data-testid=wall-tile]:has-text("Jxjx")');
if (jx) { await jx.scrollIntoViewIfNeeded(); await p.screenshot({ path: `${OUT}/wall-jxjx-fallback.png` }); }
await b.close();
console.log(JSON.stringify(report));
