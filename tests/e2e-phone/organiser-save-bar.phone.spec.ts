import { test, expect } from '@playwright/test';
import { box, coveredFixedBottomControls, fakeSupabase, frames, ORG_SLUG, routerNavigate, scrollTo, type Box } from './helpers';

/**
 * Edit in place on a PHONE: the Save bar must sit above the BottomNav, inside the
 * screen, tappable, and pinned while the page scrolls. Live 2026-10-11 it sat
 * exactly under the nav (Save not hit-testable) and, after an in-app navigation,
 * halfway down the page: the route's PageTransition wrapper kept `filter`, which
 * turns position:fixed into "fixed to the wrapper" (#719). So every case runs
 * for a direct load AND a router navigation from /organisers (reached from
 * /faq, so the route fade is live).
 *
 * The port of tests/e2e/organiser-edit-save-bar.real-supabase.spec.ts that runs
 * on every UI PR: same assertions, but the organiser comes from the fake Supabase
 * (fakeSupabase.mjs), server AND browser side, so no secret is needed. Save is
 * never pressed, and the fake refuses writes anyway.
 */

for (const entry of ['direct load', 'in-app navigation'] as const) {
  test(`organiser Save bar, ${entry}: inside the screen, above the nav, Save tappable, pinned on scroll`, async ({ page }) => {
    const vp = page.viewportSize()!;
    await fakeSupabase(page, { signedInAsOwner: true, realClock: true });
    if (entry === 'direct load') {
      await page.goto(`/organisers/${ORG_SLUG}`);
    } else {
      // The route fade only plays once a FRAMEWORK route using
      // InitialVisiblePageTransition has mounted, and /organisers (the catchall)
      // does not mount one. So a reader arriving from /faq, tapping through to
      // /organisers and then to the organiser: every hop a router navigation.
      await page.goto('/faq');
      // The PageTransition chunk is warmed at the first idle moment; navigating
      // before it has loaded renders the plain wrapper and misses the filter.
      await page.waitForFunction(() => performance.getEntriesByType('resource').some((e) => e.name.includes('PageTransition')));
      await routerNavigate(page, '/organisers');
      await expect(page).toHaveURL(/\/organisers$/);
      await expect(page.locator('#main-content')).toBeVisible();
      await routerNavigate(page, `/organisers/${ORG_SLUG}`);
      await expect(page).toHaveURL(new RegExp(`/organisers/${ORG_SLUG}$`));
      // The wrapper this case exists for: a filter left on the route after the fade.
      await expect
        .poll(() =>
          page.evaluate(() => {
            for (let n = document.querySelector('#main-content article')?.parentElement; n; n = n.parentElement) {
              if (getComputedStyle(n).filter !== 'none') return true;
            }
            return false;
          }),
        )
        .toBe(true);
    }

    // Make a draft (local only: nothing is sent until Save, which this never presses).
    await page.locator('[data-eip-pencil="website"]').click();
    const sheet = page.getByTestId('eip-sheet');
    await sheet.getByRole('textbox').fill('https://example.org/e2e-draft');
    await sheet.getByRole('button', { name: 'Done' }).click();
    await expect(sheet).toHaveCount(0);
    const bar = page.getByTestId('eip-bar');
    await expect(bar).toBeVisible();
    // Let any route transition finish: the bar's rect is the same two frames running.
    await expect
      .poll(async () => {
        const a = await box(page, '[data-testid="eip-bar"]');
        await frames(page);
        const b = await box(page, '[data-testid="eip-bar"]');
        return a.y === b.y && a.x === b.x;
      })
      .toBe(true);

    const positions: Box[] = [];
    for (const where of ['top', 'bottom', 'top'] as const) {
      await scrollTo(page, where);
      const b = await box(page, '[data-testid="eip-bar"]');
      const nav = await box(page, '#app-nav');
      // Fully inside the viewport.
      expect(b.y, `bar top @${where}`).toBeGreaterThanOrEqual(0);
      expect(b.x, `bar left @${where}`).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height, `bar bottom @${where}`).toBeLessThanOrEqual(vp.height);
      expect(b.x + b.width, `bar right @${where}`).toBeLessThanOrEqual(vp.width + 0.5);
      // Its bottom edge at or above the BottomNav's top edge.
      expect(b.y + b.height, `bar bottom vs nav top @${where}`).toBeLessThanOrEqual(nav.y + 0.5);
      // Save is the element a tap at its centre reaches.
      const hit = await bar.getByRole('button', { name: 'Save', exact: true }).evaluate((btn) => {
        const r = btn.getBoundingClientRect();
        const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return !!el && (el === btn || btn.contains(el));
      });
      expect(hit, `Save hit-testable @${where}`).toBe(true);
      // No fixed bottom layer (bar, notice, nav) covers another's controls.
      expect(await coveredFixedBottomControls(page), `covered fixed-bar controls @${where}`).toEqual([]);
      if (where === 'bottom') {
        // The room kept at the end of the page: the footer's last row ends above the dock.
        const dock = await box(page, '[data-testid="eip-dock"]');
        const footer = await box(page, 'footer');
        expect(footer.y + footer.height, 'footer bottom vs dock top at full scroll').toBeLessThanOrEqual(dock.y + 0.5);
      }
      positions.push(b);
    }
    // It does not move when the page scrolls.
    for (const p of positions) expect(Math.abs(p.y - positions[0].y), 'bar moved on scroll').toBeLessThanOrEqual(1);
    await page.screenshot({ path: test.info().outputPath(`save-bar-${vp.width}x${vp.height}-${entry.replace(/\W+/g, '-')}.png`) });
  });
}
