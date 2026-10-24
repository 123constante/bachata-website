import { chromium } from 'playwright';
const BASE = 'http://localhost:4173';
const OUT = '/home/user/bachata-website/docs/people-arc/s4/shots';
const SLUGS = (process.env.SLUGS || 'melita-somos,nadina-toso,ramiro-zapata,llf-malva-marina-montenegro,magda-sobolewska,unclaimed-645cb1ef,viola-palmai,nico,llf-enoch-lopez').split(',');
const SIZES = process.env.SIZES ? JSON.parse(process.env.SIZES) : [[390, 844], [360, 800]];
const browser = await chromium.launch();
const results = [];
if (!process.env.BACKONLY) for (const slug of SLUGS) for (const [w, h] of SIZES) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}/teachers/${slug}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="teacher-world"]', { timeout: 20000 });
  await page.waitForFunction(() => !document.querySelector('[data-testid="teacher-classes-loading"]'), null, { timeout: 20000 });
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    const hex = (c) => { const m = c.match(/[\d.]+/g); return m ? m.slice(0, 3).map(Number) : null; };
    const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const stops = (img) => (img.match(/rgba?\([^)]+\)/g) || []).map(hex);
    const bgsOf = (el) => { for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.backgroundImage !== 'none' && stops(s.backgroundImage).length) return stops(s.backgroundImage); const c = s.backgroundColor; if (c && !c.endsWith(', 0)') && c !== 'transparent') return [hex(c)]; } return [[21, 16, 42]]; };
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
      name: t('teacher-name'), lines: [...document.querySelectorAll('[data-testid=teacher-line]')].map((e) => e.textContent), flag: !!t('teacher-flag') || !!document.querySelector('[data-testid=teacher-flag]'),
      classes: document.querySelectorAll('[data-testid="teacher-class"]').length, heading: document.querySelector('[data-testid=teacher-classes] h2')?.textContent ?? null,
      empty: t('teacher-empty-action'), note: t('teacher-empty-note'), contact: t('teacher-contact'),
      // S3b: the frame box (must match on every shape and world) and the gap from the content to the footer.
      back: (() => { const b = document.querySelector('[data-testid="frame-back"]').getBoundingClientRect(); return `L${Math.round(b.left)} T${Math.round(b.top + scrollY)}`; })(),
      barW: Math.round(document.querySelector('[data-testid="frame-back"]').parentElement.getBoundingClientRect().width),
      footerGap: (() => { const f = document.querySelector('footer'); const w = document.querySelector('[data-testid="world-page"]'); return f && w ? Math.round(f.getBoundingClientRect().top - w.getBoundingClientRect().bottom) : null; })(), invite: !!t('teacher-invite'), tabs: tabs ? [...tabs.querySelectorAll('a')].map((a) => a.textContent).join('/') : null,
      tabsY: tabs ? Math.round(tabs.getBoundingClientRect().top + scrollY) : null, photo: document.querySelector('[data-testid="person-avatar"]')?.getAttribute('data-photo'),
    };
  });
  await page.screenshot({ path: `${OUT}/${slug}-${w}.png`, fullPage: true });
  results.push({ slug, w, ...r, errors: errors.length });
  await page.close();
}
console.log(JSON.stringify(results, null, 1)); await browser.close();
