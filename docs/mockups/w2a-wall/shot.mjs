// Walk script: node docs/mockups/w2a-wall/shot.mjs <baseUrl> <outPrefix> [off]
// Production build, 390x844. Photos on media.bachatacalendar.co.uk are unreachable from the sandbox,
// so photo tiles fall back to initials here; real photo crops are NOT verified.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const [base, out, mode] = process.argv.slice(2);
const dir = new URL('.', import.meta.url).pathname;
const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const report = {};
async function measure(name) {
  report[name] = await page.evaluate(() => {
    const names = [...document.querySelectorAll('[data-testid="tile-name"]')];
    const clipped = names.filter((n) => n.scrollHeight > n.clientHeight + 1 || getComputedStyle(n).overflow === 'hidden').length;
    const tiles = [...document.querySelectorAll('[data-testid="wall-tile"]')];
    const w = tiles[0]?.getBoundingClientRect().width ?? 0;
    const lines = names.map((n) => Math.round(n.getBoundingClientRect().height / 14));
    const grid = document.querySelector('[data-testid="wall-grid"]');
    const cols = grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0;
    const first = document.querySelector('[data-testid="wall-tile"]')?.getBoundingClientRect().top ?? null;
    return { scrollWidth: document.documentElement.scrollWidth, innerWidth: innerWidth, tiles: tiles.length, tileWidth: w, columns: cols,
      namesClipped: clipped, maxNameLines: Math.max(0, ...lines), firstTileTop: first,
      faces: { photo: document.querySelectorAll('[data-face="photo"]').length, initials: document.querySelectorAll('[data-face="initials"]').length } };
  });
}
for (const [path, tag] of [['/djs', 'djs'], ['/dancers', 'dancers']]) {
  await page.goto(base + path, { waitUntil: 'networkidle' });
  if (mode === 'off') { await page.waitForTimeout(1500); await page.screenshot({ path: `${dir}${out}-${tag}-flag-off.png` }); continue; }
  await page.waitForSelector('[data-testid="wall-tile"]', { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${dir}${out}-${tag}-top.png` });
  await measure(`${tag}-all`);
  const n = await page.locator('[data-testid="wall-tile"]').count();
  await page.locator('[data-testid="wall-tile"]').nth(Math.floor(n / 2)).scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -200));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}${out}-${tag}-middle.png` });
  // special people
  const pick = await page.evaluate(() => {
    const t = [...document.querySelectorAll('[data-testid="wall-tile"]')];
    const idx = (f) => t.findIndex(f);
    return {
      noPhoto: idx((x) => x.querySelector('[data-face="initials"]')),
      threeRole: idx((x) => x.querySelectorAll('[data-testid="role-chip"]').length >= 3),
      longName: t.reduce((b, x, i, a) => ((x.querySelector('[data-testid="tile-name"]').textContent.length > (a[b]?.querySelector('[data-testid="tile-name"]').textContent.length ?? 0)) ? i : b), 0),
    };
  });
  report[`${tag}-picks`] = pick;
  for (const [k, i] of Object.entries(pick)) {
    if (i < 0) continue;
    const loc = page.locator('[data-testid="wall-tile"]').nth(i);
    await loc.scrollIntoViewIfNeeded();
    await loc.screenshot({ path: `${dir}${out}-${tag}-${k}.png` });
    report[`${tag}-${k}-text`] = (await loc.innerText()).replace(/\s+/g, ' ');
  }
  // Fix pass (owner change 1): the Join row under the /dancers wall, absent on /djs.
  const join = page.locator('[data-testid="wall-join-row"]');
  report[`${tag}-joinRow`] = await join.count() ? await join.evaluate((r) => ({
    links: [...r.querySelectorAll('a')].map((a) => ({ text: a.textContent, href: a.getAttribute('href'), h: Math.round(a.getBoundingClientRect().height) })),
    belowGrid: r.getBoundingClientRect().top >= document.querySelector('[data-testid="wall-grid"]').getBoundingClientRect().bottom,
  })) : null;
  if (await join.count()) {
    await join.evaluate((r) => r.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${dir}${out}-${tag}-bottom.png` });
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  const chip = page.locator('[data-testid="wall-filter"]', { hasText: tag === 'djs' ? 'Dancers' : 'DJs' });
  if (await chip.count()) {
    await chip.first().click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${dir}${out}-${tag}-filter.png` });
    await measure(`${tag}-filtered`);
  }
}
report.pageErrors = errors;
writeFileSync(`${dir}${out}-report.json`, JSON.stringify(report, null, 1));
await br.close();
console.log(JSON.stringify(report, null, 1));
