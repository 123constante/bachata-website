import { test, expect, type Page } from '@playwright/test';
import { box, checkOverflow, fakeSupabase, frames, ORG_SLUG, settled } from './helpers';

/**
 * The organiser page's Team card and team picker (mockup "Team sheet", screens 3
 * and 4), and the hero WITHOUT its old top-right "Edit profile" button, on a
 * PHONE at 390x844, 360x640 and 412x915 (each size runs once, in the 390x844
 * project, with its own viewport):
 *   - the hero: no "Edit profile" control anywhere;
 *   - the Team card: "Add a person" >= 44px, no sideways scroll;
 *   - the sheet with the keyboard up (the viewport shrunk by 300px, as
 *     visualViewport does): search box at the top and on screen, results capped
 *     to about three >= 44px rows that scroll INSIDE their box, the invite link on
 *     screen above the keyboard; a tap on a result closes the keyboard (the box
 *     loses focus), the chip shows, and with the keyboard down Done is on screen,
 *     >= 44px and a tap there reaches it;
 *   - Done: the fake refuses every write, so the chip stays with a plain-words
 *     reason, never the raw error;
 *   - a visitor: no Team card, and neither team RPC is ever asked.
 * Nothing reaches any database (fakeSupabase.mjs). SHOTS=<dir> also writes screenshots.
 */

const SIZES = [
  { width: 390, height: 844 },
  { width: 360, height: 640 },
  { width: 412, height: 915 },
];
const KEYBOARD = 300;

async function openAsOwner(page: Page) {
  await fakeSupabase(page, { signedInAsOwner: true, realClock: true });
  await page.goto(`/organisers/${ORG_SLUG}`);
  await page.getByTestId('eip-team').waitFor();
  await settled(page);
}

const shot = async (page: Page, selector: string, name: string) => {
  const path = process.env.SHOTS ? `${process.env.SHOTS}/${name}.png` : test.info().outputPath(`${name}.png`);
  await page.locator(selector).first().screenshot({ path });
};

async function onScreenAndHittable(page: Page, label: string, el: ReturnType<Page['locator']>, minHeight = 44) {
  const vp = page.viewportSize()!;
  const b = await el.boundingBox();
  expect(b, `${label}: box`).not.toBeNull();
  expect(b!.y, `${label}: top on screen`).toBeGreaterThanOrEqual(0);
  expect(b!.y + b!.height, `${label}: bottom on screen`).toBeLessThanOrEqual(vp.height + 0.5);
  expect(b!.height, `${label}: height`).toBeGreaterThanOrEqual(minHeight);
  const hit = await el.evaluate((node) => {
    const r = node.getBoundingClientRect();
    const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return !!at && (at === node || node.contains(at));
  });
  expect(hit, `${label}: a tap reaches it`).toBe(true);
}

for (const vp of SIZES) {
  test.describe(`${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp });
    test.beforeEach(({ page: _page }, info) => {
      test.skip(info.project.name !== 'phone-390x844', 'each size runs once, with its own viewport');
    });

    test('hero has no Edit profile button; the Team card offers Add a person (>= 44px)', async ({ page }) => {
      await openAsOwner(page);
      await expect(page.getByRole('button', { name: 'Edit profile' })).toHaveCount(0);
      await expect(page.getByLabel('Edit profile')).toHaveCount(0);
      const card = page.getByTestId('eip-team');
      await expect(card.getByTestId('eip-team-count')).toHaveText('On the team: 1 owner.');
      const add = card.getByRole('button', { name: 'Add a person' });
      await add.scrollIntoViewIfNeeded();
      await onScreenAndHittable(page, 'Add a person', add);
      expect(await checkOverflow(page), 'no sideways scroll with the Team card').toEqual([]);
      await frames(page);
      await shot(page, '[data-testid="eip-team"]', `team-card-${vp.width}x${vp.height}`);
    });

    test('picker with the keyboard up: search at top, ~3 rows scrolling inside, invite link above the keys; a pick closes the keyboard and Done shows', async ({ page }) => {
      await openAsOwner(page);
      await page.getByTestId('eip-team').getByRole('button', { name: 'Add a person' }).click();
      const sheet = page.getByRole('dialog', { name: 'Add a person' });
      await expect(sheet).toBeVisible();
      const search = sheet.getByRole('searchbox', { name: 'Search by name' });
      await expect(search).toBeFocused();
      expect(await search.evaluate((el) => getComputedStyle(el).fontSize)).toBe('16px');

      // Keyboard up.
      await page.setViewportSize({ width: vp.width, height: vp.height - KEYBOARD });
      await frames(page);
      await search.fill('an');
      const rows = sheet.getByTestId('eip-team-result');
      await expect(rows).toHaveCount(4);
      const visible = { width: vp.width, height: vp.height - KEYBOARD };
      const s = await box(page, '[data-testid="eip-team-sheet"]');
      expect(s.y, 'sheet top on screen').toBeGreaterThanOrEqual(0);
      expect(s.y + s.height, 'sheet above the keyboard').toBeLessThanOrEqual(visible.height + 0.5);
      // The search box is at the top of the sheet and on screen.
      const q = await search.boundingBox();
      expect(q!.y, 'search box on screen').toBeGreaterThanOrEqual(s.y);
      expect(q!.y - s.y, 'search box at the top of the sheet').toBeLessThan(80);
      // About three rows show; the rest scroll inside the list, not the page.
      const list = sheet.getByTestId('eip-team-results');
      const m = await list.evaluate((el) => ({ client: el.clientHeight, scroll: el.scrollHeight, overflow: getComputedStyle(el).overflowY }));
      expect(m.overflow).toBe('auto');
      expect(m.scroll, 'the list scrolls inside').toBeGreaterThan(m.client);
      expect(m.client, 'about three rows').toBeLessThanOrEqual(48 * 3 + 16);
      expect(m.client, 'at least two rows').toBeGreaterThanOrEqual(48 * 2);
      for (const r of await rows.all()) expect((await r.boundingBox())!.height, 'row height').toBeGreaterThanOrEqual(44);
      // The fallback sits above the keyboard.
      const invite = sheet.getByRole('button', { name: 'Send an invite link' });
      await onScreenAndHittable(page, 'invite link (keyboard up)', invite);
      expect(await checkOverflow(page), 'no sideways scroll with the picker open').toEqual([]);
      await shot(page, '[data-testid="eip-team-sheet"]', `team-picker-keyboard-${vp.width}x${vp.height}`);

      // A long, accented name stays on one line inside its row.
      const longRow = rows.filter({ hasText: 'Maria Fernanda' });
      await longRow.scrollIntoViewIfNeeded();
      const lr = await longRow.boundingBox();
      expect(lr!.x + lr!.width, 'long-name row inside the screen').toBeLessThanOrEqual(vp.width + 0.5);

      // A tap picks and closes the keyboard.
      await rows.filter({ hasText: 'Ana Ruiz' }).click();
      await expect(search).not.toBeFocused();
      await expect(sheet.getByTestId('eip-team-chip')).toHaveText(['Ana Ruiz']);
      await page.setViewportSize(vp); // the keyboard goes down
      await frames(page);
      const done = sheet.getByRole('button', { name: 'Done' });
      await done.scrollIntoViewIfNeeded();
      await onScreenAndHittable(page, 'Done (keyboard down)', done);
      await onScreenAndHittable(page, 'Unpick chip', sheet.getByRole('button', { name: 'Unpick Ana Ruiz' }));
      await expect(sheet.getByTestId('eip-team-will-add')).toHaveText('Done adds Ana Ruiz as a manager. They can help at once.');
      await shot(page, '[data-testid="eip-team-sheet"]', `team-picker-picked-${vp.width}x${vp.height}`);

      // Done: the fake refuses the write; the chip stays with a plain-words reason.
      await done.click();
      const refusal = sheet.getByTestId('eip-team-refusal');
      await expect(refusal).toBeVisible();
      await expect(refusal).not.toContainText('fake supabase');
      await expect(refusal).not.toContainText('organiser_team');
      await expect(sheet.getByTestId('eip-team-chip')).toHaveText(['Ana Ruiz']);
      if (vp.width === 360) await shot(page, '[data-testid="eip-team-sheet"]', `team-picker-refused-${vp.width}x${vp.height}`);
    });

    test('no match: the list says what to do, and the invite link is right there', async ({ page }) => {
      await openAsOwner(page);
      await page.getByTestId('eip-team').getByRole('button', { name: 'Add a person' }).click();
      const sheet = page.getByRole('dialog', { name: 'Add a person' });
      await page.setViewportSize({ width: vp.width, height: vp.height - KEYBOARD });
      await sheet.getByRole('searchbox').fill('zzq');
      await expect(sheet.getByTestId('eip-team-message')).toContainText('No one called');
      await expect(sheet.getByTestId('eip-team-message')).toContainText('send them an invite link');
      await onScreenAndHittable(page, 'invite link (no match, keyboard up)', sheet.getByRole('button', { name: 'Send an invite link' }));
    });

    test('a visitor sees no Team card and the team RPCs are never asked', async ({ page }) => {
      const asked: string[] = [];
      page.on('request', (r) => { if (/organiser_team_(v1|search_people_v1|add_member_by_profile_v1)/.test(r.url())) asked.push(r.url()); });
      await fakeSupabase(page, { realClock: true });
      await page.goto(`/organisers/${ORG_SLUG}`);
      await settled(page);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByTestId('eip-team')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Add a person' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Edit profile' })).toHaveCount(0);
      expect(asked).toEqual([]);
    });
  });
}
