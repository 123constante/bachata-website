import { test, expect, type Page } from '@playwright/test';
import { fakeSupabase, settled } from './helpers';
import { FLAG_DANCER_ID } from './fakeSupabase.mjs';

/**
 * Walk bug 2 (PR #789): the breadcrumb links on Account settings and Delete account were 17 px high.
 * Every crumb link on these two pages is a >= 44 px tap target that a tap at its centre reaches.
 * Scoped to these pages: other pages keep today's compact crumbs.
 */
const PAGES = [
  { path: '/account/settings', links: ['Home', 'Your account'] },
  { path: '/account/settings/delete', links: ['Home', 'Your account', 'Account settings'] },
] as const;

const crumbLinks = (page: Page) =>
  page.locator('nav[aria-label="breadcrumb"] a').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { label: (el.textContent ?? '').trim(), height: Math.round(r.height), hitsItself: Boolean(hit && el.contains(hit)) };
    }),
  );

for (const p of PAGES) {
  test(`${p.path}: every breadcrumb link is a 44 px tap target`, async ({ page }) => {
    await fakeSupabase(page, { signedInAsOwner: true, realClock: true, asDancer: FLAG_DANCER_ID });
    await page.goto(p.path);
    await settled(page);
    await page.waitForTimeout(400); // the crumbs fade/slide in
    const links = await crumbLinks(page);
    expect(links.map((l) => l.label)).toEqual([...p.links]);
    const small = links.filter((l) => l.height < 44 || !l.hitsItself);
    expect(small, 'crumb links under 44 px, or a tap at the centre misses them').toEqual([]);
  });
}
