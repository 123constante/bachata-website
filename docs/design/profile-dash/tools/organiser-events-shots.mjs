// Screenshots + mechanical checks for the organiser EVENTS tab, Option A (the owner's pick, 2026-11-12).
// Usage: node docs/design/profile-dash/tools/organiser-events-shots.mjs
// Option B was not picked: organiser-events-option-b.html is frozen at its first-round state and is no longer
// rebuilt (its fragment tools/organiser-events-b-layout.html stays for the record). Its first-round checks are in git history.
// The HTML shows ONE state when opened with #<state>. For every state it takes a 390x844 first-screen shot
// and checks: tap targets >= 44x44 CSS px, text contrast >= 4.5:1, no sideways scroll at 390px, no clipped text,
// and the pinned "needs you" strip is 48px tall or less.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const OPTIONS = ['organiser-events-option-a'];
const STATES = ['empty', 'three', 'huge', 'series', 'hugeflat', 'allcx', 'mixed', 'needs', 'draft', 'told', 'deldraft', 'cxnight', 'pastnight',
  'recurring', 'cancelrec', 'bulk', 'bulkcancel', 'cancel', 'aftercancel', 'contributor', 'contribneeds', 'loading', 'error'];
const shotDir = resolve(root, 'shots');
const slug = (s) => s;
mkdirSync(shotDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const results = [];

for (const opt of OPTIONS) {
  for (const st of STATES) {
    const url = pathToFileURL(resolve(root, `${opt}.html`)).href + '#' + st + '&shot';
    await page.goto('about:blank');
    await page.goto(url);
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
      const parse = (c) => {
        const m = c.match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
        return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
      };
      const lum = ({ r, g, b }) => {
        const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const bgOf = (el) => {
        // composite backgrounds from the element up to the root
        const stack = [];
        for (let e = el; e; e = e.parentElement) {
          const c = parse(getComputedStyle(e).backgroundColor);
          if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break; }
        }
        let out = { r: 255, g: 255, b: 255 };
        for (let i = stack.length - 1; i >= 0; i--) {
          const c = stack[i];
          out = { r: c.r * c.a + out.r * (1 - c.a), g: c.g * c.a + out.g * (1 - c.a), b: c.b * c.a + out.b * (1 - c.a) };
        }
        return out;
      };
      const visible = (el) => {
        const s = getComputedStyle(el); const b = el.getBoundingClientRect();
        return s.display !== 'none' && s.visibility !== 'hidden' && b.width > 0 && b.height > 0;
      };
      const taps = [];
      for (const el of document.querySelectorAll('a,button,[role=button],summary,input,select')) {
        if (!visible(el)) continue;
        const b = el.getBoundingClientRect();
        if (b.width < 44 || b.height < 44) taps.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}" ${Math.round(b.width)}x${Math.round(b.height)}`);
      }
      const contrast = []; let minC = 99; let textNodes = 0;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const seen = new Set();
      while (walker.nextNode()) {
        const n = walker.currentNode; if (!n.textContent.trim()) continue;
        const el = n.parentElement; if (seen.has(el) || !visible(el)) continue; seen.add(el); textNodes++;
        const fg = parse(getComputedStyle(el).color); const bg = bgOf(el);
        const L1 = lum(fg), L2 = lum(bg);
        const c = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
        minC = Math.min(minC, c);
        if (c < 4.5) contrast.push(`"${n.textContent.trim().slice(0, 30)}" ${c.toFixed(2)}`);
      }
      const clipped = [];
      for (const el of document.querySelectorAll('body *')) {
        if (!visible(el) || el.tagName === 'svg' || el.closest('svg')) continue;
        if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible' && el.textContent.trim())
          clipped.push(`${el.tagName.toLowerCase()}.${el.className} "${el.textContent.trim().slice(0, 30)}"`);
        const b = el.getBoundingClientRect();
        if (b.right > 390.5 || b.left < -0.5) clipped.push(`offscreen ${el.tagName.toLowerCase()}.${el.className} ${Math.round(b.left)}..${Math.round(b.right)}`);
      }
      return {
        sideways: document.documentElement.scrollWidth > 390,
        scrollWidth: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        pinnedH: document.querySelector('.needs') ? Math.round(document.querySelector('.needs').getBoundingClientRect().height) : 0,
        taps, contrast, minContrast: +minC.toFixed(2), textNodes, clipped: clipped.slice(0, 10),
      };
    });
    await page.screenshot({ path: resolve(shotDir, `${opt}-${slug(st)}.png`) });
    results.push({ option: opt, state: st, ...r });
    const ok = r.textNodes > 8 && r.pinnedH <= 48 && !r.sideways && !r.taps.length && !r.contrast.length && !r.clipped.length;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${opt} ${st} pinned=${r.pinnedH} h=${r.height} minContrast=${r.minContrast} taps<44=${r.taps.length} lowContrast=${r.contrast.length} clipped=${r.clipped.length} sideways=${r.sideways}`);
    if (!ok) console.log('  ', JSON.stringify({ taps: r.taps.slice(0, 5), contrast: r.contrast.slice(0, 5), clipped: r.clipped.slice(0, 5) }));
  }
}
writeFileSync(resolve(root, 'organiser-events-checks.json'), JSON.stringify(results, null, 2) + '\n');
await browser.close();
const fails = results.filter((r) => r.textNodes <= 8 || r.pinnedH > 48 || r.sideways || r.taps.length || r.contrast.length || r.clipped.length);
console.log(`${results.length - fails.length}/${results.length} states pass`);
process.exit(fails.length ? 1 : 0);
