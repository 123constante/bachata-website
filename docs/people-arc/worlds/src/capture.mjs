// Screenshots every page (person x world, plus the dancer lower-half options) at 390x844 and 360x800,
// and runs the self-checks on the rendered DOM. Writes shots/*.png and checks.json.
// Run: node docs/people-arc/worlds/src/capture.mjs
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..');
const shots = join(dir, 'shots');
mkdirSync(shots, { recursive: true });
const facts = readFileSync(join(dir, 'src/facts.js'), 'utf8');
// The page list lives in facts.js; evaluate it once here so the two never disagree.
const { PAGES, PEOPLE } = new Function(`${facts}; return { PAGES, PEOPLE };`)();
const RUNS = [
  ...PAGES.map((x) => ({ ...x, f: null, file: x.key })),
  ...['magda', 'ramiro'].flatMap((p) => [1, 2, 3].map((f) => ({ key: `${p}-dancer`, person: p, role: 'dancer', f, file: `${p}-dancer-f${f}` }))),
];
const SIZES = [[390, 844], [360, 800]];

function audit() {
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(',').map((x) => parseFloat(x)); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  // Every solid colour the text can sit on: a flat background, or every opaque stop of a gradient (worst case wins).
  const groundsOf = (el) => {
    for (let e = el; e; e = e.parentElement) {
      if (e.dataset.photo) return null;
      const s = getComputedStyle(e); const out = [];
      const c = parse(s.backgroundColor); if (c && c.a > 0.99) out.push(c);
      if (s.backgroundImage !== 'none') for (const m of s.backgroundImage.matchAll(/rgba?\([^)]+\)/g)) { const g = parse(m[0]); if (g.a > 0.99) out.push(g); }
      if (out.length) return out;
    }
    return [parse(getComputedStyle(document.body).backgroundColor)];
  };
  const texts = []; const seen = new Set();
  const walker = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement; if (seen.has(el) || el.closest('.flag')) continue; seen.add(el);
    const gs = groundsOf(el); if (!gs) { texts.push({ text: n.textContent.trim().slice(0, 30), ratio: null }); continue; }
    const fg = lum(parse(getComputedStyle(el).color));
    const ratio = Math.min(...gs.map((g) => { const [a, b] = [fg, lum(g)].sort((x, y) => y - x); return (a + 0.05) / (b + 0.05); }));
    texts.push({ text: n.textContent.trim().slice(0, 30), ratio: Math.round(ratio * 100) / 100 });
  }
  const taps = [...document.querySelectorAll('main a, main button')].map((e) => { const r = e.getBoundingClientRect(); return { text: e.textContent.trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) }; });
  const clipped = [...document.querySelectorAll('main *')].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'visible').map((e) => e.textContent.trim().slice(0, 30));
  const off = [...document.querySelectorAll('main *')].filter((e) => e.getBoundingClientRect().right > innerWidth + 0.5).map((e) => e.textContent.trim().slice(0, 30));
  const tab = document.querySelector('[role=tablist]');
  const fonts = [...new Set([...document.querySelectorAll('main h1, main h2')].map((e) => (document.fonts.check(`${getComputedStyle(e).fontWeight} 20px ${getComputedStyle(e).fontFamily.split(',')[0]}`) ? 'ok' : `missing ${getComputedStyle(e).fontFamily}`)))];
  return {
    texts, taps, clipped, offscreen: off, fonts,
    sideways: document.documentElement.scrollWidth > innerWidth,
    tabRows: document.querySelectorAll('[role=tablist]').length,
    tabY: tab ? Math.round(tab.getBoundingClientRect().top + scrollY) : null,
    backY: Math.round(document.querySelector('.back').getBoundingClientRect().top + scrollY),
    tabsShown: tab ? [...tab.querySelectorAll('[role=tab]')].map((t) => t.textContent.trim() + (t.getAttribute('aria-selected') === 'true' ? '*' : '')) : [],
    footerTop: Math.round(document.querySelector('.site-foot').getBoundingClientRect().top + scrollY),
    height: document.documentElement.scrollHeight,
  };
}

const url = pathToFileURL(join(dir, 'worlds.html')).href;
const browser = await chromium.launch();
const results = [];
for (const run of RUNS) {
  for (const [w, h] of SIZES) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(`${url}?p=${run.person}&r=${run.role}${run.f ? `&f=${run.f}` : ''}`);
    await page.evaluate(() => document.fonts.ready);
    const file = `${run.file}-${w}.png`;
    await page.screenshot({ path: join(shots, file), fullPage: true });
    const r = await page.evaluate(audit);
    results.push({ ...run, w, h, multi: PEOPLE[run.person].roles.length > 1, shot: file, ...r });
    await page.close();
  }
}
await browser.close();
writeFileSync(join(dir, 'checks.json'), JSON.stringify(results, null, 1));

const s = { renders: results.length, minContrast: 99, lowContrast: [], smallTaps: [], clipped: [], offscreen: [], sideways: [], tabRowWrong: [], tabY: [...new Set(results.filter((r) => r.tabY !== null).map((r) => `${r.w}:${r.tabY}`))], backY: [...new Set(results.map((r) => r.backY))], fonts: [...new Set(results.flatMap((r) => r.fonts))] };
for (const r of results) {
  for (const t of r.texts) if (t.ratio !== null) { s.minContrast = Math.min(s.minContrast, t.ratio); if (t.ratio < 4.5) s.lowContrast.push(`${r.shot}: "${t.text}" ${t.ratio}`); }
  for (const t of r.taps) if (t.w < 44 || t.h < 44) s.smallTaps.push(`${r.shot}: "${t.text}" ${t.w}x${t.h}`);
  if (r.clipped.length) s.clipped.push(`${r.shot}: ${r.clipped.join(' | ')}`);
  if (r.offscreen.length) s.offscreen.push(`${r.shot}: ${r.offscreen.join(' | ')}`);
  if (r.sideways) s.sideways.push(r.shot);
  if (r.multi ? r.tabRows !== 1 : r.tabRows !== 0) s.tabRowWrong.push(r.shot);
}
writeFileSync(join(dir, 'checks-summary.json'), JSON.stringify(s, null, 1));
console.log(JSON.stringify(s, null, 1));
