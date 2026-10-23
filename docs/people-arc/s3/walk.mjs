import { chromium } from 'playwright';
const BASE = 'http://localhost:4173';
const OUT = '/home/user/bachata-website/docs/people-arc/s3/shots';
const SLUGS = (process.env.SLUGS || 'papacito,jeff,brito,chong,carlos-de-la-cruz,dj-chino-bzuk26,bobby-blanco').split(',');
const SIZES = process.env.SIZES ? JSON.parse(process.env.SIZES) : [[390, 844], [360, 800]];
const browser = await chromium.launch();
const results = [];
if (!process.env.BACKONLY) for (const slug of SLUGS) for (const [w, h] of SIZES) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}/djs/${slug}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="dj-world"]', { timeout: 20000 });
  await page.waitForFunction(() => !document.querySelector('[data-testid="dj-dates-loading"]'), null, { timeout: 20000 });
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    const hex = (c) => { const m = c.match(/[\d.]+/g); return m ? m.slice(0, 3).map(Number) : null; };
    const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const stops = (img) => (img.match(/rgba?\([^)]+\)/g) || []).map(hex);
    const bgsOf = (el) => { for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.backgroundImage !== 'none' && stops(s.backgroundImage).length) return stops(s.backgroundImage); const c = s.backgroundColor; if (c && !c.endsWith(', 0)') && c !== 'transparent') return [hex(c)]; } return [[14, 11, 10]]; };
    const root = document.querySelector('[data-testid="person-frame"]');
    let worst = 99, worstText = '';
    for (const el of root.querySelectorAll('*')) {
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own) continue;
      const fg = hex(getComputedStyle(el).color);
      for (const bg of bgsOf(el)) { const c = ratio(fg, bg); if (c < worst) { worst = c; worstText = el.textContent.trim().slice(0, 30); } }
    }
    const small = [...root.querySelectorAll('a,button')].filter((e) => { const b = e.getBoundingClientRect(); return b.height < 44 || b.width < 44; }).map((e) => e.textContent.trim().slice(0, 20));
    const clipped = [...root.querySelectorAll('*')].filter((e) => { const s = getComputedStyle(e); return e.scrollWidth > e.clientWidth + 1 && s.overflowX !== 'visible' && !s.textOverflow.includes('ellipsis') && e.clientWidth > 0; }).map((e) => e.getAttribute('data-testid') || e.tagName);
    const t = (id) => document.querySelector(`[data-testid="${id}"]`)?.textContent ?? null;
    const tabs = document.querySelector('[data-testid="role-tabs"]');
    return {
      sideways: document.documentElement.scrollWidth > window.innerWidth,
      worst: Math.round(worst * 100) / 100, worstText, small, clipped,
      name: t('dj-name'), real: t('dj-real-name'), count: t('dj-count'),
      gigs: document.querySelectorAll('[data-testid="dj-gig"]').length, records: document.querySelectorAll('[data-testid="dj-record"]').length,
      empty: t('dj-empty-action'), note: t('dj-empty-note'),
      // S3b: the frame box (must match on every shape and world) and the gap from the content to the footer.
      back: (() => { const b = document.querySelector('[data-testid="frame-back"]').getBoundingClientRect(); return `L${Math.round(b.left)} T${Math.round(b.top + scrollY)}`; })(),
      barW: Math.round(document.querySelector('[data-testid="frame-back"]').parentElement.getBoundingClientRect().width),
      footerGap: (() => { const f = document.querySelector('footer'); const w = document.querySelector('[data-testid="world-page"]'); return f && w ? Math.round(f.getBoundingClientRect().top - w.getBoundingClientRect().bottom) : null; })(), invite: !!t('dj-invite'), book: !!t('dj-book'), tabs: tabs ? [...tabs.querySelectorAll('a')].map((a) => a.textContent).join('/') : null,
      tabsY: tabs ? Math.round(tabs.getBoundingClientRect().top + scrollY) : null, photo: document.querySelector('[data-testid="person-avatar"]')?.getAttribute('data-photo'),
    };
  });
  await page.screenshot({ path: `${OUT}/${slug}-${w}.png`, fullPage: true });
  results.push({ slug, w, ...r, errors: errors.length });
  await page.close();
}
if (process.env.SHOTSONLY) { console.log(JSON.stringify(results)); await browser.close(); process.exit(0); }
// Back rule, real browser: direct open -> /djs; arrived from another page -> that page.
const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
await p.goto(`${BASE}/djs/papacito`, { waitUntil: 'networkidle' });
await p.click('[data-testid="frame-back"]'); await p.waitForURL('**/djs'); const direct = new URL(p.url()).pathname;
await p.goto(`${BASE}/djs/ramiro-zapata`, { waitUntil: 'networkidle' });
await p.click('[data-testid="dj-gig"] >> nth=0'); await p.waitForURL('**/event/**'); const from = new URL(p.url()).pathname;
await p.goBack(); await p.waitForSelector('[data-testid="frame-back"]');
await p.goto(`${BASE}/djs/ramiro-zapata`, { waitUntil: 'networkidle' });
await p.waitForTimeout(2500); await p.click('[data-testid="role-tab"][data-role="dancer"]'); await p.waitForURL('**/dancers/**');
const dancerPath = new URL(p.url()).pathname;
const djLink = p.locator('a[href="/djs/ramiro-zapata"]').first();
let viaSite = 'no DJ link on the dancer page';
await p.waitForTimeout(2500); if (await djLink.count()) { await djLink.click(); await p.waitForURL('**/djs/ramiro-zapata'); await p.waitForSelector('[data-testid="frame-back"]'); await p.click('[data-testid="frame-back"]'); await p.waitForURL('**/dancers/**'); viaSite = `${dancerPath} -> DJ -> Back -> ${new URL(p.url()).pathname}`; }
console.log(JSON.stringify({ results, back: { direct, gigOpened: from, viaSite } }, null, 1));
await browser.close();
