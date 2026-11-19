import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { FRIDAY, OrganiserFake, PHONE, json } from './helpers/organiserFake';

// WALK (report only, not in the gate): organiser R4 slice c, door Undo after a list tick, 390x844, every answer route-mocked.
//   WALK_OUT=<dir> VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true VITE_ENABLE_ORGANISER_DASH=true \
//   VITE_ENABLE_ORGANISER_R4=true VITE_ENABLE_ORGANISER_TICKETING=true VITE_ENABLE_TICKET_DOOR_CODE=true npx playwright test tests/e2e/walk-r4-door-undo.spec.ts --project=chromium --workers=1 --trace off
const OUT = process.env.WALK_OUT ?? 'docs/walk/r4-door-undo';
mkdirSync(`${OUT}/pics`, { recursive: true });
test.use({ viewport: PHONE, reducedMotion: 'reduce', launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } });
const TOKEN = 'd'.repeat(64);
const LIST = { result: 'ok', truncated: false, in_count: 1, total_count: 3, rows: ['Aisha', 'Ben', 'Chloe'].map((n, i) => ({ ticket_id: `t${i}`, first_name: n, quantity_in_order: 1, ticket_type_name: 'Standard', checked_in_at: i === 0 ? '2026-10-08T20:00:00Z' : null })) };

async function facts(page: Page, name: string) {
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/pics/${name}.png` });
  return page.evaluate(() => {
    const small: string[] = [];
    for (const el of Array.from(document.querySelectorAll('main button, main a, [data-testid="door-screen"] button, [data-testid="door-screen"] a, [data-testid="r4-door-invite"] button, [data-testid="r4-door-invite"] a'))) {
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      if (b.height < 43.5) small.push(`${(el.textContent || '').trim().slice(0, 30)} ${Math.round(b.width)}x${Math.round(b.height)}`);
    }
    return { small, sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
}

async function open(page: Page, path: string, o: { signedOut?: boolean; accept?: unknown; mint?: unknown; undo?: unknown } = {}) {
  const fake = new OrganiserFake({ signedOut: o.signedOut });
  await fake.install(page);
  await page.route('**/rest/v1/rpc/ticket_door_seat_accept_v1*', (r) => json(r, o.accept ?? { result: 'ok', event_series_id: FRIDAY, expires_at: '2026-10-10T10:00:00Z' }));
  await page.route('**/rest/v1/rpc/ticket_door_seat_invite_v1*', (r) => json(r, o.mint ?? { result: 'ok', token: TOKEN, expires_at: '2026-10-10T10:00:00Z' }));
  await page.route('**/rest/v1/rpc/my_door_seats_v1*', (r) => json(r, { result: 'ok', rows: [{ event_series_id: FRIDAY, series_name: 'Friday Social', occurrence_date: '2026-10-09', expires_at: '2026-10-10T10:00:00Z' }] }));
  await page.route('**/rest/v1/rpc/ticket_door_list_v3*', (r) => json(r, LIST));
  await page.route('**/rest/v1/rpc/ticket_check_in_by_id_v3*', (r) => json(r, { result: 'ok', first_name: 'Ben', ticket_type_name: 'Standard', quantity: 1, checked_in_at: '2026-10-08T20:05:00Z', checked_in_by_first_name: null, in_count: 2, total_count: 3 }));
  await page.route('**/rest/v1/rpc/ticket_undo_check_in_v1*', async (r) => { await new Promise((ok) => setTimeout(ok, 400)); return json(r, o.undo ?? { result: 'ok', undone: true, in_count: 1, total_count: 3 }); });
  await page.goto(path);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  return fake;
}

for (const [name, undo, words] of [
  ['undone', { result: 'ok', undone: true, in_count: 1, total_count: 3 }, 'Undone. Ben is no longer checked in.'],
  ['ended', { result: 'wrong_night', undone: false }, 'This night has ended, so it cannot be undone'],
] as const) {
  test(`seat-only door: tick Ben, Undo (${name})`, async ({ page }) => {
    await open(page, `/door/join/${TOKEN}`, { undo });
    await expect(page.getByTestId('door-screen')).toBeVisible({ timeout: 45_000 });
    await page.getByTestId('door-tab-list').click();
    await page.getByTestId('door-row-checkin').first().click();
    await expect(page.getByTestId('door-undo-btn')).toHaveText('Undo');
    console.log('ready', JSON.stringify(await facts(page, `01-${name}-ready`)));
    const box = await page.getByTestId('door-undo-btn').boundingBox();
    expect(box && box.height).toBeGreaterThanOrEqual(44);
    await page.getByTestId('door-undo-btn').click();
    await expect(page.getByTestId('door-undo-btn')).toBeDisabled();
    await expect(page.getByTestId('door-undo-text')).toHaveText(words);
    const f = await facts(page, `02-${name}-after`);
    console.log('after', JSON.stringify(f));
    expect(f.sideways).toBe(0);
  });
}
