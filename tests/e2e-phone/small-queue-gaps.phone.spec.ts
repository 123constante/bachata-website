import { test, expect, type Page } from '@playwright/test';
import { fakeSupabase, ORG_SLUG, scrollTo, settled } from './helpers';
import { FLAG_EVENT_SLUG, FLAG_PROGRAMME_CODES } from './fakeSupabase.mjs';

/**
 * Website small queue (2026-10-13), measured with rects at both phone sizes:
 *
 * 1. No dead band at the page bottom (the nav moved to the top). At full scroll the
 *    last painted content (clipped to its scroll container, so a feed's hidden
 *    overflow does not count) meets the viewport's bottom edge: |gap| <= 1px. It was 127px on the home
 *    (every route's wrapper was a bare 100vh ON TOP of the 60px header and 64px
 *    nav spacers) and 3px on every footer page (a 61px nav over a 64px spacer).
 * 3. No empty band under the organiser hero's EQ bars: the stats strip starts
 *    where the hero ends (the 10vh / 80px brand fade took space of its own),
 *    while the bars keep their look (28 bars, 44px strip, 0.16 opacity) and
 *    stay still under prefers-reduced-motion.
 * 4. The event programme's flags come from the programme read: no request to
 *    dancer_profiles, and the stickers still show.
 */

/** nav top minus the lowest visible painted bottom of in-flow content. */
async function gapAboveNav(page: Page) {
  return page.evaluate(() => {
    // Nav is now a sticky row under the header, so the reference edge is the viewport bottom.
    const navTop = window.innerHeight;
    let lowest = -Infinity;
    let who = '';
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      if (el.closest('#app-nav')) continue;
      const s = getComputedStyle(el);
      if (s.visibility === 'hidden' || s.display === 'none' || s.opacity === '0') continue;
      // Skip fixed layers (header, background, overlays) and anything inside them.
      let clipBottom = Infinity;
      let fixed = false;
      for (let p = el as HTMLElement | null; p; p = p.parentElement) {
        const ps = getComputedStyle(p);
        if (ps.position === 'fixed') { fixed = true; break; }
        if (p !== el && ps.overflowY !== 'visible') clipBottom = Math.min(clipBottom, p.getBoundingClientRect().bottom);
      }
      if (fixed) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const hasText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').trim());
      const painted = hasText || ['IMG', 'svg', 'BUTTON', 'A', 'INPUT', 'CANVAS'].includes(el.tagName)
        || s.backgroundColor !== 'rgba(0, 0, 0, 0)' || s.backgroundImage !== 'none';
      if (!painted) continue;
      const bottom = Math.min(r.bottom, clipBottom);
      if (bottom > lowest) { lowest = bottom; who = `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`; }
    }
    return { gap: Math.round((navTop - lowest) * 10) / 10, navTop, lowest, who, scrollH: document.documentElement.scrollHeight, vh: window.innerHeight };
  });
}

const GAP_ROUTES = ['/', '/events', '/djs', '/organisers', `/event/${FLAG_EVENT_SLUG}`] as const;

for (const path of GAP_ROUTES) {
  test(`gap below the last content ${path}: none at full scroll`, async ({ page }, info) => {
    await fakeSupabase(page);
    await page.goto(path);
    await settled(page);
    // Until the height holds: a late-mounting section grows the page after the first jump.
    let h = -1;
    for (let i = 0; i < 6 && h !== (await page.evaluate(() => document.documentElement.scrollHeight)); i++) {
      h = await page.evaluate(() => document.documentElement.scrollHeight);
      await scrollTo(page, 'bottom');
      await page.waitForTimeout(400);
    }
    await scrollTo(page, 'bottom');
    const m = await gapAboveNav(page);
    console.log(`GAP ${info.project.name} ${path} ${JSON.stringify(m)}`);
    expect(Math.abs(m.gap), `${path}: px between the last content (${m.who}) and the viewport bottom`).toBeLessThanOrEqual(1);
  });
}

test('home fits the screen: no scroll, so no band to scroll into', async ({ page }) => {
  await fakeSupabase(page);
  await page.goto('/');
  await settled(page);
  const m = await gapAboveNav(page);
  expect(m.scrollH, 'home document height vs viewport').toBeLessThanOrEqual(m.vh);
});

async function heroBand(page: Page) {
  return page.evaluate(() => {
    const bars = Array.from(document.querySelectorAll<HTMLElement>('.organiser-hero-eq-bar'));
    const strip = bars[0].parentElement!;
    const hero = strip.parentElement!;
    // The first stats value: the first text in the block after the hero.
    let stats: Element | null = hero.nextElementSibling;
    while (stats && !(stats.textContent ?? '').trim()) stats = stats.nextElementSibling;
    const sr = stats!.getBoundingClientRect();
    return {
      bars: bars.length,
      stripH: strip.getBoundingClientRect().height,
      stripOpacity: getComputedStyle(strip).opacity,
      barsBottom: Math.max(...bars.map((b) => b.getBoundingClientRect().bottom)),
      heroBottom: hero.getBoundingClientRect().bottom,
      statsTop: sr.top,
      band: Math.round((sr.top - hero.getBoundingClientRect().bottom) * 10) / 10,
      animation: getComputedStyle(bars[0]).animationName,
    };
  });
}

test('organiser hero: no empty band under the EQ bars, bars unchanged', async ({ page }, info) => {
  await fakeSupabase(page);
  await page.goto(`/organisers/${ORG_SLUG}`);
  await settled(page);
  const m = await heroBand(page);
  console.log(`EQ ${info.project.name} ${JSON.stringify(m)}`);
  expect(m.bars).toBe(28);
  expect(m.stripH).toBe(44);
  expect(m.stripOpacity).toBe('0.16');
  expect(Math.abs(m.barsBottom - m.heroBottom), 'bars sit on the hero base').toBeLessThanOrEqual(1);
  expect(m.animation).toBe('organiserHeroEq');
  // The stats strip starts where the hero ends (1px seam overlap allowed).
  expect(Math.abs(m.band), 'px of empty band between the hero and the stats strip').toBeLessThanOrEqual(1);
});

test('organiser hero under prefers-reduced-motion: bars still, same band rule', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await fakeSupabase(page);
  await page.goto(`/organisers/${ORG_SLUG}`);
  await settled(page);
  const m = await heroBand(page);
  expect(m.animation).toBe('none');
  expect(Math.abs(m.band)).toBeLessThanOrEqual(1);
});

test('event programme: flags from the programme read, no dancer_profiles request', async ({ page }, info) => {
  const tables: string[] = [];
  page.on('request', (r) => {
    const m = new URL(r.url()).pathname.match(/^\/rest\/v1\/(?!rpc\/)([^/?]+)/);
    if (m) tables.push(m[1]);
  });
  await fakeSupabase(page);
  await page.goto(`/event/${FLAG_EVENT_SLUG}`);
  await settled(page);
  await expect(page.locator('[data-nationality-flag]').first()).toBeVisible();
  const shown = await page.locator('[data-nationality-flag]').evaluateAll((els) => els.map((e) => e.getAttribute('data-nationality-flag')));
  console.log(`PROGRAMME ${info.project.name} flags=${JSON.stringify(shown)} tableRequests=${JSON.stringify(tables)}`);
  expect([...new Set(shown)].sort()).toEqual([...new Set(FLAG_PROGRAMME_CODES)].sort());
  expect(tables.filter((t) => t === 'dancer_profiles'), 'dancer_profiles requests').toEqual([]);
});
