import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { FRIDAY, OrganiserFake, PHONE, ORG, ORG_NAME, json } from './helpers/organiserFake';

// Slice 5: the "Reminder to buyers" row on the One night sheet, 390x844, every answer route-mocked
// (no signed-in admin session). Needs VITE_ENABLE_ORGANISER_P3=true on the dev server.
//   VITE_ENABLE_ORGANISER_P3=true npx playwright test tests/e2e/organiser-night-reminder.spec.ts --project=chromium
test.use({ viewport: PHONE, reducedMotion: 'reduce' });
const PICS = process.env.WALK_OUT ?? 'docs/walk/slice5-reminders';
mkdirSync(PICS, { recursive: true });

const STATUS_OFF = { v: 1, gate_on: false, is_admin: false, complete: true, person: { complete: true, missing: [] }, organisers: [{ id: ORG, name: ORG_NAME, role: 'owner', lifecycle: 'live', complete: true, missing: [], about: { done: true, skipped: false } }] };
// Default prod shape: no settings row, nothing sent: ON, 18:00 the day before.
const BASE = { ok: true, enabled: true, send_at: '2026-10-08T17:00:00+00:00', buyer_count: 12, sent_at: null, sent_count: 0, window_passed: false, night_cancelled: false, night_live: true, can_edit: true };

async function boot(page: Page, read: Record<string, unknown>, opts: { cancelled?: boolean; set?: (b: Record<string, unknown>) => Promise<Record<string, unknown> | 'error' | 'hang'> } = {}) {
  const fake = new OrganiserFake({});
  await fake.install(page);
  await page.route('**/rest/v1/rpc/organiser_onboarding_status_v1*', (r) => json(r, STATUS_OFF));
  if (opts.cancelled) fake.series.get(FRIDAY)!.cancelled['2026-10-09'] = 'Venue closed';
  const sent: Record<string, unknown>[] = [];
  let current = read;
  await page.route('**/rest/v1/rpc/organiser_night_reminder_get_v1*', (r) => json(r, current));
  await page.route('**/rest/v1/rpc/organiser_night_reminder_set_v1*', async (r) => {
    const b = r.request().postDataJSON() as Record<string, unknown>;
    sent.push(b);
    const out = opts.set ? await opts.set(b) : { ...current, enabled: b.p_enabled };
    if (out === 'error') return json(r, { code: 'P0001', message: 'nope', details: null, hint: null }, 400);
    if (out === 'hang') return new Promise<void>(() => undefined);
    current = out as Record<string, unknown>;
    return json(r, current);
  });
  await page.goto(`/account/p3/events/${FRIDAY}`);
  await page.getByTestId('p3-open-date').first().click();
  return { fake, sent };
}
const shot = (page: Page, name: string) => page.screenshot({ path: `${PICS}/${name}.png` });
const sw = (page: Page) => page.getByTestId('p3-reminder-switch');

test('default ON: line, 44px+ tap target, no command until used', async ({ page }) => {
  const { sent } = await boot(page, BASE);
  await expect(page.getByTestId('p3-reminder')).toBeVisible();
  await expect(page.getByTestId('p3-reminder-line')).toHaveText('Sends 18:00 on Thursday to 12 buyers. Sent once.');
  await expect(sw(page)).toHaveAttribute('aria-checked', 'true');
  await expect(sw(page)).toBeEnabled();
  const box = (await sw(page).boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await page.getByTestId('p3-reminder').scrollIntoViewIfNeeded();
  await shot(page, '1-default-on');
  expect(sent).toHaveLength(0);
});

test('switch OFF sends one command and shows Off', async ({ page }) => {
  const { sent } = await boot(page, BASE);
  await sw(page).click();
  await expect(sw(page)).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByTestId('p3-reminder-line')).toHaveText('Off — nothing will be sent for this night.');
  expect(sent).toEqual([{ p_occurrence_id: expect.any(String), p_enabled: false }]);
  await shot(page, '2-off');
});

test('saving: optimistic flip and switch disabled while in flight', async ({ page }) => {
  const { sent } = await boot(page, BASE, { set: async () => 'hang' });
  await sw(page).click();
  await expect(sw(page)).toHaveAttribute('aria-checked', 'false');
  await expect(sw(page)).toBeDisabled();
  expect(sent).toHaveLength(1);
  await shot(page, '3-saving');
});

test('save error rolls back and says so', async ({ page }) => {
  await boot(page, BASE, { set: async () => 'error' });
  await sw(page).click();
  await expect(page.getByTestId('p3-reminder-error')).toBeVisible();
  await expect(sw(page)).toHaveAttribute('aria-checked', 'true');
  await expect(sw(page)).toBeEnabled();
  await shot(page, '4-error-rollback');
});

test('disabled with a reason: viewer, window passed, already sent, not live', async ({ page }) => {
  await boot(page, { ...BASE, can_edit: false });
  await expect(sw(page)).toBeDisabled();
  await expect(page.getByTestId('p3-reminder-why')).toHaveText('Only owners and managers can change this.');
  await shot(page, '5-disabled-viewer');
});

for (const [name, over, why] of [
  ['past night', { window_passed: true }, 'The send time has passed.'],
  ['already sent', { sent_at: '2026-10-08T17:00:30+00:00', sent_count: 9, buyer_count: 9 }, 'Already sent — it is sent once.'],
  ['not live', { night_live: false }, 'The event is not live.'],
] as const) {
  test(`disabled: ${name}`, async ({ page }) => {
    const { sent } = await boot(page, { ...BASE, ...over });
    await expect(sw(page)).toBeDisabled();
    await expect(page.getByTestId('p3-reminder-why')).toHaveText(why);
    expect(sent).toHaveLength(0);
    await shot(page, `6-${name.replace(' ', '-')}`);
  });
}

test('no paid orders: still honest, switch works', async ({ page }) => {
  await boot(page, { ...BASE, buyer_count: 0 });
  await expect(page.getByTestId('p3-reminder-line')).toHaveText('Will send to everyone who has a ticket by 18:00 on Thursday. Sent once.');
  await expect(sw(page)).toBeEnabled();
  await shot(page, '7-no-orders');
});

test('cancelled night: row hidden', async ({ page }) => {
  await boot(page, { ...BASE, night_cancelled: true }, { cancelled: true });
  await expect(page.getByTestId('p3-date-actions')).toBeVisible();
  await expect(page.getByTestId('p3-reminder')).toHaveCount(0);
  await shot(page, '8-cancelled-hidden');
});
