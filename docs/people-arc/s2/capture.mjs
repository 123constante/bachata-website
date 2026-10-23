// People arc S2: screenshots of /dancers/:id with flags.personWorlds ON, on prod data, at 390x844 and
// 360x800, plus the Design Gate 4 self-checks on the rendered DOM. Needs a build served locally:
//   VITE_ENABLE_PERSON_WORLDS=true npm run build && node scripts/_serve-build.mjs --port 4173
//   node docs/people-arc/s2/capture.mjs
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const shots = join(dir, 'shots');
mkdirSync(shots, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:4173';

/** One real public profile per shape (survey 2026-10-23; picked by shape, not by person). */
export const SHAPES = [
  ['thin', 'carol-y-raul', 'no photo, no city, no languages, no dance role; teacher with a far-off class (February) -> preview'],
  ['photo-city-role', 'leoncio', 'photo, London, dance role, dancer only -> London socials'],
  ['langs-nat', 'chloe-poyiatz', 'languages + nationality flag'],
  ['long-name', 'llf-malva-marina-montenegro', 'long name'],
  ['one-name', 'alfredo-andrea', 'one name, photo'],
  ['socials', 'unclaimed-8395fee2', 'instagram contact'],
  ['madrid-nameless', 'aitor-angelica-tbf', 'no first name (display name set), Madrid -> Madrid empty state (only a festival there this week)'],
  ['teacher-dated', 'alex-boneva', 'teacher with an upcoming class -> preview'],
  ['teacher-undated', 'aurora', 'teacher without a date -> socials'],
  ['dj-dated', 'elias', 'DJ with an upcoming gig -> preview'],
  ['bio', 'unclaimed-797fab23', 'has a bio (not shown: the reference has no place for it)'],
];
const SIZES = [[390, 844], [360, 800]];

function audit() {
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(',').map((x) => parseFloat(x)); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const groundsOf = (el) => {
    for (let e = el; e; e = e.parentElement) {
      if (e.dataset.photo === 'photo') return null;
      const s = getComputedStyle(e); const out = [];
      const c = parse(s.backgroundColor); if (c && c.a > 0.99) out.push(c);
      if (s.backgroundImage !== 'none') for (const m of s.backgroundImage.matchAll(/rgba?\([^)]+\)|#[0-9a-fA-F]{6}/g)) { const g = m[0].startsWith('#') ? { r: parseInt(m[0].slice(1, 3), 16), g: parseInt(m[0].slice(3, 5), 16), b: parseInt(m[0].slice(5, 7), 16), a: 1 } : parse(m[0]); if (g && g.a > 0.99) out.push(g); }
      if (out.length) return out;
    }
    return [{ r: 255, g: 255, b: 255, a: 1 }];
  };
  const root = document.querySelector('[data-testid="dancer-world-page"]');
  if (!root) return { error: 'no dancer world on the page' };
  let low = 99; let lowText = '';
  for (const el of root.querySelectorAll('*')) {
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own || el.closest('[aria-hidden="true"]')) continue;
    const fg = parse(getComputedStyle(el).color); const gs = groundsOf(el); if (!fg || !gs) continue;
    for (const g of gs) { const [a, b] = [lum(fg), lum(g)].sort((x, y) => y - x); const r = (a + 0.05) / (b + 0.05); if (r < low) { low = r; lowText = el.textContent.trim().slice(0, 40); } }
  }
  const smallTaps = [...root.querySelectorAll('a,button')].filter((el) => el.getBoundingClientRect().height < 44).map((el) => el.textContent.trim().slice(0, 30));
  const clipped = [...root.querySelectorAll('h1,h2,h3,p,b,small,span')].filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible').map((el) => el.textContent.trim().slice(0, 30));
  const sideways = document.documentElement.scrollWidth > window.innerWidth;
  const tabs = document.querySelector('[data-testid="role-tabs"]');
  return {
    contrast: Math.round(low * 100) / 100, lowText, smallTaps, clipped, sideways,
    tabsTop: tabs ? Math.round(tabs.getBoundingClientRect().top + window.scrollY) : null,
    lower: root.querySelector('[data-testid="dancer-world-lower"]')?.getAttribute('data-kind') ?? null,
    socials: root.querySelector('[data-testid="dancer-world-socials"]')?.getAttribute('data-state') ?? null,
    invite: !!root.querySelector('[data-testid="dancer-world-invite-button"]'),
    text: root.innerText.replace(/\s+/g, ' ').slice(0, 400),
  };
}

const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } : undefined;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, proxy });
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const results = [];
for (const [key, slug, label] of SHAPES.filter(([k]) => !only || only.includes(k))) {
  for (const [w, hgt] of SIZES) {
    const page = await browser.newPage({ viewport: { width: w, height: hgt }, deviceScaleFactor: 1 });
    await page.goto(`${BASE}/dancers/${slug}`, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
    await page.waitForFunction(() => {
      const l = document.querySelector('[data-testid="dancer-world-lower"]');
      const s = document.querySelector('[data-testid="dancer-world-socials"]');
      return l && l.getAttribute('data-kind') !== 'loading' && (!s || s.getAttribute('data-state') !== 'loading');
    }, null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(400);
    const file = `${key}-${w}.png`;
    await page.screenshot({ path: join(shots, file), fullPage: true });
    results.push({ key, slug, label, size: `${w}x${hgt}`, file, ...(await page.evaluate(audit)) });
    await page.close();
  }
}
await browser.close();
writeFileSync(join(dir, 'checks.json'), `${JSON.stringify(results, null, 2)}\n`);
for (const r of results) console.log(r.file, r.error ?? `contrast=${r.contrast} taps<44=${r.smallTaps.length} clipped=${r.clipped.length} sideways=${r.sideways} lower=${r.lower}/${r.socials} invite=${r.invite} tabsTop=${r.tabsTop}`);
