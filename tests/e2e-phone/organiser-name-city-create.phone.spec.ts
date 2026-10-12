import { test, expect, type Page } from '@playwright/test';
import { box, checkOverflow, coveredFixedBottomControls, fakeSupabase, frames, ORG_SLUG, ORG2_ID, ORG2_SLUG, ORG_ID, scrollTo, settled, type Box } from './helpers';

/**
 * Edit in place on a PHONE, the Name and City sheets and the owner-only Create
 * event link, at 390x844 and 360x640 (playwright.phone.config.ts projects):
 *   - Name: the sheet is inside the screen, its box is 16px, "We will save"
 *     shows the trimmed name, Done shows it in the hero (a LOCAL draft);
 *   - City: the search box is at the TOP, the list scrolls INSIDE the sheet
 *     (the sheet itself does not scroll), rows are >= 44px, and with the
 *     keyboard up (the viewport shrunk, as visualViewport does) the search box
 *     and Done stay on screen; a pick shows the city the database confirms;
 *   - Create event: >= 44px tall, no sideways scroll, never under the Save bar
 *     or the BottomNav, beside the "Upcoming events" count (an organiser with
 *     nights) and in the empty state (one without); visitors see none of it.
 * Save is NEVER pressed and no event is ever created: the fake Supabase
 * (fakeSupabase.mjs) refuses every write anyway.
 */

const intersects = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** A tap at the centre of `selector` reaches it (nothing fixed covers it). */
const tappable = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return !!hit && (hit === el || el.contains(hit));
  });

async function openAsOwner(page: Page, slug: string) {
  await fakeSupabase(page, { signedInAsOwner: true, realClock: true });
  await page.goto(`/organisers/${slug}`);
  await page.locator('[data-eip-pencil="name"]').waitFor();
  await settled(page);
}

/** One drafted field, so the Save bar is up (as openOrganiserAsOwnerWithDraft). */
async function draftWebsite(page: Page) {
  await page.locator('[data-eip-pencil="website"]').click();
  const sheet = page.getByTestId('eip-sheet');
  await sheet.getByRole('textbox').fill('https://example.org/e2e-draft');
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByTestId('eip-bar')).toBeVisible();
  await frames(page);
}

async function sheetInsideScreen(page: Page, label: string) {
  const vp = page.viewportSize()!;
  const s = await box(page, '[data-testid="eip-sheet"]');
  expect(s.y, `${label}: sheet top`).toBeGreaterThanOrEqual(0);
  expect(s.y + s.height, `${label}: sheet bottom`).toBeLessThanOrEqual(vp.height + 0.5);
  expect(s.x + s.width, `${label}: sheet right`).toBeLessThanOrEqual(vp.width + 0.5);
  const done = await box(page, '[data-testid="eip-sheet"] button:has-text("Done")');
  expect(done.y + done.height, `${label}: Done on screen`).toBeLessThanOrEqual(vp.height + 0.5);
  expect(done.height, `${label}: Done height`).toBeGreaterThanOrEqual(44);
}

test('Name sheet: on screen, 16px box, "We will save" the trimmed name, Done shows it in the hero (no Save)', async ({ page }) => {
  await openAsOwner(page, ORG_SLUG);
  const pencil = await box(page, '[data-eip-pencil="name"]');
  expect(pencil.width, 'name pencil tap target').toBeGreaterThanOrEqual(44);
  expect(pencil.height, 'name pencil tap target').toBeGreaterThanOrEqual(44);
  expect(await checkOverflow(page), 'no sideways scroll with the name pencil').toEqual([]);
  await page.locator('[data-eip-pencil="name"]').click();
  const sheet = page.getByRole('dialog', { name: 'Name' });
  await expect(sheet).toBeVisible();
  const input = sheet.getByRole('textbox');
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('Ritmo Phone QA');
  expect(await input.evaluate((el) => getComputedStyle(el).fontSize)).toBe('16px');
  await sheetInsideScreen(page, 'name');
  await input.fill('  Ritmo Phone QA Nights ');
  await expect(sheet.getByTestId('eip-will-save')).toHaveText('We will save:Ritmo Phone QA Nights');
  await expect(sheet.getByTestId('eip-name-counter')).toHaveText('21 / 80');
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ritmo Phone QA Nights');
  await expect(page.getByTestId('eip-bar')).toBeVisible();
  expect(await checkOverflow(page), 'no sideways scroll with the drafted name').toEqual([]);
  await page.screenshot({ path: test.info().outputPath('name-drafted.png') });
});

test('City sheet: search at the TOP, list scrolls INSIDE, rows >= 44px, keyboard up keeps search + Done on screen; a pick shows the confirmed city', async ({ page }, info) => {
  await openAsOwner(page, ORG_SLUG);
  const chip = page.getByTestId('eip-city');
  await expect(chip).toContainText('London');
  await page.locator('[data-eip-pencil="city"]').click();
  const sheet = page.getByRole('dialog', { name: 'City' });
  await expect(sheet).toBeVisible();
  const search = sheet.getByRole('searchbox');
  await expect(search).toBeFocused();
  expect(await search.evaluate((el) => getComputedStyle(el).fontSize)).toBe('16px');
  await search.fill('united');
  await expect(sheet.getByRole('radio')).toHaveCount(12);
  await sheetInsideScreen(page, 'city');

  const list = '[data-testid="eip-city-list"]';
  const searchSel = '[data-testid="eip-sheet"] input[type="search"]';
  const measure = async () => {
    const m = await page.locator(list).evaluate((el) => ({
      scroll: el.scrollHeight, client: el.clientHeight,
      rows: Array.from(el.querySelectorAll('label')).map((l) => l.getBoundingClientRect().height),
    }));
    const sheetScroll = await page.getByTestId('eip-sheet').evaluate((el) => el.scrollHeight - el.clientHeight);
    return { ...m, sheetScroll, search: await box(page, searchSel), list: await box(page, list) };
  };
  const check = async (label: string) => {
    const m = await measure();
    expect(m.search.y + m.search.height, `${label}: search box above the list`).toBeLessThanOrEqual(m.list.y + 0.5);
    expect(m.search.y, `${label}: search box on screen`).toBeGreaterThanOrEqual(0);
    for (const h of m.rows) expect(h, `${label}: row height`).toBeGreaterThanOrEqual(44);
    expect(m.sheetScroll, `${label}: the sheet itself does not scroll (the list does)`).toBeLessThanOrEqual(1);
    return m;
  };
  const before = await check('open');
  if (info.project.name === 'phone-360x640') {
    expect(before.scroll, '12 rows overflow the list at 360x640: it scrolls').toBeGreaterThan(before.client);
  }
  // Scrolling the list leaves the search box where it is.
  await page.locator(list).evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await frames(page);
  const scrolled = await check('list scrolled');
  expect(Math.abs(scrolled.search.y - before.search.y), 'search box moved when the list scrolled').toBeLessThanOrEqual(1);

  // Keyboard up: a phone keyboard shrinks the visual viewport by about 300px.
  // Chromium cannot open one here, so the viewport is shrunk the same way.
  const vp = page.viewportSize()!;
  await page.setViewportSize({ width: vp.width, height: vp.height - 300 });
  await frames(page);
  const kb = await check('keyboard up');
  expect(kb.scroll, 'keyboard up: the list scrolls').toBeGreaterThan(kb.client);
  await sheetInsideScreen(page, 'keyboard up');
  await page.setViewportSize(vp);
  await frames(page);

  await page.locator(list).evaluate((el) => { el.scrollTop = 0; });
  await sheet.getByLabel('Manchester, United Kingdom').check();
  await expect(sheet.getByTestId('eip-will-save')).toHaveText('We will save:Manchester');
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(chip).toContainText('Manchester');
  await expect(page.getByTestId('eip-bar')).toBeVisible();
  expect(await checkOverflow(page), 'no sideways scroll with the drafted city').toEqual([]);
});

async function assertCreateEvent(page: Page, label: string) {
  const sel = '[data-testid="eip-create-event"]';
  await page.locator(sel).scrollIntoViewIfNeeded();
  await page.locator(sel).evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await frames(page);
  const b = await box(page, sel);
  const vp = page.viewportSize()!;
  expect(b.height, `${label}: height`).toBeGreaterThanOrEqual(44);
  expect(b.x, `${label}: left edge on screen`).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width, `${label}: right edge on screen`).toBeLessThanOrEqual(vp.width + 0.5);
  expect(await checkOverflow(page), `${label}: no sideways scroll`).toEqual([]);
  // Not under the BottomNav or the Save bar's dock, and a tap reaches it.
  const nav = await box(page, '#app-nav');
  expect(intersects(b, nav), `${label}: overlaps the BottomNav`).toBe(false);
  if (await page.getByTestId('eip-bar').count()) {
    const bar = await box(page, '[data-testid="eip-bar"]');
    expect(intersects(b, bar), `${label}: overlaps the Save bar`).toBe(false);
  }
  expect(await tappable(page, sel), `${label}: a tap at its centre reaches it`).toBe(true);
  // At full scroll (the page can move no further) it is never left under the
  // BottomNav or the Save bar: the page keeps room for them at its end.
  await scrollTo(page, 'bottom');
  const end = await box(page, sel);
  if (end.y + end.height > 0 && end.y < vp.height) {
    expect(intersects(end, await box(page, '#app-nav')), `${label}: under the BottomNav at full scroll`).toBe(false);
    if (await page.getByTestId('eip-bar').count()) {
      expect(intersects(end, await box(page, '[data-testid="eip-bar"]')), `${label}: under the Save bar at full scroll`).toBe(false);
    }
  }
  expect(await coveredFixedBottomControls(page), `${label}: covered fixed-bar controls`).toEqual([]);
  return b;
}

for (const withDraft of [false, true]) {
  const when = withDraft ? 'Save bar up' : 'no draft';
  test(`Create event beside the "Upcoming events" count (${when}): >= 44px, no overflow, clear of the Save bar and BottomNav`, async ({ page }) => {
    await openAsOwner(page, ORG2_SLUG);
    if (withDraft) await draftWebsite(page);
    const link = page.getByTestId('eip-create-event');
    await expect(link).toHaveText('Create event');
    await expect(link).toHaveAttribute('href', `/account/o/events/new?o=${ORG2_ID}`);
    const b = await assertCreateEvent(page, `upcoming row, ${when}`);
    // In the heading row, overlapping neither the heading nor the count.
    await page.getByTestId('eip-create-event').evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await frames(page);
    const h2 = await box(page, '#upcoming h2');
    const count = await box(page, '#upcoming h2 + div > span');
    const now = await box(page, '[data-testid="eip-create-event"]');
    expect(intersects(now, h2), 'overlaps the heading').toBe(false);
    expect(intersects(now, count), 'overlaps the date count').toBe(false);
    expect(Math.abs(now.height - b.height)).toBeLessThanOrEqual(0.5);
    await page.screenshot({ path: test.info().outputPath(`create-event-upcoming-${withDraft ? 'draft' : 'clean'}.png`) });
  });

  test(`Create your first event in the empty state (${when}): >= 44px, no overflow, clear of the Save bar and BottomNav`, async ({ page }) => {
    await openAsOwner(page, ORG_SLUG);
    if (withDraft) await draftWebsite(page);
    const link = page.getByTestId('eip-create-event');
    await expect(link).toHaveText('Create your first event');
    await expect(link).toHaveAttribute('href', `/account/o/events/new?o=${ORG_ID}`);
    await assertCreateEvent(page, `empty state, ${when}`);
  });
}

test('Create event opens the existing create flow with this organiser preselected (nothing is created)', async ({ page }) => {
  await openAsOwner(page, ORG2_SLUG);
  await page.getByTestId('eip-create-event').click();
  await expect(page).toHaveURL(new RegExp(`/account/o/events/new\\?o=${ORG2_ID}$`));
});

for (const slug of [ORG_SLUG, ORG2_SLUG]) {
  test(`a visitor sees no Create event and no pencils on /organisers/${slug}`, async ({ page }) => {
    await fakeSupabase(page);
    await page.goto(`/organisers/${slug}`);
    await settled(page);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.waitForTimeout(500);
    await expect(page.getByTestId('eip-create-event')).toHaveCount(0);
    await expect(page.locator('[data-eip-pencil]')).toHaveCount(0);
    await expect(page.locator('a[href^="/account/o/events/new"]')).toHaveCount(0);
  });
}
