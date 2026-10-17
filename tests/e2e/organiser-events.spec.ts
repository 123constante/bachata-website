import { test, expect, type Page } from '@playwright/test';
import { FRIDAY, ORG, PHONE, openOrganiser } from './helpers/organiserFake';

// Events (W2) at /account/o/events*: the one-question New event (S4, /account/o/new/*, a draft
// first, then venue, date, time and cover), the editor's summary rows + the ONE save button in the preview bar, and
// the 30-upcoming-date cap ('Listed until <date> - Extend', end choices within 30). Replaces
// the old /account/new and /account/series/:id specs (deleted UI). Every write is asserted by
// the exact envelope sent to series_command_p5 (helpers/organiserFake.ts), then the screen is
// checked to show what the fake now holds.

test.use({ viewport: PHONE });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// New event (S4, C19-C23): the one-question flow at /account/o/new/*. It replaced the
// name-only NewEventPage (and its create-button layout specs). Each step sends only its own
// commands, through series_command_p5; the cover step needs a photo before Go live.
const walkToVenue = async (page: Page, format: 'recurring' | 'one_off', name: string) => {
  await expect(page.getByTestId('org-new-what')).toBeVisible();
  await page.getByTestId(`org-new-format-${format}`).click();
  await expect(page).toHaveURL(new RegExp(`/account/o/new/name\\?format=${format}$`));
  await page.getByTestId('org-new-name').fill(name);
  await page.getByTestId('org-new-next').click();
  await expect(page).toHaveURL(/\/account\/o\/new\/[0-9a-f-]{36}\/venue$/);
  const id = page.url().split('/').slice(-2)[0];
  expect(id).toMatch(UUID);
  return id;
};

test('New event: a weekly night walks what, name, venue, date and time, each step sending only its own commands', async ({ page }) => {
  const fake = await openOrganiser(page, '/account/o/new/what');
  await expect(page.locator('[data-testid^="org-new-format-"]')).toHaveCount(2);
  await page.getByTestId('org-new-format-recurring').click();
  // Next is off with its reason until there is a name; nothing is sent.
  await expect(page.getByTestId('org-new-next')).toBeDisabled();
  await expect(page.getByTestId('org-new-next-reason')).toBeVisible();
  expect(fake.envelopes()).toHaveLength(0);
  await page.goto('/account/o/new/what');
  const id = await walkToVenue(page, 'recurring', 'Thursday Bachata Class');

  const [create] = fake.envelopes();
  expect(create.target_id).toBe(id);
  expect(create.command.kind).toBe('series.upsert');
  expect(create.command.payload).toMatchObject({ name: 'Thursday Bachata Class', format: 'recurring', timezone: 'Europe/London', organiser_ids: [ORG] });
  expect(fake.series.get(id)!.lifecycle_status).toBe('draft');

  await page.getByTestId('org-new-venue-row').first().click();
  await expect(page).toHaveURL(new RegExp(`/account/o/new/${id}/date$`));
  expect(fake.envelopes()).toHaveLength(2);
  expect(fake.envelopes()[1].command.kind).toBe('series.upsert');
  expect(fake.envelopes()[1].command.payload).toHaveProperty('default_venue_id');

  await page.getByTestId('org-new-date-row').first().click();
  await expect(page).toHaveURL(new RegExp(`/account/o/new/${id}/time$`));
  // A weekly night: ONE upsert of the first date, then ONE weekly rule on that weekday (D55).
  const afterDate = fake.envelopes().slice(2).map((e) => e.command.kind);
  expect(afterDate).toEqual(['series.upsert', 'series.set_recurrence']);
  expect(fake.envelopes()[2].command.payload).toHaveProperty('default_start_date');

  await expect(page.getByTestId('org-new-next')).toBeDisabled();
  await page.getByTestId('org-new-time').fill('20:30');
  await page.getByTestId('org-new-next').click();
  await expect(page).toHaveURL(new RegExp(`/account/o/new/${id}/cover$`));
  // Go live is off until a photo is chosen, and says so.
  await expect(page.getByTestId('org-new-live')).toBeDisabled();
  await expect(page.getByTestId('org-new-live-reason')).toHaveText('Choose a photo to go live.');
  expect(fake.series.get(id)!.lifecycle_status).toBe('draft');
});

test('New event: a one night sends no weekly rule', async ({ page }) => {
  const fake = await openOrganiser(page, '/account/o/new/what');
  const id = await walkToVenue(page, 'one_off', 'Saturday Social');
  expect(fake.envelopes()[0].command.payload).toMatchObject({ name: 'Saturday Social', format: 'one_off' });
  await page.getByTestId('org-new-venue-row').first().click();
  await expect(page).toHaveURL(new RegExp(`/account/o/new/${id}/date$`));
  await page.getByTestId('org-new-date-row').first().click();
  await expect(page).toHaveURL(new RegExp(`/account/o/new/${id}/time$`));
  expect(fake.envelopes().map((e) => e.command.kind)).toEqual(['series.upsert', 'series.upsert', 'series.upsert']);
});

// The old /account/o/events/new link still works: it lands on the first question.
test('New event: the legacy events/new link opens the first question', async ({ page }) => {
  await openOrganiser(page, '/account/o/events/new');
  await expect(page).toHaveURL(/\/account\/o\/new\/what$/);
  await expect(page.getByTestId('org-new-what')).toBeVisible();
});

test('editor: summary rows edit the draft, the preview follows, ONE save sends only what changed', async ({ page }) => {
  const fake = await openOrganiser(page, `/account/o/events/${FRIDAY}`);
  await expect(page.getByTestId('org-event-editor')).toBeVisible();
  const action = page.getByTestId('org-preview-bar-action');
  await expect(action).toBeDisabled();
  // Nothing unsaved: the slim bar only (F4); the card and the live note come with the first edit.
  await expect(page.getByTestId('org-card-preview')).toHaveCount(0);

  await page.getByTestId('org-event-name').fill('Friday Fiesta');
  await expect(page.getByTestId('org-card-preview')).toContainText('Friday Fiesta');
  await expect(page.getByTestId('org-preview-bar')).toContainText('Guests see changes to live events straight away.');

  await page.getByTestId('org-row-description').click();
  await page.getByTestId('org-description-input').fill('Beginners welcome');
  await page.getByTestId('org-sheet-done').click();
  await expect(page.getByTestId('org-editor-sheet')).toHaveCount(0);

  await page.getByTestId('org-row-ticket').click();
  await page.getByTestId('org-ticket-input').fill('https://tickets.example/fiesta');
  await page.getByTestId('org-sheet-done').click();

  const salsa = page.getByTestId('org-style-chip').filter({ hasText: /^Salsa$/ });
  await salsa.click();
  await expect(salsa).toHaveAttribute('aria-pressed', 'true');

  await expect(action).toBeEnabled();
  await action.click();
  await expect.poll(() => fake.envelopes().length).toBe(1);
  const [env] = fake.envelopes();
  expect(env.target_id).toBe(FRIDAY);
  expect(env.expected_version).toBe(3);
  expect(env.command).toEqual({
    kind: 'series.upsert',
    payload: { name: 'Friday Fiesta', default_description: 'Beginners welcome', default_ticket_url: 'https://tickets.example/fiesta', default_music_styles: ['Bachata', 'Salsa'] },
  });
  // Saved and re-read: the button is idle again and the fake's values are on screen.
  await expect(action).toBeDisabled();
  await expect(page.getByTestId('org-event-name')).toHaveValue('Friday Fiesta');
  expect(fake.series.get(FRIDAY)!.version).toBe(4);
});

test('editor: a refused save shakes, says why in plain words and keeps the edit', async ({ page }) => {
  const fake = await openOrganiser(page, `/account/o/events/${FRIDAY}`, {}, (f) => f.refuse('series_command_p5', 'daily_edit_cap'));
  await page.getByTestId('org-event-name').fill('Friday Fiesta');
  await page.getByTestId('org-preview-bar-action').click();
  const msg = page.getByTestId('org-save-error');
  await expect(msg).toBeVisible();
  await expect(msg).not.toContainText('daily_edit_cap');
  await expect(page.getByTestId('org-event-name')).toHaveValue('Friday Fiesta');
  expect(fake.envelopes()).toHaveLength(1);
});

test('30-date cap: end choices stay within 30 upcoming dates; Extend lists 8 more and saves the rule', async ({ page }) => {
  const fake = await openOrganiser(page, `/account/o/events/${FRIDAY}`);
  const until = page.getByTestId('org-row-until');
  await expect(until).toContainText('Listed until Fri 25 Dec');
  await expect(until).toContainText('Up to 30 upcoming dates');
  await expect(page.getByTestId('org-date-row')).toHaveCount(12);

  await page.getByTestId('org-row-until-open').click();
  const sheet = page.getByTestId('org-sheet-until');
  await expect(sheet).toBeVisible();
  await expect(page.getByTestId('org-cap-note')).toBeVisible();
  const counts = (await sheet.getByTestId('org-until-choice').allTextContents()).map((t) => Number(t.match(/\d+/)?.[0]));
  expect(counts.length).toBeGreaterThan(1);
  for (const n of counts) expect(n).toBeLessThanOrEqual(30);
  expect(Math.max(...counts)).toBe(30);
  await page.getByTestId('org-sheet-done').click();

  await page.getByTestId('org-extend').click();
  await expect(until).toContainText('Listed until Fri 19 Feb');
  await page.getByTestId('org-preview-bar-action').click();
  await expect.poll(() => fake.envelopes().length).toBe(1);
  expect(fake.envelopes()[0].command).toEqual({
    kind: 'series.set_recurrence',
    payload: { mode: 'weekly', weekdays: [5], end: { kind: 'until_date', date: '2027-02-19' } },
  });
  // Re-read: 20 upcoming dates now listed.
  await expect(page.getByTestId('org-date-row')).toHaveCount(20);
});

test('30-date cap: Extend is off when 30 upcoming dates are listed', async ({ page }) => {
  await openOrganiser(page, `/account/o/events/${FRIDAY}`, {}, (f) => {
    f.series.get(FRIDAY)!.recurrence_rule = { mode: 'weekly', weekdays: [5], end: { kind: 'until_date', date: '2027-04-30' } };
  });
  await expect(page.getByTestId('org-date-row')).toHaveCount(30);
  await expect(page.getByTestId('org-extend')).toBeDisabled();
});

// The owner's 2026-10-08 report, its exact shape: weekly Wednesdays from Wed 30 Dec, 41 dates
// listed (over the cap; the server keeps them all but adds no more). The date names its year,
// Extend is off and the reason on screen states the true count and the server's rule.
test('30-date cap: a series over 30 says so plainly, its end date has the year, Extend is off with the reason', async ({ page }) => {
  await openOrganiser(page, `/account/o/events/${FRIDAY}`, {}, (f) => {
    const s = f.series.get(FRIDAY)!;
    s.default_start_date = '2026-12-30';
    s.recurrence_rule = { mode: 'weekly', weekdays: [3], end: { kind: 'until_date', date: '2027-10-06' } };
  });
  await expect(page.getByTestId('org-date-row')).toHaveCount(41);
  const until = page.getByTestId('org-row-until');
  await expect(until).toContainText('Listed until Wed 6 Oct 2027');
  await expect(page.getByTestId('org-extend')).toBeDisabled();
  await expect(page.getByTestId('org-extend-note')).toHaveText('41 upcoming dates are listed, more than the 30 you can list. Extend is off until fewer than 30 are left.');
  await expect(until).not.toContainText('the most is');
  await until.scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath('over-cap-390.png'), fullPage: false });
  await page.getByTestId('org-row-until-open').click();
  await expect(page.getByTestId('org-cap-note')).not.toContainText('Extend later');
  await expect(page.getByTestId('org-cap-note')).toContainText('41 are listed now');
});

test('the schedule card shows the next date’s sessions with their people and opens that date', async ({ page }) => {
  await openOrganiser(page, `/account/o/events/${FRIDAY}`);
  const rows = page.getByTestId('org-schedule-session');
  await expect(rows.first()).toContainText('Beginners');
  await expect(rows.first()).toContainText('Ana Ruiz');
  await expect(rows.nth(1)).toContainText('DJ Sol');
  await rows.first().click();
  await expect(page).toHaveURL(new RegExp(`/account/o/events/${FRIDAY}/dates/c0000001-0000-4000-8000-202610090000$`));
});

test('New event: an organiser not approved yet cannot create, and is told why', async ({ page }) => {
  const fake = await openOrganiser(page, '/account/o/new/name?format=one_off', { organiserStatus: 'draft' });
  await expect(page.getByTestId('org-new-blocked')).toBeVisible();
  await expect(page.getByTestId('org-new-name')).toHaveCount(0);
  expect(fake.envelopes()).toHaveLength(0);
});
