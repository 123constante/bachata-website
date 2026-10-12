import { test, expect, type Page } from '@playwright/test';
import { HERO_CATEGORY, HERO_ORGS } from './fakeSupabase.mjs';
import { checkOverflow, fakeSupabase, settled, type Box } from './helpers';

/**
 * The OWNER hero on a phone (the edit-in-place layer on /organisers/:slug), with
 * the names that broke it on a real 412px Android: 'Bachata Playground' and a
 * 34-character name, plus a long category. Asserts:
 *   - the three chips (City / Category / Year started) sit in <= 2 rows;
 *   - the Name pencil hugs the text: its left edge is within 16px of the right
 *     edge of the widest line of the h1's text (measured with a Range);
 *   - every hero pencil's tap area is >= 44px high and overlaps no other control;
 *   - the repeated 'CATEGORY . CITY' line is gone for the owner;
 *   - no sideways scroll.
 * Save is never pressed; the fake Supabase refuses every write.
 * SHOTS=<dir> also writes owner-hero screenshots (docs/screenshots/ for the PR).
 */

const CATEGORY = HERO_CATEGORY;

const intersects = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

async function openOwnerHero(page: Page, slug: string) {
  await fakeSupabase(page, { signedInAsOwner: true, realClock: true });
  await page.goto(`/organisers/${slug}`);
  await page.locator('[data-eip-pencil="name"]').waitFor();
  await settled(page);
}

// The phone projects (390x844, 360x640) cover the two sizes the suite owns; 412x915 (a common
// Android width, the owner's phone) is added here, run once, so the shared contrast baseline is untouched.
const SIZES = [{ width: 390, height: 844 }, { width: 360, height: 640 }, { width: 412, height: 915 }];

for (const size of SIZES) for (const { name, slug } of HERO_ORGS) {
  test.describe(`${size.width}x${size.height}`, () => {
  test.use({ viewport: size });
  test(`owner hero, "${name}" (${name.length} chars): chips <= 2 rows, name pencil hugs the text, taps >= 44px, no overlap`, async ({ page }, info) => {
    test.skip(info.project.name !== 'phone-390x844', 'sizes are set per case; run once');
    await openOwnerHero(page, slug);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);

    if (process.env.SHOTS) {
      const vp = page.viewportSize()!;
      await page.locator('header:has(h1)').first().screenshot({ path: `${process.env.SHOTS}/owner-hero-${process.env.SHOT_TAG ?? 'shot'}-${vp.width}-${name.length}.png` });
    }

    // Chips: distinct row tops (to the nearest 4px) <= 2.
    const chipTops = await page.locator('[data-testid="eip-meta"] > span').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top / 4)));
    expect(new Set(chipTops).size, `chip rows ${JSON.stringify(chipTops)}`).toBeLessThanOrEqual(2);

    // The name pencil sits beside the text: within 16px of the widest line's right edge.
    const gap = await page.evaluate(() => {
      const h1 = document.querySelector('h1')!;
      const range = document.createRange();
      range.selectNodeContents(h1);
      const textRight = Math.max(...Array.from(range.getClientRects()).map((r) => r.right));
      const pencil = document.querySelector('[data-eip-pencil="name"]')!.getBoundingClientRect();
      return { textRight, pencilLeft: pencil.left, gap: pencil.left - textRight };
    });
    expect(gap.gap, `name pencil gap ${JSON.stringify(gap)}`).toBeLessThanOrEqual(16);
    expect(gap.gap, 'pencil does not sit on the text').toBeGreaterThanOrEqual(-1);

    // Hero pencils: >= 44px tap area, none overlapping another control or each other.
    const hero = await page.locator('header [data-eip-pencil]').evaluateAll((els) =>
      els.map((e) => { const r = e.getBoundingClientRect(); return { f: e.getAttribute('data-eip-pencil'), x: r.x, y: r.y, width: r.width, height: r.height }; }));
    expect(hero.map((p) => p.f)).toEqual(expect.arrayContaining(['name', 'city', 'organisation_category', 'founded_year']));
    for (const p of hero) expect(p.height, `${p.f} tap height`).toBeGreaterThanOrEqual(44);
    for (let i = 0; i < hero.length; i++) for (let j = i + 1; j < hero.length; j++) {
      expect(intersects(hero[i], hero[j]), `${hero[i].f} overlaps ${hero[j].f}`).toBe(false);
    }
    const others = await page.locator('header a, header button:not([data-eip-pencil])').evaluateAll((els) =>
      els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, w: r.width }; }).filter((r) => r.w > 0));
    for (const p of hero) for (const o of others) expect(intersects(p, o), `${p.f} overlaps another control`).toBe(false);

    // The meta line above the chips is gone for the owner.
    await expect(page.getByText(/·/).filter({ hasText: CATEGORY.toUpperCase().slice(0, 4) })).toHaveCount(0);
    expect(await checkOverflow(page), 'no sideways scroll').toEqual([]);
    info.annotations.push({ type: 'hero', description: JSON.stringify({ chipTops, gap }) });
  });
  });
}
