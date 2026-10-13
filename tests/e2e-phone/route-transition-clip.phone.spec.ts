import { test, expect } from '@playwright/test';
import { checkOverflow, fakeSupabase, settled } from './helpers';

/**
 * The route entrance slide must never widen the page.
 *
 * PageTransition (src/components/PageTransition.tsx) enters from x: 30 and exits
 * to x: -30, so for ~250ms the route wrapper is 30px wider than the screen. On a
 * slow runner the overflow-measuring frame lands inside that window and the
 * document reports scrollWidth 420 > 390 ("overlap /auth: no sideways scroll",
 * PR #744; the offender is whatever sits furthest right, e.g. an orb).
 * <main id="main-content"> clips it (overflow-x: clip).
 *
 * Deterministic: instead of racing the animation, hold the route wrapper at the
 * enter pose and measure. Red without the clip, green with it, at both sizes.
 */
for (const path of ['/auth', '/faq']) {
  test(`route wrapper mid-slide (x: 30) does not scroll the page sideways: ${path}`, async ({ page }) => {
    await fakeSupabase(page);
    await page.goto(path);
    await settled(page);
    expect(await checkOverflow(page), 'clean before the slide').toEqual([]);
    await page.evaluate(() => {
      const wrapper = document.querySelector('#main-content')?.firstElementChild as HTMLElement | null;
      if (!wrapper) throw new Error('no route wrapper under #main-content');
      wrapper.style.transform = 'translateX(30px)';
    });
    expect(await checkOverflow(page), 'wrapper held at the enter pose').toEqual([]);
  });
}
