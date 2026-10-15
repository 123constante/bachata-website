import { test, expect } from '@playwright/test';
import { fakeSupabase, openOrganiserAsOwnerWithDraft, settled, checkOverflow, FLAG_ROUTES } from './helpers';
import { FLAG_EVENT_SLUG, FLAG_FESTIVAL_SLUG } from './fakeSupabase.mjs';

/**
 * The public section row (BottomNav) lives directly under the site header, not at
 * the bottom of the screen (owner decision 2026-10-15: it ate finger space).
 * Measures, at 390x844 and 360x780: no sideways scroll, every target >= 44px,
 * header + row <= 120px, nothing fixed to the bottom, elementFromPoint at each
 * link centre returns that link. SHOT_DIR=<dir> also writes screenshots.
 */
void FLAG_ROUTES;
const VIEWPORTS = [{ width: 390, height: 844 }, { width: 360, height: 780 }];
const ROUTES: Array<[string, string]> = [
  ['home', '/city/london-gb'],
  ['event', `/event/${FLAG_EVENT_SLUG}`],
  ['festival', `/festival/${FLAG_FESTIVAL_SLUG}`],
  ['organisers', '/organisers'],
];

async function measure(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const nav = document.querySelector('#app-nav') as HTMLElement | null;
    const header = document.querySelector('#app-header') as HTMLElement;
    if (!nav) return { hasNav: false } as const;
    const cs = getComputedStyle(nav);
    const nr = nav.getBoundingClientRect();
    const hr = header.getBoundingClientRect();
    const links = [...nav.querySelectorAll('a')].map((a) => {
      const r = a.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { label: a.textContent?.trim(), h: r.height, ok: !!hit && (hit === a || a.contains(hit)) };
    });
    return { hasNav: true, position: cs.position, bottom: nr.bottom, headerBottom: hr.bottom, navTop: nr.top, links, scrollW: document.documentElement.scrollWidth, vw: window.innerWidth };
  });
}

for (const vp of VIEWPORTS) {
  for (const [name, path] of ROUTES) {
    test(`section row under the header @${vp.width}x${vp.height}: ${name}`, async ({ page }, info) => {
      test.skip(info.project.name !== 'phone-390x844', 'sets its own viewports');
      await page.setViewportSize(vp);
      await fakeSupabase(page);
      await page.goto(path);
      await settled(page);
      const m = await measure(page);
      if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/${name}-${vp.width}x${vp.height}.png` });
      if (name === 'home') {
        // The Festival Map home keeps its own layout; the row is still there on a phone.
        expect(m.hasNav).toBe(true);
      }
      if (!m.hasNav) return;
      expect(m.position).toBe('sticky');
      expect(m.navTop).toBeGreaterThanOrEqual(m.headerBottom - 1);
      expect(m.bottom, 'header + row <= 120px').toBeLessThanOrEqual(120);
      expect(m.scrollW).toBe(m.vw);
      expect(await checkOverflow(page)).toEqual([]);
      expect(m.links!.length).toBe(4);
      for (const l of m.links!) {
        expect(l.h, `${l.label} >= 44px`).toBeGreaterThanOrEqual(44);
        expect(l.ok, `${l.label} reachable at its centre`).toBe(true);
      }
    });
  }
  test(`organiser page, Save bar up @${vp.width}x${vp.height}: bar at the bottom, row under the header`, async ({ page }, info) => {
    test.skip(info.project.name !== 'phone-390x844', 'sets its own viewports');
    await page.setViewportSize(vp);
    await openOrganiserAsOwnerWithDraft(page);
    const m = await measure(page);
    if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/account-save-${vp.width}x${vp.height}.png` });
    expect(m.hasNav).toBe(true);
    expect(m.position).toBe('sticky');
    const bar = await page.getByTestId('eip-bar').boundingBox();
    expect(bar!.y + bar!.height).toBeGreaterThan(vp.height - 20);
    expect(bar!.y + bar!.height).toBeLessThanOrEqual(vp.height);
  });
}
