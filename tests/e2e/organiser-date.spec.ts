import { test, expect, type Page } from '@playwright/test';
import { FRIDAY, PHONE, openOrganiser, setKeyboard } from './helpers/organiserFake';

// The date editor (W3) at /account/o/events/:seriesId/dates/:occurrenceId at 390x844: the
// SCHEDULE of sessions, people by session type, the people search as a VIEW of the one sheet
// (inside the visible viewport with the on-screen keyboard up: PR #653's failure), remove +
// Undo (stored) and Collapse (added), and the save followed by a re-read in which the writer
// re-created the date-only session under a NEW id: the line-up must still show (#653 again).
// Replaces the old date sheet / programme coverage in organiser-series.spec.ts (deleted UI).

test.use({ viewport: PHONE });

const OCC = 'c0000001-0000-4000-8000-202610090000';
const PATH = `/account/o/events/${FRIDAY}/dates/${OCC}`;

const row = (page: Page, name: string) =>
  page.getByTestId('session-row').filter({ has: page.getByTestId('session-row-name').getByText(name, { exact: true }) });

async function openDate(page: Page) {
  const fake = await openOrganiser(page, PATH);
  await expect(page.getByTestId('org-page-date')).toBeVisible();
  await expect(page.getByTestId('session-row')).toHaveCount(2);
  return fake;
}

async function openSession(page: Page, name: string) {
  await row(page, name).getByTestId('session-row-open').click();
  await expect(page.getByTestId('date-sheet')).toHaveAttribute('data-view', /^session:/);
}

test('the schedule shows each session with its people; the date time follows the sessions', async ({ page }) => {
  await openDate(page);
  await expect(row(page, 'Beginners').getByTestId('session-row-people')).toHaveText('Ana Ruiz');
  await expect(row(page, 'Party').getByTestId('session-row-people')).toHaveText('DJ Sol');
  await expect(page.getByTestId('date-span')).toContainText('20:00–23:30');
  await expect(page.getByTestId('date-preview-bar-action')).toBeDisabled();
});

test('people by type: class and masterclass add teachers, party adds DJs, performance has no add', async ({ page }) => {
  await openDate(page);
  await openSession(page, 'Beginners');
  await expect(page.getByTestId('session-add-person')).toContainText('Add a teacher');
  await page.getByTestId('date-sheet-done').click();
  await expect(page.getByTestId('date-sheet')).toHaveCount(0);

  await openSession(page, 'Party');
  await expect(page.getByTestId('session-add-person')).toContainText('Add a DJ');
  await page.getByTestId('date-sheet-done').click();

  // A new session can take any type; the add control follows the type.
  await page.getByTestId('date-add-session').click();
  await page.getByTestId('session-type-masterclass').click();
  await expect(page.getByTestId('session-add-person')).toContainText('Add a teacher');
  await page.getByTestId('session-type-party').click();
  await expect(page.getByTestId('session-add-person')).toContainText('Add a DJ');
  await page.getByTestId('session-type-performance').click();
  await expect(page.getByTestId('session-add-person')).toHaveCount(0);
  await expect(page.getByTestId('session-people-team')).toBeVisible();
  await page.getByTestId('session-type-class').click();
  await expect(page.getByTestId('session-add-person')).toContainText('Add a teacher');

  // The search only ever offers the session's role.
  await page.getByTestId('session-add-person').click();
  await page.getByTestId('people-search').fill('dj');
  await expect(page.getByTestId('people-search-empty')).toBeVisible();
  await expect(page.getByTestId('people-result')).toHaveCount(0);
});

test('search is a view of the one sheet and stays inside the visible viewport with the keyboard up', async ({ page }) => {
  const fake = await openDate(page);
  await openSession(page, 'Beginners');
  await page.getByTestId('session-add-person').click();
  const sheet = page.getByTestId('date-sheet');
  await expect(sheet).toHaveAttribute('data-view', /^search:/);
  const input = page.getByTestId('people-search');
  await expect(input).toBeFocused();
  await expect(page.locator('[role="dialog"]')).toHaveCount(1);

  await setKeyboard(page, 300); // 844 - 300 = 544px visible above the keyboard
  // Ana is already on the session: not offered again.
  await input.fill('an');
  await expect.poll(() => fake.sent('organiser_search_people_v1').some((b) => b.p_query === 'an')).toBe(true);
  await expect(page.getByTestId('people-result').filter({ hasText: 'Ana Ruiz' })).toHaveCount(0);
  await input.fill('');
  await input.pressSequentially('ev');
  const first = page.getByTestId('people-result').first();
  await expect(first).toContainText('Eva Sol');
  expect(fake.sent('organiser_search_people_v1').at(-1)).toMatchObject({ p_query: 'ev', p_role: 'teaching' });

  const visible = 544;
  // Let the sheet settle at its keyboard height (0.3s motion).
  await page.waitForTimeout(400);
  for (const el of [sheet, input, first]) {
    const box = (await el.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(visible + 1);
  }

  await first.click();
  await expect(sheet).toHaveAttribute('data-view', /^session:/);
  await expect(page.getByTestId('session-person')).toHaveCount(2);
  await expect(page.getByTestId('session-person').nth(1)).toContainText('Eva Sol');
});

test('remove + undo: a stored person greys with Undo; an added one collapses away', async ({ page }) => {
  await openDate(page);
  await openSession(page, 'Beginners');
  const ana = page.getByTestId('session-person').first();
  await ana.getByTestId('session-person-remove').click();
  await expect(ana).toHaveAttribute('data-removed', 'true');
  await expect(ana).toContainText('Comes off when you save');
  await ana.getByTestId('session-person-undo').click();
  await expect(ana).not.toHaveAttribute('data-removed', /.*/);

  await page.getByTestId('session-add-person').click();
  await page.getByTestId('people-search').fill('cleo');
  await page.getByTestId('people-result').first().click();
  await expect(page.getByTestId('session-person')).toHaveCount(2);
  await page.getByTestId('session-person').nth(1).getByTestId('session-person-remove').click();
  // Collapse: fades and shrinks to 0, then unmounts.
  await expect(page.getByTestId('session-person')).toHaveCount(1);
  await page.getByTestId('date-sheet-done').click();
  await expect(page.getByTestId('date-preview-bar-action')).toBeDisabled();

  // A stored session greys with Undo on the schedule until the save.
  await openSession(page, 'Party');
  await page.getByTestId('session-remove').click();
  await expect(row(page, 'Party')).toHaveAttribute('data-removed', 'true');
  await row(page, 'Party').getByTestId('session-row-undo').click();
  await expect(row(page, 'Party')).not.toHaveAttribute('data-removed', /.*/);
  await expect(page.getByTestId('date-preview-bar-action')).toBeDisabled();
});

test('add a session with a teacher, save: the re-read (new session id) still shows the line-up', async ({ page }) => {
  const fake = await openDate(page);
  await page.getByTestId('date-add-session').click();
  await page.getByTestId('session-type-masterclass').click();
  await page.getByTestId('session-name').fill('Footwork Masterclass');
  await page.getByTestId('session-start').fill('18:30');
  await page.getByTestId('session-end').fill('19:45');
  await page.getByTestId('session-add-person').click();
  await page.getByTestId('people-search').fill('eva');
  await page.getByTestId('people-result').first().click();
  await page.getByTestId('date-sheet-done').click();

  await expect(row(page, 'Footwork Masterclass').getByTestId('session-row-people')).toHaveText('Eva Sol');
  const action = page.getByTestId('date-preview-bar-action');
  await expect(action).toBeEnabled();
  await action.click();

  await expect.poll(() => fake.sent('organiser_set_occurrence_programme_v1').length).toBe(1);
  const [save] = fake.sent('organiser_set_occurrence_programme_v1');
  expect(save.p_expected_version).toBe(1);
  const sent = save.p_sessions as Record<string, unknown>[];
  expect(sent).toHaveLength(3);
  expect(sent[2]).toMatchObject({ new: true, type: 'masterclass', title: 'Footwork Masterclass', start_time: '18:30', end_time: '19:45' });
  expect(sent[2].people_add).toEqual([{ profile_id: 'e0000000-0000-4000-8000-000000000003', role: 'teaching' }]);

  // The writer gave the session an id; the screen re-read and still shows its people.
  const firstId = fake.programmes.get(OCC)!.sessions.find((s) => s.title === 'Footwork Masterclass')!.added_session_id;
  expect(firstId).toBeTruthy();
  await expect(action).toBeDisabled();
  await expect(row(page, 'Footwork Masterclass').getByTestId('session-row-people')).toHaveText('Eva Sol');
  await expect(row(page, 'Beginners').getByTestId('session-row-people')).toHaveText('Ana Ruiz');
  await expect(page.getByTestId('date-span')).toContainText('18:30–23:30');

  // A second save re-creates the date-only session under ANOTHER id: still no empty line-up.
  await openSession(page, 'Footwork Masterclass');
  await page.getByTestId('session-name').fill('Footwork Lab');
  await page.getByTestId('date-sheet-done').click();
  await action.click();
  await expect.poll(() => fake.sent('organiser_set_occurrence_programme_v1').length).toBe(2);
  const second = fake.sent('organiser_set_occurrence_programme_v1')[1].p_sessions as Record<string, unknown>[];
  expect(second[2]).toMatchObject({ added_session_id: firstId, title: 'Footwork Lab' });
  const secondId = fake.programmes.get(OCC)!.sessions.find((s) => s.title === 'Footwork Lab')!.added_session_id;
  expect(secondId).not.toBe(firstId);
  await expect(row(page, 'Footwork Lab').getByTestId('session-row-people')).toHaveText('Eva Sol');
  await expect(action).toBeDisabled();
});

test('cancel a date: needs a reason and the tick, sends occurrence.cancel, then reads Cancelled', async ({ page }) => {
  const fake = await openDate(page);
  await page.getByTestId('date-cancel').click();
  const confirm = page.getByTestId('date-cancel-confirm');
  await expect(confirm).toBeDisabled();
  await page.getByTestId('cancel-reason').first().click();
  await page.getByTestId('cancel-ack').click();
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect.poll(() => fake.envelopes('occurrence_command_p5').length).toBe(1);
  expect(fake.envelopes('occurrence_command_p5')[0]).toMatchObject({ target_id: OCC, command: { kind: 'occurrence.cancel', payload: { cancelled: true, reason: 'Venue closed' } } });
  await expect(page.getByTestId('date-cancelled-note')).toBeVisible();
  await expect(page.getByTestId('date-uncancel')).toBeVisible();
});

test('break this week sends series.skip_date and goes back to the event; unsaved edits block it', async ({ page }) => {
  const fake = await openDate(page);
  await openSession(page, 'Beginners');
  await page.getByTestId('session-person').first().getByTestId('session-person-remove').click();
  await page.getByTestId('date-sheet-done').click();
  await expect(page.getByTestId('date-break')).toBeDisabled();
  await expect(page.getByTestId('date-cancel')).toBeDisabled();
  await openSession(page, 'Beginners');
  await page.getByTestId('session-person').first().getByTestId('session-person-undo').click();
  await page.getByTestId('date-sheet-done').click();

  await page.getByTestId('date-break').click();
  await page.getByTestId('date-break-confirm').click();
  await expect(page).toHaveURL(new RegExp(`/account/o/events/${FRIDAY}$`));
  expect(fake.envelopes()[0]).toMatchObject({ target_id: FRIDAY, expected_version: 3, command: { kind: 'series.skip_date', payload: { occurrence_id: OCC } } });
  // The event's date list no longer has 9 Oct.
  await expect(page.locator('[data-testid="org-date-row"][data-date="2026-10-09"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="org-date-row"][data-date="2026-10-16"]')).toHaveCount(1);
});

test('a week off shows under "Dates taken off" on the event page, and Put back brings it back', async ({ page }) => {
  const fake = await openDate(page);
  await page.getByTestId('date-break').click();
  // The sheet names the control that really exists.
  await expect(page.getByTestId('date-break-undo')).toHaveText('You can put it back later from "Dates taken off" on the event page.');
  await page.getByTestId('date-break-confirm').click();
  await expect(page).toHaveURL(new RegExp(`/account/o/events/${FRIDAY}$`));

  const section = page.getByTestId('org-taken-off');
  await expect(section).toContainText('Dates taken off (1)');
  const row = section.locator('[data-testid="org-taken-off-row"][data-date="2026-10-09"]');
  await expect(row).toHaveCount(1);
  const putBack = row.getByTestId('org-taken-off-put-back');
  await putBack.scrollIntoViewIfNeeded();
  const box = await putBack.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await putBack.click();
  await expect.poll(() => fake.envelopes().length).toBe(2);
  expect(fake.envelopes()[1]).toMatchObject({ target_id: FRIDAY, expected_version: 4, command: { kind: 'series.unskip_date', payload: { date: '2026-10-09' } } });
  // Back in the dates list; the section hides once nothing is taken off.
  await expect(page.locator('[data-testid="org-date-row"][data-date="2026-10-09"]')).toHaveCount(1);
  await expect(page.getByTestId('org-taken-off')).toHaveCount(0);
});
