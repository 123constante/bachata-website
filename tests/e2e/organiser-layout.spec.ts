import { test, expect, type Page } from '@playwright/test';
import { FRIDAY, PHONE, WIDE, openOrganiser, expectNoHorizontalScroll, type OrganiserFake } from './helpers/organiserFake';

// Layout checks for the new organiser area (/account/o): every visible control on every
// screen, and in each open sheet, is at least 44px high (PRODUCT.md touch-target rule) at
// 390x844 and nothing scrolls sideways; at 1280x800 the event screens are two columns (list
// left ~300px, editor right). Replaces organiser-tap-targets.spec.ts (written for the deleted
// /account UI). Backend: helpers/organiserFake.ts.

const MIN = 44;
const OCC = 'c0000001-0000-4000-8000-202610090000';

// The owner's real 'Bachata Picnic' shape (fake name): ended, recurring, NO rule, ended_on
// set, 13 past Saturdays (the last on 5 Sep), 0 upcoming, lowercase styles incl. 'zouk'.
const PICNIC = 'b0000000-0000-4000-8000-0000000000e1';
const PICNIC_SATURDAYS = Array.from({ length: 13 }, (_, i) => new Date(Date.UTC(2026, 5, 13 + 7 * i)).toISOString().slice(0, 10));
const addPicnic = (fake: OrganiserFake) => {
  fake.addSeries(fake.organisers[0], {
    id: PICNIC, name: 'Park Social', lifecycle_status: 'ended', ended_on: '2026-09-05', default_start_date: PICNIC_SATURDAYS[0],
    extra_dates: PICNIC_SATURDAYS, recurrence_rule: null, default_music_styles: ['bachata', 'sensual bachata', 'salsa', 'zouk'],
  });
};
/** The sticky action bar's height (the slim bar while nothing is unsaved). */
const barHeight = async (page: Page) => (await page.getByTestId('org-actionbar').boundingBox())!.height;

/** Every visible control inside the organiser screen and any open sheet, with its height. */
async function controls(page: Page) {
  return page.evaluate(() => {
    const roots = Array.from(document.querySelectorAll('[data-testid^="org-page-"], [role="dialog"]'));
    const seen = new Set<Element>();
    const out: { name: string; h: number }[] = [];
    for (const root of roots) {
      for (const el of Array.from(root.querySelectorAll('a, button, input, select, textarea, [role="button"]'))) {
        if (seen.has(el)) continue;
        seen.add(el);
        const input = el as HTMLInputElement;
        if (el.tagName === 'INPUT' && ['checkbox', 'radio', 'hidden', 'file'].includes(input.type)) continue;
        if ((el as HTMLElement).closest('[aria-hidden="true"]')) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const label = (el.getAttribute('data-testid') || el.getAttribute('aria-label') || el.textContent || input.placeholder || '').trim().slice(0, 40);
        out.push({ name: `${el.tagName.toLowerCase()}:${label}`, h: Math.round(r.height * 10) / 10 });
      }
    }
    return out;
  });
}

async function expectTapTargets(page: Page) {
  // Let entrance motion (0.3s) finish before measuring.
  await page.waitForTimeout(400);
  const found = await controls(page);
  expect(found.length, 'the screen has controls to measure').toBeGreaterThan(2);
  expect(found.filter((c) => c.h < MIN - 0.5), `controls under ${MIN}px high`).toEqual([]);
  await expectNoHorizontalScroll(page);
}

test.describe('tap targets @390', () => {
  test.use({ viewport: PHONE });

  test('Home', async ({ page }) => {
    await openOrganiser(page, '/account/o');
    await expect(page.getByTestId('home-strip-lineup')).toBeVisible();
    await expectTapTargets(page);
  });

  test('onboarding', async ({ page }) => {
    await openOrganiser(page, '/account/o', { noOrganiser: true });
    await page.getByTestId('onboarding-search').fill('Ritmo');
    await expect(page.getByTestId('onboarding-result')).toHaveCount(2);
    await expectTapTargets(page);
  });

  test('Events list and New event', async ({ page }) => {
    await openOrganiser(page, '/account/o/events');
    await expect(page.getByTestId('org-event-row').first()).toBeVisible();
    await expect(page.getByTestId('org-events-new')).toBeVisible();
    await expectTapTargets(page);
    await page.goto('/account/o/events/new');
    await expect(page.getByTestId('org-new-event-name')).toBeVisible();
    await expectTapTargets(page);
  });

  test('event editor and its sheet', async ({ page }) => {
    await openOrganiser(page, `/account/o/events/${FRIDAY}`);
    await expect(page.getByTestId('org-schedule-session').first()).toBeVisible();
    await expectTapTargets(page);
    await page.getByTestId('org-row-until-open').click();
    await expect(page.getByTestId('org-sheet-until')).toBeVisible();
    await expectTapTargets(page);
  });

  test('date editor, session view and people search', async ({ page }) => {
    await openOrganiser(page, `/account/o/events/${FRIDAY}/dates/${OCC}`);
    await expect(page.getByTestId('session-row')).toHaveCount(2);
    await expectTapTargets(page);
    await page.getByTestId('session-row-open').first().click();
    await expect(page.getByTestId('session-add-person')).toBeVisible();
    await expectTapTargets(page);
    await page.getByTestId('session-add-person').click();
    await page.getByTestId('people-search').fill('ev');
    await expect(page.getByTestId('people-result').first()).toBeVisible();
    await expectTapTargets(page);
  });

  test('Team', async ({ page }) => {
    await openOrganiser(page, '/account/o/team');
    await expect(page.getByTestId('access-request')).toHaveCount(2);
    await expectTapTargets(page);
  });

  test('Profile', async ({ page }) => {
    await openOrganiser(page, '/account/o/profile', { organiserStatus: 'draft' });
    await expect(page.getByTestId('profile-send-review')).toBeVisible();
    await expectTapTargets(page);
  });

  // F4 (owner on a phone): nothing unsaved -> one line + the disabled button, under 64px,
  // no preview card; the card comes back with the first edit.
  test('nothing unsaved: the action bar is a slim bar under 64px on the event, date and profile editors', async ({ page }) => {
    await openOrganiser(page, `/account/o/events/${FRIDAY}`);
    await expect(page.getByTestId('org-schedule-session').first()).toBeVisible();
    expect(await barHeight(page)).toBeLessThan(64);
    await expect(page.getByTestId('org-preview-bar-preview')).toHaveCount(0);
    await page.getByTestId('org-event-name').fill('Friday Fiesta');
    await expect(page.getByTestId('org-preview-bar-preview')).toBeVisible();
    expect(await barHeight(page)).toBeGreaterThan(64);

    await page.goto(`/account/o/events/${FRIDAY}/dates/${OCC}`);
    await expect(page.getByTestId('session-row')).toHaveCount(2);
    expect(await barHeight(page)).toBeLessThan(64);
    await expect(page.getByTestId('date-preview-bar-preview')).toHaveCount(0);

    await page.goto('/account/o/profile');
    await expect(page.getByTestId('profile-name')).toBeVisible();
    expect(await barHeight(page)).toBeLessThan(64);
    await expect(page.getByTestId('profile-bar-preview')).toHaveCount(0);
  });

  test('an ended repeating event (the Bachata Picnic shape) reads true, offers nothing that cannot work, and its past dates open', async ({ page }) => {
    await openOrganiser(page, `/account/o/events/${PICNIC}`, {}, addPicnic);
    const editor = page.getByTestId('org-event-editor');
    await expect(editor).toBeVisible();
    await expect(page.getByTestId('org-event-status')).toHaveText('Ended');
    await expect(page.getByTestId('org-row-repeats')).toContainText('Every Saturday');
    await expect(page.getByTestId('org-date-card')).toContainText('Ended on Sat 5 Sep');
    await expect(page.getByTestId('org-date-card')).not.toContainText('No date listed yet');
    await expect(page.getByTestId('org-event-locked')).toContainText('To run it again, ask the Bachata Calendar team.');
    await expect(editor).not.toContainText('Extend');
    await expect(page.getByTestId('org-extend')).toHaveCount(0);
    await expect(page.getByTestId('org-row-venue')).toBeDisabled();
    await expect(page.getByTestId('org-style-chip').filter({ hasText: /^Zouk$/ })).toHaveCount(1);
    expect(await barHeight(page)).toBeLessThan(64);
    await expectTapTargets(page);
    await page.getByTestId('org-dates-past-toggle').click();
    const rows = page.getByTestId('org-dates-past').getByTestId('org-date-row');
    await expect(rows).toHaveCount(13);
    await expect(rows.first().locator('svg.lucide-chevron-right')).toBeVisible();
    await rows.first().click();
    await expect(page.getByTestId('date-locked-note')).toContainText('already happened and the event has ended');
    await expect(page.getByTestId('date-status')).toHaveText('Ended');
    await expect(page.getByTestId('date-cancel')).toBeDisabled();
    await expect(page.getByTestId('date-add-session')).toHaveCount(0);
    await expectTapTargets(page);
  });

  // No screen scrolls sideways at 390 (sheets are covered by the tap-target cases above).
  test('no screen or sheet scrolls sideways', async ({ page }) => {
    await openOrganiser(page, '/account/o');
    await expect(page.getByTestId('home-strip-lineup')).toBeVisible();
    await expectNoHorizontalScroll(page);
    for (const [path, ready] of [
      ['/account/o/events', 'org-event-row'],
      ['/account/o/events/new', 'org-new-event-name'],
      [`/account/o/events/${FRIDAY}`, 'org-schedule-session'],
      [`/account/o/events/${FRIDAY}/dates/${OCC}`, 'session-row'],
      ['/account/o/team', 'access-request'],
      ['/account/o/profile', 'profile-name'],
    ]) {
      await page.goto(path);
      await expect(page.getByTestId(ready).first()).toBeVisible();
      await expectNoHorizontalScroll(page);
    }
    await page.goto(`/account/o/events/${FRIDAY}/dates/${OCC}`);
    await page.getByTestId('session-row-open').first().click();
    await page.getByTestId('session-add-person').click();
    await page.getByTestId('people-search').fill('ev');
    await expect(page.getByTestId('people-result').first()).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});

test.describe('two columns @1280x800', () => {
  test.use({ viewport: WIDE });

  test('the event editor shows the list left and the editor right', async ({ page }) => {
    await openOrganiser(page, `/account/o/events/${FRIDAY}`);
    const list = page.getByTestId('org-list');
    const detail = page.getByTestId('org-detail');
    await expect(list).toBeVisible();
    await expect(detail).toBeVisible();
    await expect(list.getByTestId('org-event-row')).toHaveCount(2);
    await expect(detail.getByTestId('org-event-editor')).toBeVisible();
    const l = (await list.boundingBox())!;
    const d = (await detail.boundingBox())!;
    expect(l.x + l.width).toBeLessThanOrEqual(d.x + 1);
    expect(l.width).toBeGreaterThanOrEqual(260);
    expect(l.width).toBeLessThanOrEqual(340);
    expect(d.width).toBeGreaterThan(l.width);
    // Both columns start at the same height: side by side, not stacked.
    expect(Math.abs(l.y - d.y)).toBeLessThan(40);
    await expectNoHorizontalScroll(page);
  });

  test('on a phone the same URL shows only the editor', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await openOrganiser(page, `/account/o/events/${FRIDAY}`);
    await expect(page.getByTestId('org-event-editor')).toBeVisible();
    await expect(page.getByTestId('org-list')).toBeHidden();
  });
});
