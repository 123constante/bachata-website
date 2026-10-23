import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { checkOverflow, fakeSupabase, frames, type GoLiveScenario } from './helpers';
import { GOLIVE_SERIES_ID, GOLIVE_EVENT_NAME } from './fakeSupabase.mjs';

/**
 * Invite W2 on a PHONE (390x844): the phone and Instagram fields, "Do you also DJ
 * or teach?", the go-live gaps that link to the role editor, and "It's live" with
 * the DJ / teacher offer. All inside /account/o/go-live, on the fake's goLive
 * scenarios (fakeSupabase.mjs goLiveRpcs). Every screen is checked for: no
 * sideways scroll, every visible control >= 44px tall, axe colour contrast (AA).
 * SHOTS=<dir> writes the design record screenshots (docs/design/977/).
 */

const GO_LIVE = `/account/o/go-live?series=${GOLIVE_SERIES_ID}`;

const shot = async (page: Page, name: string) => {
  await frames(page);
  const path = process.env.SHOTS ? `${process.env.SHOTS}/${name}.png` : test.info().outputPath(`${name}.png`);
  await page.screenshot({ path });
};

/** The self-running checks every screen gets. */
async function screenChecks(page: Page, label: string) {
  expect(await checkOverflow(page), `${label}: no sideways scroll`).toEqual([]);
  const small = await page.evaluate(() => [...document.querySelectorAll('main button, main a[href], main input, main textarea, main select')]
    .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; })
    .filter((el) => !(el instanceof HTMLInputElement && el.type === 'hidden'))
    .map((el) => ({ el: (el.getAttribute('data-testid') ?? el.textContent ?? el.tagName).trim().slice(0, 40), h: Math.round(el.getBoundingClientRect().height) }))
    .filter((x) => x.h < 44));
  expect(small, `${label}: taps >= 44px`).toEqual([]);
  const axe = await new AxeBuilder({ page }).include('main').withRules(['color-contrast']).analyze();
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

    await box.fill('7700900123');
    await expect(step.getByTestId('phone-feedback-ok')).toBeVisible();
    await screenChecks(page, 'phone valid');
    await shot(page, 'phone-valid');

    await box.fill('77');
    await step.getByRole('button', { name: 'Continue' }).click();
    await expect(step).toContainText('Finish the number first');
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

test.describe('"Do you also DJ or teach?"', () => {
  const answers: [string, { teacher: boolean; dj: boolean }][] = [
    ['roles-no', { teacher: false, dj: false }],
    ['roles-dj-yes', { teacher: false, dj: true }],
    ['roles-teacher-yes', { teacher: true, dj: false }],
    ['roles-both', { teacher: true, dj: true }],
  ];
  for (const [name, a] of answers) {
    test(name, async ({ page }) => {
      await open(page, {});
      await continueTo(page, 'Do you also DJ or teach?');
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
  await continueTo(page, 'Do you also DJ or teach?');
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
