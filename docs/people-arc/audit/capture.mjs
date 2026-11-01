// People arc P0 audit capture. Read-only: loads pages from two local dev servers on prod reads and
// writes full-page screenshots + a measurements JSON. Run from the repo root:
//   node docs/people-arc/audit/capture.mjs
// main  = http://127.0.0.1:5201 (main, prod-like flags: peopleWall/personHub/teacher pages OFF)
// hub   = http://127.0.0.1:5202 (PR #963 head, peopleWall/personHub/teacher+organiser pages ON)
import { chromium } from 'playwright';
import fs from 'node:fs';
const OUT = 'docs/people-arc/audit';
const BUILDS = { main: 'http://127.0.0.1:5201', hub: 'http://127.0.0.1:5202' };
const WIDTHS = [[390, 844], [360, 800]];
const SHAPES = JSON.parse(fs.readFileSync(`${OUT}/shapes.json`, 'utf8'));
const WALLS = ['/dancers', '/djs', '/teachers', '/organisers'];
const BASE_OF = { dancer: '/dancers', dj: '/djs', teacher: '/teachers' };

const measure = () => {
  const lum = (c) => { const m = (c.match(/[\d.]+/g) || [0, 0, 0]).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
  const alpha = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return 1; const p = m[1].split(',').map((s) => +s); return p.length > 3 ? p[3] : 1; };
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.backgroundImage !== 'none' && !/url\(/.test(s.backgroundImage)) return { grad: s.backgroundImage.slice(0, 60) }; if (/url\(/.test(s.backgroundImage) || e.tagName === 'IMG') return { img: true }; const c = s.backgroundColor; if (c && alpha(c) > 0.5) return { c }; } return { c: getComputedStyle(document.body).backgroundColor }; };
  const root = document.querySelector('main') || document.body;
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !el.closest('.sr-only,[aria-hidden=true]'); };
  const lowContrast = []; let grad = 0;
  for (const el of root.querySelectorAll('*')) {
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own || !vis(el)) continue;
    const bg = bgOf(el); if (!bg.c) { grad++; continue; }
    const fg = getComputedStyle(el).color; const l1 = lum(fg), l2 = lum(bg.c);
    const cr = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const fs = parseFloat(getComputedStyle(el).fontSize); const bold = +getComputedStyle(el).fontWeight >= 700;
    const need = fs >= 24 || (fs >= 18.66 && bold) ? 3 : 4.5;
    if (cr < need) lowContrast.push({ text: el.textContent.trim().slice(0, 40), ratio: +cr.toFixed(2), fg, bg: bg.c, px: fs });
  }
  const smallTaps = [];
  for (const el of document.querySelectorAll('main a, main button, header a, header button, [role=tab]')) {
    if (!vis(el)) continue; const r = el.getBoundingClientRect();
    if (Math.min(r.width, r.height) < 44) smallTaps.push({ text: (el.textContent.trim() || el.getAttribute('aria-label') || '').slice(0, 30), w: Math.round(r.width), h: Math.round(r.height), href: el.getAttribute('href') });
  }
  const clipped = [];
  for (const el of root.querySelectorAll('*')) { if (!vis(el)) continue; const s = getComputedStyle(el); if ((el.scrollWidth > el.clientWidth + 1 && s.overflowX !== 'visible') || (s.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth)) { const t = el.textContent.trim(); if (t) clipped.push(`${el.tagName.toLowerCase()}: ${t.slice(0, 40)} (${el.scrollWidth}/${el.clientWidth})`); } }
  const h1 = document.querySelector('h1');
  const st = (el) => { if (!el) return null; const s = getComputedStyle(el); return { text: el.textContent.trim().slice(0, 60), font: s.fontFamily.split(',')[0], px: s.fontSize, weight: s.fontWeight, color: s.color }; };
  // Ground colours: body + the first big block under main.
  const grounds = [];
  for (const el of [document.body, root, ...root.querySelectorAll(':scope > *, :scope > * > *')].slice(0, 12)) { const s = getComputedStyle(el); if (alpha(s.backgroundColor) > 0.5 || s.backgroundImage !== 'none') grounds.push({ tag: el.tagName.toLowerCase(), cls: (el.className?.toString?.() || '').slice(0, 50), bg: s.backgroundColor, img: s.backgroundImage === 'none' ? null : s.backgroundImage.slice(0, 80), radius: s.borderRadius }); }
  // Chips: small rounded inline elements with short text.
  const chips = [];
  for (const el of root.querySelectorAll('span,a,div,li')) { if (!vis(el)) continue; const s = getComputedStyle(el); const t = el.textContent.trim(); if (t && t.length < 24 && parseFloat(s.borderRadius) >= 8 && el.children.length <= 2 && (alpha(s.backgroundColor) > 0.05 || parseFloat(s.borderTopWidth) > 0)) chips.push({ text: t, bg: s.backgroundColor, border: s.borderTopWidth + ' ' + s.borderTopColor, radius: s.borderRadius, px: s.fontSize, h: Math.round(el.getBoundingClientRect().height) }); if (chips.length >= 25) break; }
  const links = [...document.querySelectorAll('main a[href]')].filter(vis).map((a) => ({ text: (a.textContent.trim() || a.getAttribute('aria-label') || '').slice(0, 40), href: a.getAttribute('href') })).slice(0, 60);
  return { title: document.title, h1: st(h1), bodyFont: getComputedStyle(document.body).fontFamily.split(',')[0], scrollWidth: document.documentElement.scrollWidth, docH: document.documentElement.scrollHeight, text: (root.innerText || '').replace(/\n{2,}/g, '\n').slice(0, 2500), lowContrast: lowContrast.slice(0, 15), lowContrastCount: lowContrast.length, textOnGradientOrImage: grad, smallTaps: smallTaps.slice(0, 20), smallTapCount: smallTaps.length, clipped: clipped.slice(0, 10), grounds, chips, links, robots: document.querySelector('meta[name=robots]')?.content ?? null };
};

const b = await chromium.launch(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } } : {});
const report = [];
async function shot(build, screen, shape, path, w, h) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  let status = null;
  p.on('response', (r) => { if (r.request().resourceType() === 'document' && status === null) status = r.status(); });
  try {
    await p.goto(BUILDS[build] + path, { waitUntil: 'networkidle', timeout: 45000 });
  } catch (e) { /* keep going: networkidle can time out on long-poll; we still measure */ }
  await p.waitForTimeout(1500);
  const m = await p.evaluate(measure).catch((e) => ({ error: String(e) }));
  const file = `${build}-${screen}-${shape}-${w}.png`;
  await p.screenshot({ path: `${OUT}/shots/${file}`, fullPage: true });
  report.push({ build, screen, shape, path, width: w, status, landed: new URL(p.url()).pathname, file, ...m });
  fs.writeFileSync(`${OUT}/measurements.json`, JSON.stringify(report, null, 1));
  await p.close();
}
for (const build of Object.keys(BUILDS)) {
  for (const [w, h] of WIDTHS) {
    for (const wall of WALLS) await shot(build, `wall${wall.replace('/', '-')}`, 'all', wall, w, h);
    for (const s of SHAPES) {
      const roles = s.roles === 'none' ? [] : s.roles.split('+');
      const screens = s.hidden ? ['dancer', 'dj', 'teacher'] : roles;
      for (const r of screens) await shot(build, `role-${r}`, s.shape, `${BASE_OF[r]}/${s.id}`, w, h);
      if (build === 'hub' || s.hidden) await shot(build, 'hub', s.shape, `/people/${s.id}`, w, h);
      if (!s.hidden && roles.length === 0) await shot(build, 'role-dancer', s.shape, `/dancers/${s.id}`, w, h);
    }
  }
}
fs.writeFileSync(`${OUT}/measurements.json`, JSON.stringify(report, null, 1));
await b.close();
console.log(report.length, 'pages');
