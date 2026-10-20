import { test, expect, type Page } from '@playwright/test';
import { FRIDAY, ORG, PHONE, openOrganiser } from './helpers/organiserFake';

// Events (W2) at /account/o/events*: the one-question New event (S4, /account/o/new/*, a draft
// first, then venue, date, time and cover), My events, one event with its ?do= steps, and
// Details with its one-field ?edit= saves (S5). The editor and its 30-date Extend rows are gone
// (the cap is enforced by Add a date, S3). Every write is asserted by
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
  await expect(page.getByTestId('org-new-live-reason')).toHaveText('Choose a photo first.');
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

// My events (S5, C33): every listed series as a row with Home's own chip; a tap opens the event.
test('My events: each event is a row with its chip, and a tap opens that event', async ({ page }) => {
  await openOrganiser(page, '/account/o/events');
  await expect(page.getByTestId('org-event-list')).toBeVisible();
  const row = page.getByTestId('org-event-row').filter({ hasText: 'Friday Bachata' });
  await expect(row).toHaveCount(1);
  const chip = (await row.getByTestId('org-event-chip').textContent())?.trim();
  expect(chip).toBeTruthy();
  await row.click();
  await expect(page).toHaveURL(new RegExp(`/account/o/events/${FRIDAY}$`));
  await expect(page.getByTestId('org-page-event')).toBeVisible();
  await expect(page.getByTestId('org-event-title').getByTestId('org-event-chip')).toHaveText(chip!);
});

// One event (C36): Home's next dates, then "N more" counted from the workspace (12 Fridays to 25 Dec).
test('one event: the coming dates lead, the rest is "N more", the title opens Details', async ({ page }) => {
  const fake = await openOrganiser(page, `/account/o/events/${FRIDAY}`);
  await expect(page.getByTestId('org-event-title')).toContainText('Friday Bachata');
  const shown = await page.getByTestId('org-coming-date').count();
  expect(shown).toBeGreaterThan(0);
  await expect(page.getByTestId('org-coming-date').first()).toContainText('9 Oct');
  await expect(page.getByTestId('org-coming-more')).toHaveText(`${12 - shown} more`);
  await expect(page.getByTestId('org-month')).toBeVisible();
  await page.getByTestId('org-event-title').click();
  await expect(page).toHaveURL(new RegExp(`/account/o/events/${FRIDAY}/details$`));
  expect(fake.envelopes()).toHaveLength(0);
});

// C42a: Pause is its own step on the event's route; ONE series.set_lifecycle, then Done.
test('one event: ?do=pause sends ONE set_lifecycle to paused and lands on Done', async ({ page }) => {
  const fake = await openOrganiser(page, `/account/o/events/${FRIDAY}`);
  await page.getByTestId('org-event-pause').click();
  await expect(page).toHaveURL(new RegExp(`/account/o/events/${FRIDAY}\\?do=pause$`));
  expect(fake.envelopes()).toHaveLength(0);
  await page.getByTestId('event-step-send').click();
  await expect(page.getByTestId('org-done')).toBeVisible();
  expect(fake.envelopes()).toHaveLength(1);
  const [env] = fake.envelopes();
  expect(env.target_id).toBe(FRIDAY);
  expect(env.expected_version).toBe(3);
  expect(env.command).toEqual({ kind: 'series.set_lifecycle', payload: { to: 'paused' } });
  expect(fake.series.get(FRIDAY)!.lifecycle_status).toBe('paused');
});

// C37: one field, one box; Save is off until the value differs, then ONE upsert with name + that field.
test('details: ?edit=about saves ONE upsert of the name and the about text', async ({ page }) => {
  const fake = await openOrganiser(page, `/account/o/events/${FRIDAY}/details`);
  await page.getByTestId('org-detail-about').click();
  await expect(page).toHaveURL(new RegExp(`/account/o/events/${FRIDAY}/details\\?edit=about$`));
  const save = page.getByTestId('org-detail-save');
  await expect(save).toBeDisabled();
  await expect(page.getByTestId('event-step-reason')).toHaveText('Nothing changed yet');
  expect(fake.envelopes()).toHaveLength(0);
  await page.getByTestId('org-detail-input').fill('Beginners welcome');
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByTestId('org-done')).toBeVisible();
  expect(fake.envelopes()).toHaveLength(1);
  expect(fake.envelopes()[0].command).toEqual({ kind: 'series.upsert', payload: { name: 'Friday Bachata', default_description: 'Beginners welcome' } });
  expect(fake.series.get(FRIDAY)!.version).toBe(4);
});

test('details: a refused save says why in plain words and keeps the text', async ({ page }) => {
  const fake = await openOrganiser(page, `/account/o/events/${FRIDAY}/details?edit=about`, {}, (f) => f.refuse('series_command_p5', 'daily_edit_cap'));
  await page.getByTestId('org-detail-input').fill('Beginners welcome');
  await page.getByTestId('org-detail-save').click();
  const msg = page.getByTestId('event-step-error');
  await expect(msg).toBeVisible();
  await expect(msg).not.toContainText('daily_edit_cap');
  await expect(page.getByTestId('org-detail-input')).toHaveValue('Beginners welcome');
  expect(fake.envelopes()).toHaveLength(1);
});

// The schedule card moved from the old editor to Details (C37, the existing EditorRows.ScheduleCard);
// a session opens that date's line-up (ORG_PATHS.dateLineup, S2).
test('details: the schedule card shows the sessions of the next date with their people and opens that date', async ({ page }) => {
  await openOrganiser(page, `/account/o/events/${FRIDAY}/details`);
  await expect(page.getByTestId('org-schedule')).toBeVisible();
  const rows = page.getByTestId('org-schedule-session');
  await expect(rows.first()).toContainText('Beginners');
  await expect(rows.first()).toContainText('Ana Ruiz');
  await expect(rows.nth(1)).toContainText('DJ Sol');
  await rows.first().click();
  await expect(page).toHaveURL(new RegExp(`/account/o/change/${FRIDAY}/c0000001-0000-4000-8000-202610090000/lineup$`));
});

test('New event: an organiser not approved yet cannot create, and is told why', async ({ page }) => {
  const fake = await openOrganiser(page, '/account/o/new/name?format=one_off', { organiserStatus: 'draft' });
  await expect(page.getByTestId('org-new-blocked')).toBeVisible();
  await expect(page.getByTestId('org-new-name')).toHaveCount(0);
  expect(fake.envelopes()).toHaveLength(0);
});
