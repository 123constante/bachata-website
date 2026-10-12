import { test, expect, type Page } from '@playwright/test';
import { fakeSupabase, ORG2_SLUG, ORG_SLUG, settled } from './helpers';

/**
 * An in-app navigation opens the new page at the TOP (owner report 2026-10-12,
 * phone: home -> event -> organiser button, and the organiser page opened still
 * scrolled down, its photo and hero under the sticky header).
 *
 * The cause: ScrollToTop reset the scroll in a PASSIVE effect. A route change is
 * a transition, so React commits the new page's DOM in one task and runs passive
 * effects in a LATER one -- the browser is free to paint the new page in between,
 * still at the old scrollY. On a fast desktop that gap is a frame; on a phone (or
 * under a long task: image decode, a slow loader settling) it is long enough to
 * see, and nothing guaranteed it closed before the page was read.
 *
 * So each case pins the commit itself: a MutationObserver (a microtask, so it runs
 * after React's synchronous commit work and BEFORE the browser can paint) records
 * scrollY the moment the new page's <h1> is in the document. Then 3s of 100ms
 * samples: at 0 from the first one that shows the new page, and never off 0 again
 * (no late jump). And the reset is one window.scrollTo per navigation.
 *
 * Fake Supabase only (fakeSupabase.mjs); nothing is saved, no event is created.
 */

interface Probe {
  atCommit: number | null;
  committedAt: number | null;
  samples: { t: number; y: number; isNew: boolean }[];
  resets: number;
}

/** Wraps window.scrollTo to count resets to the top. Installed before any page script. */
async function countResets(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __resets: number };
    w.__resets = 0;
    const orig = window.scrollTo.bind(window);
    window.scrollTo = ((...args: unknown[]) => {
      const top = typeof args[0] === 'object' && args[0] ? (args[0] as ScrollToOptions).top : args[1];
      if (top === 0) w.__resets += 1;
      return (orig as (...a: unknown[]) => void)(...args);
    }) as typeof window.scrollTo;
  });
}

/**
 * Arms the probe, starts the navigation with `go` (a real link click, or the
 * router's navigate where no link exists between the two pages), and samples for 3s.
 */
async function navigateAndSample(page: Page, to: string, go: string | null): Promise<Probe> {
  return page.evaluate(
    async ({ to, go }) => {
      const oldH1 = document.querySelector('#main-content h1')?.textContent ?? '';
      const isNew = () => {
        const h1 = document.querySelector('#main-content h1');
        return location.pathname === to && !!h1 && h1.textContent !== oldH1;
      };
      const w = window as unknown as { __resets: number; __reactRouterDataRouter: { navigate: (p: string) => void } };
      const probe = { atCommit: null as number | null, committedAt: null as number | null, samples: [] as { t: number; y: number; isNew: boolean }[], resets: 0 };
      const resetsBefore = w.__resets;
      const t0 = performance.now();
      const mo = new MutationObserver(() => {
        if (probe.atCommit === null && isNew()) {
          probe.atCommit = window.scrollY;
          probe.committedAt = performance.now() - t0;
          mo.disconnect();
        }
      });
      mo.observe(document.body, { childList: true, subtree: true, characterData: true });
      if (go) {
        const link = document.querySelector<HTMLAnchorElement>(go);
        if (!link) throw new Error(`no link ${go}`);
        link.click();
      } else {
        w.__reactRouterDataRouter.navigate(to);
      }
      while (performance.now() - t0 < 3000) {
        await new Promise((r) => setTimeout(r, 100));
        probe.samples.push({ t: Math.round(performance.now() - t0), y: Math.round(window.scrollY), isNew: isNew() });
      }
      mo.disconnect();
      probe.resets = w.__resets - resetsBefore;
      return probe;
    },
    { to, go },
  );
}

/**
 * Scrolls well down the page: to `link` (centred) when that is far enough down,
 * else to 900 (or as far as the page goes).
 */
async function scrollDown(page: Page, link: string | null) {
  await page.evaluate((sel) => {
    if (sel) document.querySelector(sel)?.scrollIntoView({ block: 'center' });
    if (window.scrollY < 300) window.scrollTo(0, 900);
  }, link);
  await page.waitForTimeout(150);
  const y = await page.evaluate(() => window.scrollY);
  expect(y, 'the start page is scrolled down before the tap').toBeGreaterThan(300);
  return y;
}

// [from, to, link to click (null: the router navigates, as a <Link> does)]
const PAIRS: [string, string, string | null][] = [
  ['/organisers', `/organisers/${ORG_SLUG}`, `#main-content a[href="/organisers/${ORG_SLUG}"]`],
  ['/faq', `/organisers/${ORG_SLUG}`, null],
  [`/organisers/${ORG2_SLUG}`, `/organisers/${ORG_SLUG}`, null],
  ['/learn-bachata-london', '/faq', '#main-content a[href="/faq"]'],
  ['/bachata-parties-london', '/organisers', '#main-content a[href="/organisers"]'],
];

for (const [from, to, link] of PAIRS) {
  test(`scroll reset: ${from} -> ${to} opens at the top, once, with no later jump`, async ({ page }) => {
    await countResets(page);
    await fakeSupabase(page, { realClock: true });
    await page.goto(from);
    await settled(page);
    // The route fade (lazy PageTransition) is live once its chunk is warm: the
    // path a reader on a second-plus navigation takes.
    await page.waitForFunction(() => performance.getEntriesByType('resource').some((e) => e.name.includes('PageTransition')));
    const startY = await scrollDown(page, link);

    // A phone's CPU (Lighthouse's mobile 4x): React's scheduler slices work into
    // ~5ms chunks, so on a slow CPU the commit and the passive effects land in
    // different tasks -- with a paint between them -- far more often.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    let probe: Probe;
    try {
      probe = await navigateAndSample(page, to, link);
    } finally {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    }
    const trace = `start ${startY}; commit@${probe.committedAt?.toFixed(0)}ms y=${probe.atCommit}; ` +
      probe.samples.map((s) => `${s.t}:${s.y}${s.isNew ? '' : '(old)'}`).join(' ');
    test.info().annotations.push({ type: 'scrollY samples', description: trace });
    console.log(`[scroll-reset] ${from} -> ${to}: ${trace}`);

    await expect(page).toHaveURL(new RegExp(`${to.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
    expect(probe.committedAt, 'the new page committed').not.toBeNull();
    // The first paint the new page can get is already at the top.
    expect(probe.atCommit, 'scrollY when the new page is committed (before it can paint)').toBe(0);
    const first = probe.samples.findIndex((s) => s.isNew);
    expect(first, 'the new page is visible within the sampled 3s').toBeGreaterThanOrEqual(0);
    // 0 from the first sample showing the new page (<= 100ms after it is visible),
    // and never off 0 after: no late jump, no restore.
    expect(probe.samples.slice(first).filter((s) => s.y !== 0), 'samples off the top after the new page showed').toEqual([]);
    expect(probe.resets, 'resets to the top during this navigation').toBe(1);
  });
}

test('scroll reset: a direct load starts at the top', async ({ page }) => {
  await fakeSupabase(page, { realClock: true });
  await page.goto(`/organisers/${ORG_SLUG}`);
  await settled(page);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test('scroll reset: a #hash URL (direct load) still lands on its anchor and is not reset', async ({ page }) => {
  await countResets(page);
  await fakeSupabase(page, { realClock: true });
  await page.goto(`/organisers/${ORG2_SLUG}#upcoming`);
  await settled(page);
  await page.waitForTimeout(1_000);
  const { y, top } = await page.evaluate(() => ({
    y: window.scrollY,
    top: Math.round(document.getElementById('upcoming')!.getBoundingClientRect().top),
  }));
  expect(y, 'scrolled to the anchor').toBeGreaterThan(0);
  // scroll-mt-16 on the section: its top sits just under the sticky header.
  expect(Math.abs(top), 'anchor near the top of the viewport').toBeLessThan(120);
  expect(await page.evaluate(() => (window as unknown as { __resets: number }).__resets), 'no reset on a hash URL').toBe(0);
});
