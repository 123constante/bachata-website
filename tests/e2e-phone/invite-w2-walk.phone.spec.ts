import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { checkOverflow, fakeSupabase, frames, type GoLiveScenario } from './helpers';
import { GOLIVE_SERIES_ID, GOLIVE_EVENT_NAME } from './fakeSupabase.mjs';

/**
 * #977 W2 walk fixes 1-9 on a PHONE (390x844), on the fake's goLive scenarios with
 * prod-shaped answers: every server go-live code (_series_go_live_check_p5, prod
 * 2026-10-24), the walk's step order (optional first in the server's list, the
 * required teacher key last). Each screen: no sideways scroll, every visible
 * control >= 44px tall, axe colour contrast (AA). SHOTS=<dir> writes the design
 * record screenshots (docs/design/977/).
 */

const EVENT = `/account/o/events/${GOLIVE_SERIES_ID}`;
/** Every event code the server sends, as a fresh draft has them. */
const EVERY_CODE: [string, string][] = [
  ['venue', 'venue'], ['city', 'venue'], ['session', 'programme'], ['cover', 'cover'], ['no_session_first_date', 'programme'],
  ['first_date_past', 'dates'], ['bad_session_times', 'programme'], ['no_payment', 'payment'], ['no_flyer', 'cover'],
];
const UNKNOWN = 'Something else on the event';

const shot = async (page: Page, name: string) => {
  await frames(page);
  const path = process.env.SHOTS ? `${process.env.SHOTS}/${name}.png` : test.info().outputPath(`${name}.png`);
  await page.screenshot({ path });
};

async function screenChecks(page: Page, label: string, scope = 'main') {
  expect(await checkOverflow(page), `${label}: no sideways scroll`).toEqual([]);
  const small = await page.evaluate((s) => [...document.querySelectorAll(['button', 'a[href]', 'input', 'textarea', 'select'].map((t) => `${s} ${t}`).join(', '))]
    .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; })
    .filter((el) => !(el instanceof HTMLInputElement && el.type === 'hidden'))
    .map((el) => ({ el: (el.getAttribute('data-testid') ?? el.textContent ?? el.tagName).trim().slice(0, 40), h: Math.round(el.getBoundingClientRect().height) }))
    .filter((x) => x.h < 44), scope);
  expect(small, `${label}: taps >= 44px`).toEqual([]);
  const axe = await new AxeBuilder({ page }).include(scope).withRules(['color-contrast']).analyze();
  expect(axe.violations.flatMap((v) => v.nodes.map((n) => n.target.join(' '))), `${label}: contrast >= 4.5`).toEqual([]);
}

const as = (page: Page, sc: GoLiveScenario) => fakeSupabase(page, { signedInAsOwner: true, realClock: true, goLive: sc });

test.beforeEach(({ page: _page }, info) => {
  test.skip(info.project.name !== 'phone-390x844', 'one size, 390x844');
});

test('fix 5: the Go live list names every server code, each with a link; the flyer twins show once', async ({ page }) => {
  await as(page, { eventMissing: EVERY_CODE });
  await page.goto(EVENT);
  const card = page.getByTestId('org-golive-list');
  await expect(card).toBeVisible();
  await expect(card).not.toContainText(UNKNOWN);
  await expect(card.getByText('Upload a flyer')).toHaveCount(1);
  await expect(card.getByText('Say how dancers pay')).toBeVisible();
  await screenChecks(page, 'golive list');
  await shot(page, 'walk-golive-list');
});

test('fix 4: Home to-do quotes the event\'s Go live count', async ({ page }) => {
  await as(page, { eventMissing: EVERY_CODE });
  await page.goto('/account/o');
  const row = page.getByTestId('home-job').filter({ hasText: `Finish and go live: ${GOLIVE_EVENT_NAME}` });
  // 9 codes, the flyer twins counted once: 8 rows.
  await expect(row.getByTestId('home-job-sub')).toHaveText('8 things left');
  await screenChecks(page, 'home to-do');
  await shot(page, 'walk-home-todo');
});

test('fix 5: How to pay, the payment editor the no_payment row links to', async ({ page }) => {
  await as(page, { eventMissing: [['no_payment', 'payment']] });
  await page.goto(`${EVENT}/details?edit=payment`);
  await expect(page.getByTestId('org-payment-chips').getByRole('button')).toHaveCount(5);
  await expect(page.getByTestId('org-detail-save')).toBeDisabled();
  await page.getByTestId('org-payment-chip').filter({ hasText: 'Pay at the door' }).click();
  await expect(page.getByTestId('org-detail-save')).toBeEnabled();
  await screenChecks(page, 'payment');
  await shot(page, 'walk-payment');
});

test('fix 1 + 3: from an event the wizard asks the required teacher key first, in the required words', async ({ page }) => {
  await as(page, {
    intent: { roles: ['dancer', 'organiser', 'teacher'], declined: [] },
    progressSteps: [['dancer', 'surname', false], ['dancer', 'bio', false], ['teacher', 'years_teaching', false], ['teacher', 'teaching_styles', true]],
  });
  await page.goto(`/account/o/complete?returnTo=${encodeURIComponent(EVENT)}`);
  await expect(page.getByTestId('wizard-question')).toHaveText('Which styles do you teach?');
  await expect(page.getByTestId('step-hint')).toContainText('Needed before your events can go live.');
  await expect(page.getByTestId('step-hint')).not.toContainText('Optional');
  await expect(page.getByTestId('step-continue')).toBeDisabled();
  await expect(page.getByTestId('wizard-required-left')).toHaveText('1 answer left');
  await screenChecks(page, 'wizard required');
  await shot(page, 'walk-wizard-required');
  // Finish later goes back to the event (fix 2).
  await page.getByTestId('wizard-finish-later').click();
  await expect(page).toHaveURL(new RegExp(`${EVENT}$`));
});

test('fix 8: the beta is said on Find your page, before any name or city', async ({ page }) => {
  await as(page, { noPages: true });
  await page.goto('/account/o');
  await expect(page.getByTestId('onboarding-beta-note')).toContainText('During the beta, new pages are approved by hand.');
  await screenChecks(page, 'find your page');
  await shot(page, 'walk-find-your-page');
});
