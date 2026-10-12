import { test, expect } from '@playwright/test';
import { checkOverflow, coveredFixedBottomControls, fakeSupabase, openOrganiserAsOwnerWithDraft, PUBLIC_ROUTES, scrollTo, settled } from './helpers';

/**
 * Overlap and clipping at phone sizes, on every public route:
 *   - no horizontal page scroll: scrollingElement.scrollWidth <= the device
 *     width (see checkOverflow for why not window.innerWidth);
 *   - no fixed bottom layer covers another's controls: a tap at the centre of
 *     every visible button/link in a fixed element in the bottom half of the
 *     screen reaches that control (elementFromPoint), at scroll top AND bottom.
 */

async function assertNoOverlap(page: import('@playwright/test').Page) {
  for (const where of ['top', 'bottom'] as const) {
    await scrollTo(page, where);
    expect(await checkOverflow(page), `horizontal page scroll @${where}`).toEqual([]);
    expect(await coveredFixedBottomControls(page), `covered fixed-bar controls @${where}`).toEqual([]);
  }
}

for (const path of PUBLIC_ROUTES) {
  test(`overlap ${path}: no sideways scroll, fixed bottom controls tappable`, async ({ page }) => {
    await fakeSupabase(page);
    const res = await page.goto(path);
    expect(res?.status(), `${path} must render (status)`).toBeLessThan(400);
    await settled(page);
    await assertNoOverlap(page);
  });
}

test('overlap organiser page as its owner, Save bar up: no sideways scroll, nothing covers a control', async ({ page }) => {
  await openOrganiserAsOwnerWithDraft(page);
  await assertNoOverlap(page);
});

// Canaries: each detector, run on a page with the defect planted, must report it.
// A detector that cannot fail here is decoration on every route above.
test('canary: the overflow detector reports a 600px-wide element', async ({ page }) => {
  await fakeSupabase(page);
  await page.goto('/faq');
  await settled(page);
  expect(await checkOverflow(page), 'clean page').toEqual([]);
  await page.evaluate(() => {
    const d = document.createElement('div');
    d.style.width = '600px';
    d.style.height = '10px';
    document.body.appendChild(d);
  });
  expect(await checkOverflow(page)).toHaveLength(1);
});

test('canary: the covered-control detector reports a fixed button under another fixed layer', async ({ page }) => {
  await fakeSupabase(page);
  await page.goto('/faq');
  await settled(page);
  await page.evaluate(() => {
    const b = document.createElement('button');
    b.textContent = 'Planted';
    b.style.cssText = 'position:fixed;bottom:20px;left:20px;width:80px;height:40px;z-index:1';
    const cover = document.createElement('div');
    cover.style.cssText = 'position:fixed;bottom:0;left:0;right:0;height:100px;z-index:2';
    document.body.append(b, cover);
  });
  expect(await coveredFixedBottomControls(page)).toEqual([expect.objectContaining({ label: 'Planted' })]);
});
