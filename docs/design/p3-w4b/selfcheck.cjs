// Stage-4 preview self-check for the W4b mockups. Run: node docs/design/p3-w4b/selfcheck.cjs
// Renders each file at 390x844 (light and dark) and reports: the lowest text contrast,
// controls under 44x44, and horizontal overflow. Exit 1 on any failure.
const path = require('path');
const { chromium } = require('playwright');

const FILES = ['new-account-A.html', 'new-account-B.html', 'no-city-A.html', 'no-city-B.html', 'index.html'];

async function audit(page) {
  return page.evaluate(() => {
    const rgba = (s) => { const m = s.match(/[\d.]+/g) || []; return m.map(Number).concat([1]).slice(0, 4); };
    const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const blend = (top, under) => { const a = top[3]; return [0, 1, 2].map((i) => top[i] * a + under[i] * (1 - a)).concat([1]); };
    // Effective background: blend every painted ancestor from the root down.
    const bgOf = (el) => {
      const chain = []; for (let e = el; e; e = e.parentElement) chain.unshift(e);
      let c = [255, 255, 255, 1];
      for (const e of chain) { const b = rgba(getComputedStyle(e).backgroundColor); if (b[3] > 0) c = blend(b, c); }
      // A scrim drawn as a sibling under a sheet does not paint the sheet; it is opaque.
      return c;
    };
    let minC = 99, worst = '', texts = 0;
    for (const el of document.querySelectorAll('body *')) {
      if (['STYLE', 'SCRIPT', 'IFRAME'].includes(el.tagName)) continue;
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own) continue;
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
      // Text under a scrim is the dimmed page behind a sheet: not read, not counted.
      if (el.closest('.ph') && !el.closest('.sheet') && el.closest('.ph').querySelector('.scrim')) continue;
      texts++;
      const fg = blend(rgba(getComputedStyle(el).color), bgOf(el));
      const L1 = lum(fg), L2 = lum(bgOf(el));
      const c = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      if (c < minC) { minC = c; worst = el.textContent.trim().slice(0, 40); }
    }
    const small = [];
    let controls = 0;
    for (const el of document.querySelectorAll('button, a, input, label.chk, .field')) {
      if (el.closest('.ph') && !el.closest('.sheet') && el.closest('.ph').querySelector('.scrim')) continue;
      const r = el.getBoundingClientRect(); if (!r.width) continue;
      controls++;
      const box = el.tagName === 'INPUT' ? el.closest('label').getBoundingClientRect() : r;
      if (box.height < 44 || box.width < 44) small.push(`${el.tagName}:${(el.textContent || el.type).trim().slice(0, 24)} ${Math.round(box.width)}x${Math.round(box.height)}`);
    }
    // A frame whose content runs past 844px would hide a control below the fold.
    const cut = [...document.querySelectorAll('.ph')].filter((e) => e.scrollHeight > e.clientHeight).length;
    return { texts, minContrast: Math.round(minC * 100) / 100, worst, controls, small, cut, scrollWidth: document.documentElement.scrollWidth };
  });
}

(async () => {
  const browser = await chromium.launch();
  let fail = false;
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme });
    const page = await ctx.newPage();
    for (const f of FILES) {
      await page.goto('file://' + path.join(__dirname, f));
      const r = await audit(page);
      const ok = r.minContrast >= 4.5 && r.small.length === 0 && r.cut === 0 && r.scrollWidth <= 390;
      if (!ok) fail = true;
      console.log(`${ok ? 'PASS' : 'FAIL'} ${scheme.padEnd(5)} ${f.padEnd(20)} texts=${r.texts} minContrast=${r.minContrast} ("${r.worst}") controls=${r.controls} under44=${r.small.length} cutFrames=${r.cut} scrollWidth=${r.scrollWidth}`);
      if (r.small.length) console.log('   ', r.small.slice(0, 8).join(' | '));
    }
    await ctx.close();
  }
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
