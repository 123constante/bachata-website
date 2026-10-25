// Walk script (layout pass: hero kept, pills, Teachers coming soon, Organisers link): node docs/mockups/w2a-wall/shot.mjs <baseUrl> <outPrefix> [off]
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
  // Layout pass (owner, 2026-10-21): hero -> pills -> wall; Teachers = coming soon; Organisers = link.
  report[`${tag}-layout`] = await page.evaluate(() => {
    const top = (sel) => document.querySelector(sel)?.getBoundingClientRect().top ?? null;
    const pills = [...document.querySelectorAll('[data-testid="wall-filter"]')].map((b) => b.textContent);
    const org = document.querySelector('[data-testid="wall-organisers"]');
    const heroTitle = [...document.querySelectorAll('h1')].map((h) => h.textContent.trim());
    // Critique pass: every pill + the link is >= 44px, and how many rows the pill row takes.
    const ctl = [...document.querySelectorAll('[data-testid="wall-filter"],[data-testid="wall-organisers"]')].map((e) => e.getBoundingClientRect());
    const pillSizes = ctl.map((b) => [Math.round(b.width), Math.round(b.height)]);
    const pillRows = new Set(ctl.map((b) => Math.round(b.top))).size;
    return { heroTitle, pills, pillSizes, pillRows, organisers: org ? { tag: org.tagName, href: org.getAttribute('href'), h: Math.round(org.getBoundingClientRect().height) } : null,
      pillsTop: top('[data-testid="wall-pills"]') + scrollY, gridTop: top('[data-testid="wall-grid"]') + scrollY,
      joinRow: !!document.querySelector('[data-testid="wall-join-row"]'), wallHeader: document.body.innerText.includes('behind the nights') };
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('[data-testid="wall-pills"]').evaluate((r) => r.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}${out}-${tag}-pills.png` });
  await page.locator('[data-testid="wall-filter"]', { hasText: 'Teachers' }).click();
  await page.waitForTimeout(400);
  report[`${tag}-teachers`] = await page.evaluate(() => ({
    text: document.querySelector('[data-testid="wall-teachers-soon"]')?.textContent ?? null,
    tiles: document.querySelectorAll('[data-testid="wall-tile"]').length,
  }));
  await page.screenshot({ path: `${dir}${out}-${tag}-teachers.png` });
  await page.locator('[data-testid="wall-filter"]', { hasText: 'All' }).click();
  await page.waitForTimeout(300);
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
