// People arc P0 audit: walk the journeys by tapping, record each hop's URL. Read-only.
//   node docs/people-arc/audit/journeys.mjs   (same two local servers as capture.mjs)
import { chromium } from 'playwright';
import fs from 'node:fs';
const OUT = 'docs/people-arc/audit';
const BUILDS = { main: 'http://127.0.0.1:5201', hub: 'http://127.0.0.1:5202' };
const BACK = '[data-testid=role-switch-back], [data-testid=hub-back], main a:has-text("Back"), main button:has-text("Back"), header a[aria-label*="ack"], header button[aria-label*="ack"]';
const SLUG = { 'all3-claimed-rich': 'ramiro-zapata', 'dancer-dj-gig': 'elias', 'all3-gig4': 'jeff', 'dj-gig-nophoto': 'bobby-blanco' };
const id = (s) => JSON.parse(fs.readFileSync(`${OUT}/shapes.json`, 'utf8')).find((x) => x.shape === s).id + (SLUG[s] ? `|${SLUG[s]}` : '');
const J = [
  { build: 'hub', name: 'dancers-wall > rich all-three person', start: '/dancers', steps: [`tile:${id('all3-claimed-rich')}`, 'sel:[data-testid=hub-cta]', 'sel:[data-testid=role-pill]:not([aria-current])', 'back-ui', 'back-ui', 'back-ui', 'browser-back', 'browser-back'] },
  { build: 'hub', name: 'djs-wall > one-role DJ', start: '/djs', steps: [`tile:${id('dj-gig-nophoto')}`, 'back-ui', 'browser-back'] },
  { build: 'hub', name: 'dancers-wall > dancer+dj, hub card', start: '/dancers', steps: [`tile:${id('dancer-dj-gig')}`, 'sel:[data-testid=hub-also-card]', 'back-ui', 'back-ui', 'browser-back'] },
  { build: 'hub', name: 'teachers-wall > first tile', start: '/teachers', steps: ['sel:[data-testid=wall-tile][href]', 'sel:[data-testid=hub-cta]', 'back-ui', 'back-ui'] },
  { build: 'hub', name: 'wall > Organisers link', start: '/dancers', steps: ['sel:[data-testid=wall-organisers]', 'browser-back'] },
  { build: 'hub', name: 'direct hub link, one-role dancer', start: `/people/${id('dancer-photo').split('|')[0]}`, steps: ['back-ui', 'browser-back'] },
  { build: 'main', name: 'djs list > all-three person', start: '/djs', steps: [`tile:${id('all3-gig4')}`, 'back-ui', 'browser-back'] },
  { build: 'main', name: 'dancers list > all-three person', start: '/dancers', steps: [`tile:${id('all3-gig4')}`, 'back-ui', 'browser-back'] },
  { build: 'main', name: 'dancers list > dancer+dj, cross link', start: '/dancers', steps: [`tile:${id('dancer-dj-gig')}`, 'sel:main a[href^="/djs/"]', 'back-ui', 'browser-back'] },
  { build: 'main', name: 'direct /people link (flag off)', start: `/people/${id('all3-gig4').split('|')[0]}`, steps: [] },
];
const b = await chromium.launch(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } } : {});
const out = [];
for (const j of J) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const base = BUILDS[j.build];
  await p.goto(base + j.start, { waitUntil: 'networkidle' }).catch(() => {});
  await p.waitForTimeout(1500);
  const hops = [{ action: 'open', url: new URL(p.url()).pathname + new URL(p.url()).hash }];
  for (const s of j.steps) {
    let label = s, ok = true;
    try {
      if (s === 'browser-back') await p.goBack({ waitUntil: 'networkidle', timeout: 15000 });
      else {
        const sel = s.startsWith('tile:') ? s.slice(5).split('|').map((k) => `main a[href$="/${k}"]`).join(', ') : s === 'back-ui' ? BACK : s.slice(4);
        const el = p.locator(sel).filter({ visible: true }).first();
        if (!(await el.count())) { ok = false; label += ' (NOT ON SCREEN)'; }
        else { label += ` -> "${((await el.innerText().catch(() => '')) || (await el.getAttribute('aria-label')) || '').trim().replace(/\s+/g, ' ').slice(0, 40)}" href=${await el.getAttribute('href')}`; await el.scrollIntoViewIfNeeded(); await el.click(); await p.waitForLoadState('networkidle').catch(() => {}); }
      }
    } catch (e) { ok = false; label += ` (ERROR ${String(e).slice(0, 60)})`; }
    await p.waitForTimeout(1200);
    const u = new URL(p.url());
    hops.push({ action: label, ok, url: u.pathname + u.hash, h1: (await p.locator('h1').first().innerText().catch(() => '')).slice(0, 40) });
  }
  out.push({ ...j, hops });
  await p.close();
}
fs.writeFileSync(`${OUT}/journeys.json`, JSON.stringify(out, null, 1));
await b.close();
for (const j of out) { console.log(`\n## ${j.build}: ${j.name}`); for (const h of j.hops) console.log(` ${h.ok === false ? 'X' : '-'} ${h.action}  =>  ${h.url}  [${h.h1}]`); }
