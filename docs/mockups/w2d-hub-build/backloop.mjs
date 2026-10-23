// Back-loop fix walk (W2-D step 2): one-role role pages have no bar and no loop; a two-role page's Back lands on the hub;
// the wall date chip fits at 360/390. Run against local dev on prod reads: node docs/mockups/w2d-hub-build/backloop.mjs docs/mockups/w2d-hub-build
import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:5199', OUT = process.argv[2];
const b = await chromium.launch(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } } : {});
const out = {};
const backOf = (p) => p.evaluate(() => {
  const bar = document.querySelector('[data-testid=role-switch-back]');
  const backs = [...document.querySelectorAll('a,button')].filter((x) => /^\s*Back/.test(x.textContent || '') && x.getBoundingClientRect().width);
  return { bar: bar ? { text: bar.textContent.trim(), href: bar.getAttribute('href') } : null, backs: backs.map((x) => ({ tag: x.tagName, text: x.textContent.trim().slice(0, 40), href: x.getAttribute('href') })) };
});
for (const [name, path] of [['dancer-one-role', '/dancers/unclaimed-00422bf9'], ['dj-one-role', '/djs/bobby-blanco'], ['two-role-dj', '/djs/11549aa4-599a-4be1-96e2-262f0696f9b1'], ['two-role-dancer', '/dancers/11549aa4-599a-4be1-96e2-262f0696f9b1']]) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto(`${BASE}/djs`, { waitUntil: 'networkidle' });
  await p.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  const landed = new URL(p.url()).pathname;
  const back = await backOf(p);
  await p.screenshot({ path: `${OUT}/${name}.png` });
  const target = back.bar ?? back.backs[0];
  let after = null, hub = null;
  if (target) {
    await p.locator(back.bar ? '[data-testid=role-switch-back]' : 'a:visible, button:visible', back.bar ? {} : { hasText: /^\s*Back/ }).first().click();
    await p.waitForTimeout(2500);
    after = new URL(p.url()).pathname;
    hub = !!(await p.$('[data-testid=person-hub]'));
    if (back.bar) await p.screenshot({ path: `${OUT}/${name}-after-back.png` });
  }
  out[name] = { landed, ...back, afterTap: after, onHub: hub, loops: after === landed };
  await p.close();
}
// Wall date chip fit at 360 / 390.
out.wall = {};
for (const w of [360, 390]) {
  const p = await b.newPage({ viewport: { width: w, height: 844 } });
  await p.goto(`${BASE}/djs`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  out.wall[w] = await p.evaluate(() => [...document.querySelectorAll('[data-testid=date-chip]')].map((c) => {
    const t = c.closest('[data-testid=wall-tile]').getBoundingClientRect(), r = c.getBoundingClientRect();
    return { text: c.textContent, chipW: Math.round(r.width), chipH: Math.round(r.height), tileW: Math.round(t.width), overflowRight: Math.round(r.right - t.right) };
  }));
  await p.screenshot({ path: `${OUT}/wall-djs-${w}.png` });
  await p.close();
}
await b.close();
console.log(JSON.stringify(out, null, 1));
