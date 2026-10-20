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
    // The New event steps (S4) name their shells org-new-*, the event steps (S5) event-step, not org-page-*.
    const roots = Array.from(document.querySelectorAll('[data-testid^="org-page-"], [data-testid="org-new-what"], [data-testid="org-new-name-step"], [data-testid="event-step"], [role="dialog"]'));
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

// `min`: how many controls the screen must hold, so an empty measure never passes. A locked
// (ended) Details screen holds only the header's back and account controls.
async function expectTapTargets(page: Page, min = 3) {
  // Let entrance motion (0.3s) finish before measuring.
  await page.waitForTimeout(400);
  const found = await controls(page);
  expect(found.length, 'the screen has controls to measure').toBeGreaterThanOrEqual(min);
  expect(found.filter((c) => c.h < MIN - 0.5), `controls under ${MIN}px high`).toEqual([]);
  await expectNoHorizontalScroll(page);
}

test.describe('tap targets @390', () => {
  test.use({ viewport: PHONE });

  test('Home', async ({ page }) => {
    await openOrganiser(page, '/account/o');
    await expect(page.getByTestId('home-jobs')).toBeVisible();
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
    // C33: a populated list is rows only; New event is the empty state's one action (and Home's).
    await expect(page.getByTestId('org-event-row').first()).toBeVisible();
    await expectTapTargets(page);
    await page.goto('/account/o/new/what');
    await expect(page.getByTestId('org-new-format-recurring')).toBeVisible();
    await expectTapTargets(page);
    await page.getByTestId('org-new-format-recurring').click();
    await expect(page.getByTestId('org-new-name')).toBeVisible();
    await expectTapTargets(page);
  });

  test('one event, its Details and a one-field edit', async ({ page }) => {
    await openOrganiser(page, `/account/o/events/${FRIDAY}`);
    await expect(page.getByTestId('org-coming-date').first()).toBeVisible();
    await expectTapTargets(page);
    await page.goto(`/account/o/events/${FRIDAY}/details`);
    await expect(page.getByTestId('org-schedule-session').first()).toBeVisible();
    await expectTapTargets(page);
    // The edit step holds two controls (the box and Save), under the helper's floor of three: measure them directly.
    await page.goto(`/account/o/events/${FRIDAY}/details?edit=about`);
    await expect(page.getByTestId('org-detail-input')).toBeVisible();
    for (const id of ['org-detail-input', 'org-detail-save']) expect((await page.getByTestId(id).boundingBox())!.height).toBeGreaterThanOrEqual(MIN - 0.5);
    await expectNoHorizontalScroll(page);
  });

  test('date editor, session view and people search', async ({ page }) => {
    await openOrganiser(page, `/account/o/change/${FRIDAY}/${OCC}/lineup`);
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
    await expect(page.getByTestId('join-request')).toHaveCount(2);
    await expectTapTargets(page);
  });

  // S7 replaced the profile editor with /page (edit in place, D4: no review button) and /more.
  test('Page and More', async ({ page }) => {
    await openOrganiser(page, '/account/o/page');
    await expect(page.getByTestId('page-name')).toBeVisible();
    await expectTapTargets(page);
    await page.goto('/account/o/more');
    await expect(page.getByTestId('more-add-page')).toBeVisible();
    await expectTapTargets(page);
  });

  // F4 (owner on a phone): nothing unsaved -> one line + the disabled button, under 64px,
  // no preview card. (The event editor and its bar went with S5: Details saves one field at a time;
  // the profile editor and its bar went with S7: /page shows no bar until something is drafted.)
  test('nothing unsaved: the action bar is a slim bar under 64px on the date editor, and /page shows none', async ({ page }) => {
    await openOrganiser(page, `/account/o/change/${FRIDAY}/${OCC}/lineup`);
    await expect(page.getByTestId('session-row')).toHaveCount(2);
    expect(await barHeight(page)).toBeLessThan(64);
    await expect(page.getByTestId('date-preview-bar-preview')).toHaveCount(0);

    await page.goto('/account/o/page');
    await expect(page.getByTestId('page-name')).toBeVisible();
    await expect(page.getByTestId('eip-bar')).toHaveCount(0);
  });

  // S5: the ended event (the Bachata Picnic shape) on OneEvent and Details: nothing offered that
  // cannot work -- no coming dates, no Add a date, no Pause/End rows -- and Details reads only, with the lock line.
  test('an ended repeating event (the Bachata Picnic shape) reads true and offers nothing that cannot work', async ({ page }) => {
    await openOrganiser(page, `/account/o/events/${PICNIC}`, {}, addPicnic);
    await expect(page.getByTestId('org-event-title')).toContainText('Park Social');
    await expect(page.getByTestId('org-coming-none')).toBeVisible();
    await expect(page.getByTestId('org-coming-add')).toHaveCount(0);
    for (const step of ['pause', 'resume', 'end', 'day', 'stop']) await expect(page.getByTestId(`org-event-${step}`)).toHaveCount(0);
    await expectTapTargets(page);
    await page.getByTestId('org-event-title').click();
    await expect(page.getByTestId('org-detail-lock')).toContainText('To run it again, ask the Bachata Calendar team.');
    await expect(page.getByTestId('org-detail-venue')).toBeVisible();
    // Every row reads only, the Cover row too (REVIEW-S5 NOTE-5).
    await expect(page.getByTestId('org-detail-cover')).toBeVisible();
    await expect(page.locator('a[data-testid^="org-detail-"]')).toHaveCount(0);
    await expect(page.getByTestId('org-page-details')).not.toContainText('Extend');
    await expectTapTargets(page, 2);
    // A stale ?edit= link on an ended event shows the read-only rows, never a box.
    await page.goto(`/account/o/events/${PICNIC}/details?edit=about`);
    await expect(page.getByTestId('org-detail-lock')).toBeVisible();
    await expect(page.getByTestId('org-detail-input')).toHaveCount(0);
  });

  // No screen scrolls sideways at 390 (sheets are covered by the tap-target cases above).
  test('no screen or sheet scrolls sideways', async ({ page }) => {
    await openOrganiser(page, '/account/o');
    await expect(page.getByTestId('home-jobs')).toBeVisible();
    await expectNoHorizontalScroll(page);
    for (const [path, ready] of [
      ['/account/o/events', 'org-event-row'],
      ['/account/o/new/what', 'org-new-format-recurring'],
      ['/account/o/new/name?format=recurring', 'org-new-name'],
      [`/account/o/events/${FRIDAY}`, 'org-coming-date'],
      [`/account/o/events/${FRIDAY}/details`, 'org-schedule-session'],
      [`/account/o/events/${FRIDAY}?do=end`, 'event-step'],
      [`/account/o/change/${FRIDAY}/${OCC}/lineup`, 'session-row'],
      ['/account/o/team', 'join-request'],
      ['/account/o/page', 'page-name'],
      ['/account/o/more', 'more-add-page'],
      ['/account/o/more/help', 'org-page-help'],
    ]) {
      await page.goto(path);
      await expect(page.getByTestId(ready).first()).toBeVisible();
      await expectNoHorizontalScroll(page);
    }
    await page.goto(`/account/o/change/${FRIDAY}/${OCC}/lineup`);
    await page.getByTestId('session-row-open').first().click();
    await page.getByTestId('session-add-person').click();
    await page.getByTestId('people-search').fill('ev');
    await expect(page.getByTestId('people-result').first()).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});

test.describe('two columns @1280x800', () => {
  test.use({ viewport: WIDE });

  test('one event shows the list left and the event right', async ({ page }) => {
    await openOrganiser(page, `/account/o/events/${FRIDAY}`);
    const list = page.getByTestId('org-list');
    const detail = page.getByTestId('org-detail');
    await expect(list).toBeVisible();
    await expect(detail).toBeVisible();
    await expect(list.getByTestId('org-event-row')).toHaveCount(2);
    await expect(detail.getByTestId('org-event-title')).toBeVisible();
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

  test('on a phone the same URL shows only the event', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await openOrganiser(page, `/account/o/events/${FRIDAY}`);
    await expect(page.getByTestId('org-event-title')).toBeVisible();
    await expect(page.getByTestId('org-list')).toBeHidden();
  });
});
