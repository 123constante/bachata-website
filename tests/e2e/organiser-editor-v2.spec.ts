// WALK (Editor v2, slice S1), NOT in the test:e2e gate list: the v2 screens mount only with VITE_ENABLE_ORGANISER_EDITOR_V2
// at dev-server start. 390x844 on the organiser fake (weekly FRIDAY with an 80-character name, a cancelled night).
// Run: see MANUAL in scripts/check-e2e-spec-coverage.mjs.
import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { FRIDAY, OrganiserFake, PHONE, expectNoHorizontalScroll } from './helpers/organiserFake';

test.use({ viewport: PHONE });
const OUT = 'docs/design/editor-v2/shots';
mkdirSync(OUT, { recursive: true });
const LONG = 'Ritmo Friday Bachata Social with Beginners Class and Late Party in Central London'.slice(0, 80);

async function open(page: Page) {
  const fake = new OrganiserFake();
  const s = fake.series.get(FRIDAY)!;
  s.name = LONG;
  s.cancelled['2026-10-16'] = 'Venue issue';
  // a programme shaped like prod: end times, people, levels, a night-after session and one with no title or end time
  const ws = fake.workspace.bind(fake);
  fake.workspace = (x) => {
    const w = ws(x);
    (w.series as { program: unknown }).program = [{ sections: [{ items: [
      { item: { type: 'party', title: 'Late party', start_time: '01:00', end_time: '03:00' }, people: [{ profile_id: 'p3', display_name: 'DJ Rafa', profile_type: 'dj', role: 'djing' }] },
      { item: { type: 'class', title: 'Beginners bachata', start_time: '20:00', end_time: '21:00', level_keys: ['beginner'] },
        people: [{ profile_id: 'p1', display_name: 'Ana Lopez', profile_type: 'teacher', role: 'teaching' }, { profile_id: 'p2', display_name: 'Ben Cole', profile_type: 'teacher', role: 'teaching' }] },
      { item: { type: 'party', title: '', start_time: '21:00' } },
    ] }] }];
    (w.series.series as { organiser_ids?: string[] }).organiser_ids = [fake.organisers[0].id];
    return w;
  };
  await fake.install(page);
  // Who runs it: the organiser names read (organiser_profiles id=in.(...)), registered after the fake so it answers first
  await page.route(/\/rest\/v1\/organiser_profiles\?.*id=in\./, (route) => route.fulfill({
    json: [{ id: fake.organisers[0].id, name: fake.organisers[0].name, avatar_url: null }],
  }));
  await page.goto(`/account/p3/events/${FRIDAY}/edit`);
  await expect(page.getByTestId('v2-event')).toBeVisible({ timeout: 20_000 });
  return fake;
}

async function setText(page: Page, row: 'v2-name' | 'v2-about', text: string) {
  await page.getByTestId(row).click();
  await page.getByTestId(`${row}-input`).fill(text);
  await page.getByTestId('v2-sheet-done').click();
}

async function tapTargets(page: Page) {
  for (const b of await page.locator('.v2-row, .v2-link, .v2-r, .v2-chg, .v2-sess, [data-testid=v2-undo], [data-testid=v2-save]').all()) {
    if (!(await b.isVisible())) continue;
    expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
}

test('event page: long name not cut, dates list, save bar, undo, save', async ({ page }) => {
  const fake = await open(page);
  await expect(page.getByTestId('v2-name')).toContainText(LONG);
  const rows = page.getByTestId('v2-date-row');
  expect(await rows.count()).toBeLessThanOrEqual(6);
  await expect(page.getByTestId('v2-dates')).toContainText('Cancelled');
  await expectNoHorizontalScroll(page);
  await tapTargets(page);
  await page.screenshot({ path: `${OUT}/event.png`, fullPage: true });

  await setText(page, 'v2-about', 'New about text');
  await expect(page.getByTestId('v2-save-summary')).toHaveText('About');
  await page.screenshot({ path: `${OUT}/event-savebar.png` });
  await page.getByTestId('v2-undo').click();
  await expect(page.getByTestId('v2-toast')).toHaveText('Undone: About');
  await expect(page.getByTestId('v2-savebar')).toHaveCount(0);

  await setText(page, 'v2-about', 'New about text');
  await page.getByTestId('v2-save').click();
  await expect(page.getByTestId('v2-toast')).toHaveText('Saved');
  const env = fake.envelopes().at(-1) as { command: { payload: Record<string, unknown> } };
  expect(env.command.payload.default_description).toBe('New about text');
});

test('event page looks like the prototype: header, rows with chevrons, programme, no save bar until a change', async ({ page }) => {
  const fake = await open(page);
  // header: chevron back, "Events" over the name, the state pill; no shell exit line, no "Edit event" title
  await expect(page.getByTestId('r4-back')).toBeHidden();
  await expect(page.getByTestId('r4-header')).toBeHidden();
  await expect(page.getByText('Edit event')).toHaveCount(0);
  await expect(page.locator('.v2-tt1')).toHaveText('Events');
  await expect(page.getByTestId('v2-event-subline')).toHaveText(LONG);
  await expect(page.getByTestId('v2-pill')).toHaveText(/live/i);
  // rows: label, one-line value, chevron; no open text boxes on the page
  await expect(page.locator('.v2-main textarea, .v2-main input')).toHaveCount(0);
  for (const id of ['v2-name', 'v2-about', 'v2-music', 'v2-venue', 'v2-who']) {
    const r = page.getByTestId(id);
    expect((await r.boundingBox())!.height).toBeLessThanOrEqual(46);
  }
  await expect(page.getByTestId('v2-music')).toContainText('Bachata');
  await expect(page.getByTestId('v2-who')).toContainText(fake.organisers[0].name);
  await expect(page.getByTestId('v2-repeat')).toContainText(/^RepeatEvery FridayLast date/);
  expect((await page.getByTestId('v2-repeat').boundingBox())!.height).toBeLessThanOrEqual(60);
  // programme: time over "to" time, title, "Class \u00b7 people \u00b7 level"; late session last; untitled named by type
  const rows = page.getByTestId('v2-session-row');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText('20:00to 21:00Beginners bachataClass \u00b7 Ana Lopez, Ben Cole \u00b7 Beginner');
  await expect(rows.nth(1)).toContainText('21:00Party');
  await expect(rows.nth(2)).toContainText('01:00to 03:00Late party');
  await expect(page.getByTestId('v2-add-session')).toHaveText('Add a session');
  await expect(page.getByText('Teachers and DJs are set inside each session.')).toBeVisible();
  // the save bar only after a real change; typing the same name back is no change
  await expect(page.getByTestId('v2-savebar')).toHaveCount(0);
  await setText(page, 'v2-name', LONG);
  await expect(page.getByTestId('v2-savebar')).toHaveCount(0);
  await expectNoHorizontalScroll(page);
  await tapTargets(page);
  await page.screenshot({ path: `${OUT}/event-proto.png` });
  await page.getByTestId('v2-guest-list').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/event-proto-lower.png` });
  await page.getByTestId('v2-name').click();
  await page.screenshot({ path: `${OUT}/event-name-sheet.png` });
});

test('unsaved sheet on leave', async ({ page }) => {
  await open(page);
  await setText(page, 'v2-name', `${LONG} x`);
  await page.getByTestId('p3-edit-back').click();
  await expect(page.getByTestId('v2-unsaved')).toBeVisible();
  // Save / Throw away / Keep editing only: no extra Close
  await expect(page.getByTestId('p3-sheet').getByRole('button', { name: 'Close' })).toBeHidden();
  await page.screenshot({ path: `${OUT}/unsaved.png` });
  await page.getByTestId('v2-unsaved-keep').click();
  await expect(page.getByTestId('v2-event')).toBeVisible();
});

test('night screen: name for this night, back to usual, save sends set_override', async ({ page }) => {
  const fake = await open(page);
  await page.getByTestId('v2-date-row').first().click();
  await expect(page.getByTestId('v2-night')).toBeVisible();
  await expect(page.getByTestId('v2-night-title-state')).toHaveText('Usual');
  await page.locator('#v2-n-title').fill('Halloween special');
  await expect(page.getByTestId('v2-night-title-state')).toHaveText('Changed for this night');
  await expectNoHorizontalScroll(page);
  await tapTargets(page);
  await page.screenshot({ path: `${OUT}/night.png`, fullPage: true });
  await page.getByTestId('v2-save').click();
  await expect(page.getByTestId('v2-toast')).toHaveText('Saved');
  const env = fake.envelopes('occurrence_command_p5').at(-1) as { command: { kind: string; payload: Record<string, unknown> } };
  expect(env.command).toEqual({ kind: 'occurrence.set_override', payload: { title: 'Halloween special' } });
});

test('one save bar: event change kept on a night; night venue + session cancel; one save sends all in order', async ({ page }) => {
  const fake = await open(page);
  await setText(page, 'v2-about', 'New about text');
  // moving to a night of the same event keeps the draft and does not ask
  await page.getByTestId('v2-date-row').filter({ hasNotText: 'Cancelled' }).first().click();
  await expect(page.getByTestId('v2-night')).toBeVisible();
  await expect(page.getByTestId('v2-unsaved')).toHaveCount(0);
  await expect(page.getByTestId('v2-save-summary')).toHaveText('About');
  // venue for this night
  await page.getByTestId('v2-night-venue').click();
  await page.getByTestId('v2-night-venues').locator('button').filter({ hasNot: page.locator('[aria-pressed=true]') }).last().click();
  await expect(page.getByTestId('v2-night-venue-state')).toHaveText('Changed for this night');
  // sessions on the NEXT night (the fake versions a night's programme apart from its override; prod chains one version,
  // which the unit test 'runner chains the occurrence version' covers)
  await page.getByTestId('p3-edit-back').click();
  await page.getByTestId('v2-date-row').filter({ hasNotText: 'Cancelled' }).nth(1).click();
  await expect(page.getByTestId('v2-night')).toBeVisible();
  const first = page.getByTestId('v2-night-session').first();
  await expect(first).toBeVisible();
  await first.getByTestId('v2-session-cancel').click();
  await expect(first.getByTestId('v2-session-warning')).toBeVisible();
  await expectNoHorizontalScroll(page);
  await tapTargets(page);
  await page.screenshot({ path: `${OUT}/night-s1c.png`, fullPage: true });
  await expect(page.getByTestId('v2-save-summary')).toHaveText('About and 2 more');
  // back on the event page the bar still holds the night's changes
  await page.getByTestId('p3-edit-back').click();
  await expect(page.getByTestId('v2-event')).toBeVisible();
  await expect(page.getByTestId('v2-save-summary')).toHaveText('About and 2 more');
  await page.screenshot({ path: `${OUT}/event-s1c-savebar.png` });
  await page.getByTestId('v2-save').click();
  await expect(page.getByTestId('v2-toast')).toHaveText('Saved');
  expect((fake.envelopes().at(-1) as { command: { payload: Record<string, unknown> } }).command.payload.default_description).toBe('New about text');
  const occ = fake.envelopes('occurrence_command_p5').at(-1) as { command: { kind: string; payload: Record<string, unknown> } };
  expect(occ.command.kind).toBe('occurrence.set_override');
  expect(occ.command.payload.venue_id).toBeTruthy();
  expect(fake.sent('organiser_set_occurrence_programme_v1').length).toBe(1);
});

test('cancelled night: box and bring back', async ({ page }) => {
  const fake = await open(page);
  await page.getByTestId('v2-date-row').filter({ hasText: 'Cancelled' }).first().click();
  await expect(page.getByTestId('v2-night-cancelled')).toContainText('This night is cancelled.');
  await expect(page.getByTestId('v2-night-sessions-why')).toBeVisible();
  await page.screenshot({ path: `${OUT}/night-cancelled.png`, fullPage: true });
  await page.getByTestId('v2-night-bring-back').click();
  await expect.poll(() => fake.envelopes('occurrence_command_p5').length).toBeGreaterThan(0);
});
