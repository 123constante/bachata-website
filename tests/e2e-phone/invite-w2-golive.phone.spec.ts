import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { checkOverflow, fakeSupabase, frames, settled, ORG2_SLUG, type GoLiveScenario } from './helpers';
import { FLAG_EVENT_SLUG, GOLIVE_SERIES_ID, GOLIVE_EVENT_NAME } from './fakeSupabase.mjs';

/**
 * Invite W2 on a PHONE (390x844): the phone and Instagram fields, "Do you also DJ
 * or teach?", the go-live gaps that link to the role editor, and "It's live" with
 * the DJ / teacher offer. All inside /account/o/go-live, on the fake's goLive
 * scenarios (fakeSupabase.mjs goLiveRpcs). The same phone field in the organiser
 * Contact details sheet and the event-page raffle dialog (W2d), both outside
 * `main`, so their checks are scoped to the dialog. Every screen is checked for:
 * no sideways scroll, every visible control >= 44px tall, axe colour contrast (AA).
 * The phone box is always TYPED key by key (pressSequentially), never fill():
 * fill() sets the whole number in one event and hid the "Saved before" bug (#977 W2d).
 * SHOTS=<dir> writes the design record screenshots (docs/design/977/).
 */

const GO_LIVE = `/account/o/go-live?series=${GOLIVE_SERIES_ID}`;

const shot = async (page: Page, name: string) => {
  await frames(page);
  const path = process.env.SHOTS ? `${process.env.SHOTS}/${name}.png` : test.info().outputPath(`${name}.png`);
  await page.screenshot({ path });
};

/** The self-running checks every screen gets. `scope` is where the taps and contrast are read (a dialog sits outside main). */
async function screenChecks(page: Page, label: string, scope = 'main', tapScope = scope) {
  expect(await checkOverflow(page), `${label}: no sideways scroll`).toEqual([]);
  const small = await page.evaluate((s) => [...document.querySelectorAll(['button', 'a[href]', 'input', 'textarea', 'select'].map((t) => `${s} ${t}`).join(', '))]
    .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; })
    .filter((el) => !(el instanceof HTMLInputElement && el.type === 'hidden'))
    .map((el) => ({ el: (el.getAttribute('data-testid') ?? el.textContent ?? el.tagName).trim().slice(0, 40), h: Math.round(el.getBoundingClientRect().height) }))
    .filter((x) => x.h < 44), tapScope);
  expect(small, `${label}: taps >= 44px`).toEqual([]);
  const axe = await new AxeBuilder({ page }).include(scope).withRules(['color-contrast']).analyze();
  expect(axe.violations.flatMap((v) => v.nodes.map((n) => n.target.join(' '))), `${label}: contrast >= 4.5`).toEqual([]);
}

async function open(page: Page, sc: GoLiveScenario) {
  await fakeSupabase(page, { signedInAsOwner: true, realClock: true, goLive: sc });
  await page.goto(GO_LIVE);
  // "Almost live", or "Almost there" when the check already names gaps.
  await expect(page.getByTestId('golive-title')).toHaveText(/^Almost (live|there)$/);
}

const continueTo = async (page: Page, question: string) => {
  await page.getByTestId('golive-continue').click();
  await expect(page.getByTestId('golive-question')).toHaveText(question);
};

test.beforeEach(({ page: _page }, info) => {
  test.skip(info.project.name !== 'phone-390x844', 'one size, 390x844');
});

test.describe('phone field (organiser contact_phone question)', () => {
  test('empty, valid, invalid', async ({ page }) => {
    await open(page, { steps: [['organiser', 'contact_phone']] });
    await continueTo(page, 'What number can dancers call?');
    const step = page.getByTestId('step-org-phone');
    const box = step.locator('input[type="tel"]');
    await expect(box).toHaveValue('');
    await screenChecks(page, 'phone empty');
    await shot(page, 'phone-empty');

    // Key by key, as a phone keyboard types: the box must survive the first digit.
    await box.pressSequentially('7');
    await expect(step.getByTestId('phone-legacy')).toHaveCount(0);
    await box.pressSequentially('700900123');
    await expect(box).toHaveValue('7700900123');
    await expect(step.getByTestId('phone-feedback-ok')).toHaveText(/^\S*\s*\+44 7700 900123$/);
    await screenChecks(page, 'phone valid');
    await shot(page, 'phone-valid');

    await box.clear();
    await box.pressSequentially('77');
    await expect(step.getByTestId('phone-legacy')).toHaveCount(0);
    await step.getByRole('button', { name: 'Continue' }).click();
    await expect(box).toHaveValue('77');
    await expect(step.getByTestId('phone-feedback')).toHaveText('Looks short. United Kingdom numbers have 10 digits after +44.');
    await screenChecks(page, 'phone invalid');
    await shot(page, 'phone-invalid');
  });

  test('a legacy stored value is shown as it is, never blocked', async ({ page }) => {
    await open(page, { steps: [['organiser', 'contact_phone']], contactPhone: '07700900123' });
    await continueTo(page, 'What number can dancers call?');
    const step = page.getByTestId('step-org-phone');
    await expect(step.getByTestId('phone-legacy-value')).toHaveText('07700900123');
    await screenChecks(page, 'phone legacy');
    await shot(page, 'phone-legacy');
  });
});

test.describe('Instagram field (organiser instagram question)', () => {
  const cases: [string, string, RegExp | null][] = [
    ['ig-at-name', '@Ritmo.Bachata', null],
    ['ig-link', 'https://www.instagram.com/ritmo.bachata/', null],
    ['ig-bare', 'ritmo.bachata', null],
    ['ig-invalid', 'ritmo bachata!', /Use only letters, numbers, dots and underscores/],
  ];
  for (const [name, typed, err] of cases) {
    test(name, async ({ page }) => {
      await open(page, { steps: [['organiser', 'instagram']] });
      await continueTo(page, 'What is its Instagram?');
      const step = page.getByTestId('step-org-instagram');
      await step.locator('input').fill(typed);
      if (err) await expect(step.getByText(err)).toBeVisible();
      else await expect(step.getByTestId('instagram-input-ok')).toContainText('ritmo.bachata');
      await screenChecks(page, name);
      await shot(page, name);
    });
  }
});

test.describe('"Do you also teach or DJ?"', () => {
  const answers: [string, { teacher: boolean; dj: boolean }][] = [
    ['roles-no', { teacher: false, dj: false }],
    ['roles-dj-yes', { teacher: false, dj: true }],
    ['roles-teacher-yes', { teacher: true, dj: false }],
    ['roles-both', { teacher: true, dj: true }],
  ];
  for (const [name, a] of answers) {
    test(name, async ({ page }) => {
      await open(page, {});
      await continueTo(page, 'Do you also teach or DJ?');
      await screenChecks(page, `${name} unanswered`);
      if (name === 'roles-no') await shot(page, 'roles-unanswered');
      await page.getByTestId(`golive-role-teacher-${a.teacher ? 'yes' : 'no'}`).click();
      await page.getByTestId(`golive-role-dj-${a.dj ? 'yes' : 'no'}`).click();
      if (a.dj) {
        await page.getByTestId('golive-role-dj-dj_name').fill('DJ Ana');
        await page.getByTestId('golive-role-dj-genres').fill('Bachata');
      }
      if (a.teacher) await page.getByTestId('golive-role-teacher-teaching_styles').fill('Bachata Sensual');
      await expect(page.getByTestId('golive-roles-reason')).toHaveCount(0);
      await expect(page.getByTestId('golive-roles-continue')).toBeEnabled();
      await screenChecks(page, name);
      await shot(page, name);
    });
  }
});

test('go-live gaps link to the role editor', async ({ page }) => {
  await open(page, {
    intent: { roles: ['dancer', 'organiser', 'teacher', 'dj'], declined: [] },
    missing: [
      { area: 'teacher', organiser_id: null, fields: ['teaching_styles'] },
      { area: 'dj', organiser_id: null, fields: ['dj_name', 'dj_genres'] },
    ],
  });
  // Nothing left to ask (both roles already claimed), so the flow opens straight on the check.
  const gaps = page.getByTestId('golive-gaps');
  await expect(gaps).toBeVisible();
  // One link per missing field: teacher styles, DJ name, DJ music.
  await expect(gaps.getByRole('link')).toHaveCount(3);
  await expect(page.getByTestId('golive-live')).toBeDisabled();
  await expect(page.getByTestId('golive-live-reason')).not.toBeEmpty();
  await screenChecks(page, 'gaps');
  await shot(page, 'golive-gaps');
});

test("It's live with the DJ / teacher offer", async ({ page }) => {
  await open(page, { liveOk: true });
  await continueTo(page, 'Do you also teach or DJ?');
  await page.getByTestId('golive-role-teacher-yes').click();
  await page.getByTestId('golive-role-teacher-teaching_styles').fill('Bachata Sensual');
  await page.getByTestId('golive-role-dj-yes').click();
  await page.getByTestId('golive-role-dj-dj_name').fill('DJ Ana');
  await page.getByTestId('golive-role-dj-genres').fill('Bachata');
  await page.getByTestId('golive-roles-continue').click();
  await expect(page.getByTestId('golive-live')).toBeEnabled();
  await page.getByTestId('golive-live').click();
  await expect(page.getByTestId('org-done')).toBeVisible();
  await expect(page.getByText("It's live", { exact: true })).toBeVisible();
  await expect(page.getByTestId('org-done-message')).toHaveText(`${GOLIVE_EVENT_NAME} is live.`);
  await expect(page.getByTestId('org-done-offer-teacher')).toBeVisible();
  await expect(page.getByTestId('org-done-offer-dj')).toBeVisible();
  await screenChecks(page, "it's live");
  await shot(page, 'its-live-offer');
});

// W2d: the same phone field in the organiser Contact details sheet (document.body, ink/cream).
test.describe('phone field in the Contact details sheet', () => {
  const SHEET = '[data-testid="eip-contact-sheet"]';
  async function openSheet(page: Page, contactPhone: string | null) {
    await fakeSupabase(page, { signedInAsOwner: true, realClock: true, contactPhone });
    await page.goto(`/organisers/${ORG2_SLUG}`);
    await page.getByTestId('eip-contact').waitFor();
    await settled(page);
    await page.getByTestId('eip-contact').getByRole('button', { name: 'Edit contact details' }).click();
    const sheet = page.getByRole('dialog', { name: 'Contact details' });
    await expect(sheet).toBeVisible();
    return sheet;
  }

  test('empty, valid, too short', async ({ page }) => {
    const sheet = await openSheet(page, null);
    const box = sheet.getByLabel('Phone', { exact: true });
    await expect(box).toHaveValue('');
    await screenChecks(page, 'sheet phone empty', SHEET);
    await shot(page, 'sheet-phone-empty');

    await box.pressSequentially('7');
    await expect(sheet.getByTestId('phone-legacy')).toHaveCount(0);
    await box.pressSequentially('700900123');
    await expect(box).toHaveValue('7700900123');
    await expect(sheet.getByTestId('eip-phone-feedback-ok')).toContainText('+44 7700 900123');
    await screenChecks(page, 'sheet phone valid', SHEET);
    await shot(page, 'sheet-phone-valid');

    await box.clear();
    await box.pressSequentially('77');
    await box.blur();
    await expect(box).toHaveValue('77');
    await expect(sheet.getByTestId('eip-phone-feedback')).toHaveText('Looks short. United Kingdom numbers have 10 digits after +44.');
    await expect(sheet.getByRole('button', { name: 'Done' })).toBeDisabled();
    await screenChecks(page, 'sheet phone too short', SHEET);
    await shot(page, 'sheet-phone-short');
  });

  test('a legacy stored number: shown as it is, Change opens the field', async ({ page }) => {
    const sheet = await openSheet(page, '07700900123');
    await expect(sheet.getByTestId('phone-legacy-value')).toHaveText('07700900123');
    await expect(sheet.getByRole('button', { name: 'Done' })).toBeEnabled();
    await screenChecks(page, 'sheet phone legacy', SHEET);
    await shot(page, 'sheet-phone-legacy');
    await sheet.getByTestId('phone-legacy-change').click();
    await expect(sheet.getByRole('button', { name: /^Country: / })).toBeVisible();
    await screenChecks(page, 'sheet phone legacy changed', SHEET);
    await shot(page, 'sheet-phone-legacy-change');
  });
});

// W2d: the raffle wrapper (gold tone) on the event page. The entry is never submitted.
test.describe('phone field in the raffle', () => {
  const DIALOG = '[role="dialog"]';
  // Taps are read on the phone field (the raffle tone's own controls); contrast on the whole dialog.
  const FIELD = '[role="dialog"] form';
  test('empty, valid, too short', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await fakeSupabase(page, { realClock: true, raffle: true });
    await page.goto(`/event/${FLAG_EVENT_SLUG}`);
    await settled(page);
    await page.getByRole('button', { name: 'Pull the lever to enter the raffle' }).click();
    const dialog = page.getByRole('dialog', { name: 'Enter the raffle' });
    const box = dialog.locator('#raffle-phone');
    await expect(box).toBeVisible();
    await expect(box).toHaveValue('');
    const country = dialog.getByRole('button', { name: /^Country: / });
    for (const [what, el] of [['phone box', box], ['country button', country]] as const) {
      const b = await el.boundingBox();
      expect(b!.height, `raffle ${what} height`).toBeGreaterThanOrEqual(44);
    }
    await screenChecks(page, 'raffle phone empty', DIALOG, `${FIELD} .flex.items-stretch`);
    await shot(page, 'raffle-phone-empty');

    await box.pressSequentially('7700900123');
    await expect(box).toHaveValue('7700900123');
    await expect(dialog.getByTestId('raffle-phone-feedback')).toHaveCount(0);
    await screenChecks(page, 'raffle phone valid', DIALOG, `${FIELD} .flex.items-stretch`);
    await shot(page, 'raffle-phone-valid');

    await box.clear();
    await box.pressSequentially('77');
    await box.blur();
    await expect(box).toHaveValue('77');
    await expect(dialog.getByTestId('raffle-phone-feedback')).toHaveText('Looks short. United Kingdom numbers have 10 digits after +44.');
    await screenChecks(page, 'raffle phone too short', DIALOG, `${FIELD} .flex.items-stretch`);
    await shot(page, 'raffle-phone-short');

    // The country list: every row a 44px tap.
    await country.click();
    const rows = dialog.getByRole('option');
    const heights = await rows.evaluateAll((els) => els.slice(0, 12).map((el) => Math.round(el.getBoundingClientRect().height)));
    expect(heights.filter((h) => h < 44), 'raffle country rows >= 44px').toEqual([]);
  });
});
