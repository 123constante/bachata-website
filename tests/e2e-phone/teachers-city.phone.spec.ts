import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { animationsDone, checkOverflow, fakeSupabase, settled } from './helpers';

/**
 * Teachers directory per city (brief teachers-directory-city), at both phone
 * sizes, from the fake's prod shapes: London 46, Manchester 5, Leeds 0 (active,
 * empty), Madrid (inactive) and an unknown slug. Every state: the heading names
 * the city, there is no sideways scroll, the new controls are >= 44px tall and
 * pass colour contrast (4.5:1), and an empty or fallback city offers "Tell us".
 */
const SHAPES = [
  { slug: 'london-gb', heading: 'Bachata Teachers in London', cards: 46, note: null },
  { slug: 'manchester-gb', heading: 'Bachata Teachers in Manchester', cards: 5, note: null },
  { slug: 'leeds-gb', heading: 'Bachata Teachers in Leeds', cards: 0, note: 'No teachers listed in Leeds yet. Know one?' },
  { slug: 'madrid-es', heading: 'Bachata Teachers in London', cards: 46, note: 'No teachers listed in Madrid yet. Know one?' },
  { slug: 'nowhere-xx', heading: 'Bachata Teachers in London', cards: 46, note: 'No teachers listed in that city yet. Know one?' },
] as const;

const NEW_CONTROLS = '[data-testid="teachers-city-switcher"], [data-testid="teachers-city-note"] button, [data-testid="teachers-empty"] button, [data-testid="teachers-city-sheet"] li button';

async function shortControls(page: Page) {
  return page.$$eval(NEW_CONTROLS, (els) => els
    .filter((el) => el.getClientRects().length > 0)
    .map((el) => ({ text: (el.textContent ?? '').trim().slice(0, 40), h: Math.round(el.getBoundingClientRect().height) }))
    .filter((c) => c.h < 44));
}

async function contrast(page: Page, scope: string) {
  const r = await new AxeBuilder({ page }).options({ preload: false }).include(scope).withRules(['color-contrast']).analyze();
  return r.violations.flatMap((v) => v.nodes.map((n) => `${n.target.join(' ')} ${process.env.AXE_DEBUG ? n.failureSummary : ''}`.trim()));
}

for (const s of SHAPES) {
  test(`teachers /city/${s.slug}/teachers`, async ({ page }) => {
    await fakeSupabase(page);
    await page.goto(`/city/${s.slug}/teachers`);
    await expect(page.getByTestId('teachers-city-heading')).toHaveText(s.heading);
    await expect(page.getByTestId('teacher-card')).toHaveCount(s.cards);
    await settled(page);
    await animationsDone(page); // the heading fades in: contrast is measured where it rests
    if (s.note) {
      await expect(page.getByTestId('teachers-city-note')).toContainText(s.note);
      await expect(page.getByTestId('teachers-city-note').getByRole('button', { name: 'Tell us' })).toBeVisible();
    } else {
      await expect(page.getByTestId('teachers-city-note')).toHaveCount(0);
    }
    if (s.cards === 0) await expect(page.getByRole('button', { name: /See another city/ })).toBeVisible();
    expect(await checkOverflow(page)).toEqual([]);
    expect(await shortControls(page)).toEqual([]);
    expect(await contrast(page, '[data-testid^="teachers-"]')).toEqual([]);

    // The switcher sheet: active cities only, every row a full tap, nothing clipped sideways.
    await page.getByTestId('teachers-city-switcher').click();
    const sheet = page.getByTestId('teachers-city-sheet');
    // The fake does not model order=; prod sorts by name. The SET is what matters: active cities only.
    await expect(sheet.locator('li button')).toHaveCount(3);
    expect((await sheet.locator('li button').allTextContents()).sort()).toEqual(['Leeds', 'London', 'Manchester']);
    await page.waitForTimeout(600); // the slide-in, so the rows are measured where they rest
    expect(await shortControls(page)).toEqual([]);
    const sb = await sheet.boundingBox();
    const vw = page.viewportSize()!.width;
    expect(sb && sb.x >= -1 && sb.x + sb.width <= vw + 1).toBe(true);
    expect(await contrast(page, '[data-testid="teachers-city-sheet"]')).toEqual([]);
  });
}

test('/teachers sends a new visitor to London', async ({ page }) => {
  await fakeSupabase(page);
  await page.goto('/teachers');
  await expect(page).toHaveURL(/\/city\/london-gb\/teachers$/);
  await expect(page.getByTestId('teachers-city-heading')).toHaveText('Bachata Teachers in London');
});

test('Tell us opens the listing request form', async ({ page }) => {
  await fakeSupabase(page);
  await page.goto('/city/leeds-gb/teachers');
  await page.getByTestId('teachers-city-note').getByRole('button', { name: 'Tell us' }).click();
  await expect(page.getByTestId('teachers-city-note').locator('form')).toBeVisible();
  expect(await checkOverflow(page)).toEqual([]);
});
