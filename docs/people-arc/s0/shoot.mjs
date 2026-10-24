// S0 screenshots: /djs and /dancers on a local prod build reading prod (read-only), wall flag ON.
// node docs/people-arc/s0/shoot.mjs  (server: scripts/_serve-build.mjs --port 5199)
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const BASE = 'http://127.0.0.1:5199';
const OUT = 'docs/people-arc/s0';
const b = await chromium.launch(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } } : {});
const report = {};
for (const path of ['djs', 'dancers']) {
  for (const [w, h] of [[360, 800], [390, 844]]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await p.goto(`${BASE}/${path}`, { waitUntil: 'networkidle', timeout: 90000 });
    await p.waitForSelector('[data-testid=wall-tile]', { timeout: 60000 });
    await p.waitForTimeout(1500);
    report[`${path}-${w}`] = await p.evaluate(() => {
      const tiles = [...document.querySelectorAll('[data-testid=wall-tile]')];
      const dates = [...document.querySelectorAll('[data-testid=tile-date]')];
      const clipped = [];
      for (const t of tiles) for (const el of t.querySelectorAll('[data-testid=tile-name],[data-testid=tile-date]'))
        if (el.scrollWidth > el.clientWidth + 1) clipped.push(el.textContent.trim());
      const longest = tiles.map((t) => t.querySelector('[data-testid=tile-name]')?.textContent ?? '').sort((a, b) => b.length - a.length)[0];
      return {
        tiles: tiles.length,
        dates: dates.length,
        dateSamples: dates.slice(0, 3).map((d) => d.textContent.trim()),
        dateOnFace: dates.filter((d) => d.closest('[data-testid=wall-face]') || d.parentElement.querySelector(':scope > [data-testid=wall-face]')).length,
        dateRows: dates.map((d) => Math.round(d.getBoundingClientRect().height / 13)),
        clipped,
        longestName: longest,
        sideways: document.documentElement.scrollWidth > innerWidth,
      };
    });
    const wall = await p.$('[data-testid=wall-root]');
    await wall.scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${OUT}/${path}-${w}x${h}.png` });
    await p.close();
  }
}
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 1));
await b.close();
