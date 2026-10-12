import { test, expect, type Page } from '@playwright/test';
import { box, checkOverflow, coveredFixedBottomControls, fakeSupabase, frames, ORG_SLUG, ORG2_SLUG, settled } from './helpers';

/**
 * The Contact card and the ONE "Contact details" sheet (mockup "Contact sheet",
 * screen 2) on a PHONE, at 390x844, 360x640 and 412x915 (each size runs once, in
 * the 390x844 project, with its own viewport):
 *   - the card: each item tagged Public / Hidden with a masked value, and an
 *     "Edit contact details" row >= 44px; no sideways scroll;
 *   - the sheet: inside the screen, Done on screen and >= 44px, both switches
 *     >= 44x44 with role=switch and aria-checked, the phone box 16px; with the
 *     keyboard up (the viewport shrunk, as visualViewport does) Done stays on
 *     screen; a flipped switch updates its line and "We will save";
 *   - an organiser with no phone: the phone switch is disabled with its reason;
 *   - a visitor: no card, and get_organiser_contact_settings_v1 is never asked.
 * Save is NEVER pressed: the fake Supabase (fakeSupabase.mjs) refuses every write anyway.
 * SHOTS=<dir> also writes the card and sheet screenshots at each size.
 */

const SIZES = [
  { width: 390, height: 844 },
  { width: 360, height: 640 },
  { width: 412, height: 915 },
];

async function openAsOwner(page: Page, slug: string) {
  await fakeSupabase(page, { signedInAsOwner: true, realClock: true });
  await page.goto(`/organisers/${slug}`);
  await page.getByTestId('eip-contact').waitFor();
  await settled(page);
}

const shot = async (page: Page, selector: string, name: string) => {
  const path = process.env.SHOTS ? `${process.env.SHOTS}/${name}.png` : test.info().outputPath(`${name}.png`);
  await page.locator(selector).first().screenshot({ path });
};

async function sheetChecks(page: Page, label: string) {
  const vp = page.viewportSize()!;
  const s = await box(page, '[data-testid="eip-contact-sheet"]');
  expect(s.y, `${label}: sheet top`).toBeGreaterThanOrEqual(0);
  expect(s.y + s.height, `${label}: sheet bottom`).toBeLessThanOrEqual(vp.height + 0.5);
  expect(s.x + s.width, `${label}: sheet right`).toBeLessThanOrEqual(vp.width + 0.5);
  // Done is reachable: on screen once scrolled into view inside the sheet, and a tap there hits it.
  const done = page.getByTestId('eip-contact-sheet').getByRole('button', { name: 'Done' });
  await done.scrollIntoViewIfNeeded();
  const d = await done.boundingBox();
  expect(d, `${label}: Done box`).not.toBeNull();
  expect(d!.y, `${label}: Done top`).toBeGreaterThanOrEqual(0);
  expect(d!.y + d!.height, `${label}: Done bottom on screen`).toBeLessThanOrEqual(vp.height + 0.5);
  expect(d!.height, `${label}: Done height`).toBeGreaterThanOrEqual(44);
  const hit = await done.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return !!at && (at === el || el.contains(at));
  });
  expect(hit, `${label}: a tap on Done reaches Done`).toBe(true);
}

for (const vp of SIZES) {
  test.describe(`${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp });
    test.beforeEach(({ page: _page }, info) => {
      test.skip(info.project.name !== 'phone-390x844', 'each size runs once, with its own viewport');
    });

    test('Contact card: tags, masked values, Edit contact details row >= 44px, no sideways scroll', async ({ page }) => {
      await openAsOwner(page, ORG_SLUG);
      const card = page.getByTestId('eip-contact');
      await expect(card.getByTestId('eip-contact-phone')).toContainText('Public');
      await expect(card.getByTestId('eip-contact-phone')).toContainText('+44•• ••• 123');
      await expect(card.getByTestId('eip-contact-email')).toContainText('Hidden');
      await expect(card.getByTestId('eip-contact-email')).toContainText('hello@••••••.com');
      await expect(card).not.toContainText('7700 900123');
      const row = card.getByRole('button', { name: 'Edit contact details' });
      const r = await row.boundingBox();
      expect(r!.height, 'edit row tap target').toBeGreaterThanOrEqual(44);
      expect(r!.x + r!.width, 'edit row inside the screen').toBeLessThanOrEqual(vp.width + 0.5);
      expect(await checkOverflow(page), 'no sideways scroll with the contact card').toEqual([]);
      await card.scrollIntoViewIfNeeded();
      await frames(page);
      await shot(page, '[data-testid="eip-contact"]', `contact-card-${vp.width}x${vp.height}`);
    });

    test('Contact details sheet: on screen, switches are real 44px controls, Done reachable (keyboard up too); no Save', async ({ page }) => {
      await openAsOwner(page, ORG_SLUG);
      await page.getByTestId('eip-contact').getByRole('button', { name: 'Edit contact details' }).click();
      const sheet = page.getByRole('dialog', { name: 'Contact details' });
      await expect(sheet).toBeVisible();
      await expect(sheet).toContainText('How dancers can reach you. You choose what everyone sees.');
      const phone = sheet.getByLabel('Phone', { exact: true });
      await expect(phone).toBeFocused();
      await expect(phone).toHaveValue('+44 7700 900123');
      expect(await phone.evaluate((el) => getComputedStyle(el).fontSize)).toBe('16px');
      for (const name of ['Phone on your page', 'Email on your page']) {
        const s = sheet.getByRole('switch', { name });
        const b = await s.boundingBox();
        expect(b!.width, `${name} width`).toBeGreaterThanOrEqual(44);
        expect(b!.height, `${name} height`).toBeGreaterThanOrEqual(44);
      }
      await expect(sheet.getByRole('switch', { name: 'Phone on your page' })).toHaveAttribute('aria-checked', 'true');
      await expect(sheet.getByRole('switch', { name: 'Email on your page' })).toHaveAttribute('aria-checked', 'false');
      await expect(sheet.getByTestId('eip-will-save')).toHaveText('We will save: phone +44 7700 900123 (public), email hello@example.com (hidden)');
      await sheetChecks(page, 'sheet');
      expect(await checkOverflow(page), 'no sideways scroll with the sheet open').toEqual([]);
      await shot(page, '[data-testid="eip-contact-sheet"]', `contact-sheet-${vp.width}x${vp.height}`);

      // A flipped switch: its line and the preview follow.
      await sheet.getByRole('switch', { name: 'Email on your page' }).click();
      await expect(sheet.getByRole('switch', { name: 'Email on your page' })).toHaveAttribute('aria-checked', 'true');
      await expect(sheet.getByTestId('eip-will-save')).toHaveText('We will save: phone +44 7700 900123 (public), email hello@example.com (public)');

      // Keyboard up: a phone keyboard shrinks the visual viewport by about 300px.
      await phone.focus();
      await page.setViewportSize({ width: vp.width, height: vp.height - 300 });
      await frames(page);
      await sheetChecks(page, 'keyboard up');
      if (vp.width === 360) await shot(page, '[data-testid="eip-contact-sheet"]', `contact-sheet-keyboard-${vp.width}x${vp.height}`);
      await page.setViewportSize(vp);
      await frames(page);

      // Done drafts it (the bar comes up); Save is never pressed.
      await sheet.getByRole('button', { name: 'Done' }).click();
      await expect(sheet).toHaveCount(0);
      await expect(page.getByTestId('eip-bar-count')).toHaveText('1 change not saved');
      await expect(page.getByTestId('eip-contact').getByTestId('eip-contact-email')).toContainText('Public');
      await expect(page.getByTestId('eip-contact').getByTestId('eip-contact-email')).toContainText('unsaved');
      expect(await coveredFixedBottomControls(page), 'the Save bar covers nothing').toEqual([]);
      expect(await checkOverflow(page), 'no sideways scroll with the drafted contact').toEqual([]);
    });

    test('no phone yet: the phone switch is disabled with its reason', async ({ page }) => {
      await openAsOwner(page, ORG2_SLUG);
      await expect(page.getByTestId('eip-contact').getByTestId('eip-contact-phone')).toContainText('Not added');
      await expect(page.getByTestId('eip-contact').getByTestId('eip-contact-phone')).not.toContainText('Public');
      await page.getByTestId('eip-contact').getByRole('button', { name: 'Edit contact details' }).click();
      const sheet = page.getByRole('dialog', { name: 'Contact details' });
      const s = sheet.getByRole('switch', { name: 'Phone on your page' });
      await expect(s).toBeDisabled();
      await expect(s).toHaveAttribute('aria-checked', 'false');
      await expect(sheet).toContainText('Add a phone number first');
      await sheetChecks(page, 'no phone');
      if (vp.width === 360) await shot(page, '[data-testid="eip-contact-sheet"]', `contact-sheet-nophone-${vp.width}x${vp.height}`);
    });

    test('a visitor sees no contact card and the private settings are never asked for', async ({ page }) => {
      const asked: string[] = [];
      page.on('request', (r) => { if (r.url().includes('get_organiser_contact_settings_v1')) asked.push(r.url()); });
      await fakeSupabase(page, { realClock: true });
      await page.goto(`/organisers/${ORG_SLUG}`);
      await settled(page);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByTestId('eip-contact')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Edit contact details' })).toHaveCount(0);
      expect(asked).toEqual([]);
    });
  });
}
