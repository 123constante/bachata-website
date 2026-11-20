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
  await fake.install(page);
  await page.goto(`/account/p3/events/${FRIDAY}/edit`);
  await expect(page.getByTestId('v2-event')).toBeVisible({ timeout: 20_000 });
  return fake;
}

async function tapTargets(page: Page) {
  for (const b of await page.locator('.v2-row, .v2-link, [data-testid=v2-undo], [data-testid=v2-save]').all()) {
    if (!(await b.isVisible())) continue;
    expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
}

test('event page: long name not cut, dates list, save bar, undo, save', async ({ page }) => {
  const fake = await open(page);
  await expect(page.getByTestId('v2-name')).toHaveValue(LONG);
  const rows = page.getByTestId('v2-date-row');
  expect(await rows.count()).toBeLessThanOrEqual(6);
  await expect(page.getByTestId('v2-dates')).toContainText('Cancelled');
  await expectNoHorizontalScroll(page);
  await tapTargets(page);
  await page.screenshot({ path: `${OUT}/event.png`, fullPage: true });

  await page.getByTestId('v2-about').fill('New about text');
  await expect(page.getByTestId('v2-save-summary')).toHaveText('About');
  await page.screenshot({ path: `${OUT}/event-savebar.png` });
  await page.getByTestId('v2-undo').click();
  await expect(page.getByTestId('v2-toast')).toHaveText('Undone: About');
  await expect(page.getByTestId('v2-savebar')).toHaveCount(0);

  await page.getByTestId('v2-about').fill('New about text');
  await page.getByTestId('v2-save').click();
  await expect(page.getByTestId('v2-toast')).toHaveText('Saved');
  const env = fake.envelopes().at(-1) as { command: { payload: Record<string, unknown> } };
  expect(env.command.payload.default_description).toBe('New about text');
});

test('unsaved sheet on leave', async ({ page }) => {
  await open(page);
  await page.getByTestId('v2-name').fill(`${LONG} x`);
  await page.getByTestId('p3-edit-back').click();
  await expect(page.getByTestId('v2-unsaved')).toBeVisible();
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
  await page.getByTestId('v2-about').fill('New about text');
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
