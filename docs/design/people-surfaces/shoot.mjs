// Throwaway: 390x844 full-page shots of the production build. Usage: node shoot.mjs <jobs.json>
// jobs: [{name, path}] ; writes shots/<name>.png and results.json (status, final url, title, h1, text length)
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const jobs = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const base = 'http://127.0.0.1:3111';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const out = [];
for (const j of jobs) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
  let status = 0;
  try {
    const r = await p.goto(base + j.path, { waitUntil: 'networkidle', timeout: 45000 });
    status = r?.status() ?? 0;
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `shots/${j.name}.png`, fullPage: true });
    const info = await p.evaluate(() => ({ title: document.title, h1: document.querySelector('h1')?.textContent?.trim().slice(0, 80) ?? null, text: document.body.innerText.slice(0, 6000), links: [...document.querySelectorAll('main a[href], a[href]')].map((a) => a.getAttribute('href')).filter((h) => h && /^\/(dancers|djs|teachers|organisers|people|videographers|festival|event)/.test(h)).slice(0, 80) }));
    out.push({ ...j, status, url: p.url().replace(base, ''), errs, ...info });
  } catch (e) {
    out.push({ ...j, status, error: String(e).slice(0, 200) });
  }
  await ctx.close();
}
writeFileSync(`results-${process.argv[3] ?? 'run'}.json`, JSON.stringify(out, null, 1));
await b.close();
console.log(out.map((o) => `${o.name} ${o.status} ${o.url ?? ''} ${o.h1 ?? ''} ${o.error ?? ''}`).join('\n'));
