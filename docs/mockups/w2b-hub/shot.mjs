// Walk + design-gate measurements for the person hub at 390x844:
//   node docs/mockups/w2b-hub/shot.mjs <baseUrl> <outName> <path> [wallTap]
// <path> is a /people/<id> URL on a production build (flag ON or OFF), or a fixture harness URL
// for shapes the sandbox database does not have (see docs/handover/w2b-hub.md).
// Records: scrollWidth, h1 count, clipped text, every link/button's tap box, text contrast
// (each text node's colour against the nearest painted background) and the seam colours.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const [base, out, path, mode] = process.argv.slice(2);
const dir = new URL('.', import.meta.url).pathname;
const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const page = await (await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true })).newPage();
const errors = [];
const consoleWarn = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (/hydrat|did not match|#418|#421|#422|#423|#425/i.test(m.text())) consoleWarn.push(m.text().slice(0, 200)); });
if (mode === 'wallTap') {
  await page.goto(base + path, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="wall-tile"]', { timeout: 30000, state: 'attached' });
  const tile = page.locator('a[data-testid="wall-tile"]').first();
  const href = await tile.getAttribute('href');
  await tile.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${dir}${out}-before.png` });
  await tile.click();
  await page.waitForURL((u) => u.pathname !== path, { timeout: 30000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${dir}${out}.png` });
  const r = { tileHref: href, landed: new URL(page.url()).pathname, hub: await page.locator('[data-testid="person-hub"]').count(), h1: await page.locator('h1').first().textContent().catch(() => null), errors, consoleWarn };
  console.log(JSON.stringify(r));
  await br.close();
  process.exit(0);
}
await page.goto(base + path, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: `${dir}${out}.png`, fullPage: true });
const m = await page.evaluate(() => {
  const rgb = (s) => { const x = s.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0]; return { r: x[0], g: x[1], b: x[2], a: x.length > 3 ? x[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const [h, l] = [lum(a), lum(b)].sort((x, y) => y - x); return (h + 0.05) / (l + 0.05); };
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.a > 0.5) return c; const img = getComputedStyle(e).backgroundImage; if (img.includes('rgb(30, 20, 16)')) return { r: 30, g: 20, b: 16, a: 1 }; } return { r: 0, g: 0, b: 0, a: 1 }; };
  const hub = document.querySelector('[data-testid="person-hub"]');
  const scope = hub ?? document.body;
  const texts = [];
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement; const t = n.textContent.trim();
    if (!t || !el || el.closest('.sr-only') || getComputedStyle(el).visibility === 'hidden') continue;
    texts.push({ text: t.slice(0, 40), ratio: Math.round(ratio(rgb(getComputedStyle(el).color), bgOf(el)) * 100) / 100 });
  }
  const taps = [...scope.querySelectorAll('a, button')].map((a) => { const b = a.getBoundingClientRect(); return { what: (a.getAttribute('data-testid') || a.textContent || '').trim().slice(0, 30), w: Math.round(b.width), h: Math.round(b.height) }; });
  const clipped = [...scope.querySelectorAll('h1, h2, [data-testid]')].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'visible').length;
  const header = hub?.querySelector('section'); const card = hub?.querySelector('[data-testid="hub-role-card"]');
  return {
    hub: !!hub, h1: document.querySelectorAll('h1').length, h1Text: document.querySelector('h1')?.textContent,
    scrollWidth: document.documentElement.scrollWidth, innerWidth,
    minTextContrast: texts.reduce((m, t) => Math.min(m, t.ratio), 99), lowContrast: texts.filter((t) => t.ratio < 4.5),
    taps, smallTaps: taps.filter((t) => t.h < 44 || t.w < 44), clipped,
    face: hub?.querySelector('[data-testid="hub-face"]')?.getAttribute('data-face') ?? null,
    facts: !!hub?.querySelector('[data-testid="hub-facts"]'), nextEvent: hub?.querySelector('[data-testid="hub-next-event"]')?.getAttribute('href') ?? null,
    cards: [...(hub?.querySelectorAll('[data-testid="hub-role-card"]') ?? [])].map((c) => `${c.getAttribute('data-role')} -> ${c.getAttribute('href')}`),
    seams: hub ? { hubGround: getComputedStyle(hub).backgroundImage.slice(0, 120), header: getComputedStyle(header).backgroundColor, headerBorder: getComputedStyle(header).borderTopColor, card: card ? getComputedStyle(card).backgroundColor : null } : null,
    tabs: document.querySelectorAll('[role="tab"]').length,
  };
});
const reportPath = `${dir}report.json`;
const all = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8')) : {};
all[out] = { path, ...m, errors, hydrationWarnings: consoleWarn };
writeFileSync(reportPath, JSON.stringify(all, null, 1) + '\n');
console.log(out, JSON.stringify({ hub: m.hub, h1: m.h1, sw: m.scrollWidth, minC: m.minTextContrast, small: m.smallTaps.length, clipped: m.clipped, cards: m.cards, next: m.nextEvent, face: m.face, facts: m.facts, tabs: m.tabs, errors: errors.length, hyd: consoleWarn.length }));
await br.close();
