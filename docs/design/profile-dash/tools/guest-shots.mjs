// Screenshots + mechanical checks for the organiser GUEST LIST options A/B (adapted from docs/design/organiser-dashboard/tools/check-shots.mjs).
// Usage: node docs/design/profile-dash/tools/guest-shots.mjs
// Each option HTML shows ONE state when opened with #<state>. For every
// option x state it takes a 390x844 first-screen shot and a full-page shot,
// and checks: tap targets >= 44x44 CSS px, text contrast >= 4.5:1,
// no sideways scroll at 390px, no clipped text, and (list states) the last
// item fully clears the tab bar when scrolled to the end.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const OPTIONS = ['organiser-guest-list-option-a', 'organiser-guest-list-option-b'];
const STATES = ['entry', 'entrysheet', 'off', 'empty', 'normal', 'huge', 'full', 'closed', 'door', 'past', 'cancelled', 'contributor', 'loading', 'error', 'teamonly', 'dancer', 'dancerin', 'dancer&v=team', 'normal&sheet=add', 'normal&sheet=person&of=3', 'normal&sheet=remove&of=0', 'normal&sheet=settings', 'normal&sheet=link', 'door&sheet=qr', 'huge&q=ana', 'normal&view=settings', 'huge&q=zzz'];
// States that must offer a way forward (an enabled button in the frame other than Back / tabs).
const ACTIONABLE = ['off', 'empty', 'loading', 'error', 'huge&q=zzz', 'full', 'closed', 'cancelled', 'past', 'contributor'];
const shotDir = resolve(root, 'shots');
const slug = (s) => s.replace(/&of=(\d+)/, '$1').replace(/&sheet=/, '-').replace(/&v=/, '-').replace(/&q=/, '-q-').replace(/&view=/, '-view-');
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
    await page.waitForTimeout(150);
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
      // Every disabled control must say why: its own sub-line, or a reason (.why / .banner) in the same screen or sheet.
      const silent = [];
      for (const el of document.querySelectorAll('#frame button[disabled], #frame input[disabled]')) {
        const own = el.querySelector('.t span');
        const box = el.closest('.sheet') || el.closest('.scroll');
        if (!(own && own.textContent.trim()) && !(box && box.querySelector('.why,.banner'))) silent.push(`${el.tagName.toLowerCase()} "${el.textContent.trim().slice(0, 30)}"`);
      }
      const ways = [...document.querySelectorAll('#scroll button:not([disabled]):not(.back), #scroll .btn:not([disabled])')].length;
      const back = document.querySelectorAll('#scroll .back').length;
      return {
        silent, ways, back,
        sideways: document.documentElement.scrollWidth > 390,
        scrollWidth: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        taps, contrast, minContrast: +minC.toFixed(2), textNodes, clipped: clipped.slice(0, 10),
      };
    });
    await page.screenshot({ path: resolve(shotDir, `${opt}-${slug(st)}.png`) });
    // Scroll the list to its end: the last item must sit fully above the tab bar
    // (nothing floats over rows, and the padding lets the last row clear the tabs).
    if (!st.includes('sheet=')) {
      r.endCovered = await page.evaluate(() => {
        const sc = document.getElementById('scroll'); if (!sc) return [];
        sc.scrollTop = sc.scrollHeight;
        const box = sc.getBoundingClientRect(), tb = document.querySelector('.tabs'), nav = tb ? tb.getBoundingClientRect() : { top: document.getElementById('frame').getBoundingClientRect().bottom };
        const last = sc.lastElementChild.getBoundingClientRect(), out = [];
        if (box.bottom > nav.top + 0.5) out.push(`list runs under tabs by ${Math.round(box.bottom - nav.top)}px`);
        if (last.bottom > Math.min(box.bottom, nav.top) + 0.5) out.push(`last item cut by ${Math.round(last.bottom - Math.min(box.bottom, nav.top))}px`);
        return out;
      });
      if (['normal', 'huge', 'door', 'past', 'contributor', 'full', 'teamonly'].includes(st)) await page.screenshot({ path: resolve(shotDir, `${opt}-${slug(st)}-end.png`) });
      r.clipped.push(...r.endCovered);
    }
    if (r.silent.length) r.clipped.push(...r.silent.map((x) => `disabled without a reason: ${x}`));
    // Loading is allowed to offer only Back plus its reason (Add is disabled until the names load).
    if (ACTIONABLE.includes(st) && !(r.ways || (st === 'loading' && r.back))) r.clipped.push('state offers no way forward');
    results.push({ option: opt, state: st, ...r });
    const ok = !r.sideways && !r.taps.length && !r.contrast.length && !r.clipped.length;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${opt} ${st} h=${r.height} minContrast=${r.minContrast} taps<44=${r.taps.length} lowContrast=${r.contrast.length} clipped=${r.clipped.length} sideways=${r.sideways}`);
    if (!ok) console.log('  ', JSON.stringify({ taps: r.taps.slice(0, 5), contrast: r.contrast.slice(0, 5), clipped: r.clipped.slice(0, 5) }));
  }
}
writeFileSync(resolve(root, 'organiser-guest-list-checks.json'), JSON.stringify(results, null, 2) + '\n');
await browser.close();
const fails = results.filter((r) => r.sideways || r.taps.length || r.contrast.length || r.clipped.length);
console.log(`${results.length - fails.length}/${results.length} option-states pass`);
process.exit(fails.length ? 1 : 0);
