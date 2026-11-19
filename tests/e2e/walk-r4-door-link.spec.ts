import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { FRIDAY, OrganiserFake, PHONE, json } from './helpers/organiserFake';

// WALK (report only, not in the gate): organiser R4 slice a, the door invite link, 390x844, every answer route-mocked.
//   WALK_OUT=<dir> VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true VITE_ENABLE_ORGANISER_DASH=true \
//   VITE_ENABLE_ORGANISER_R4=true VITE_ENABLE_ORGANISER_TICKETING=true npx playwright test tests/e2e/walk-r4-door-link.spec.ts --project=chromium --workers=1 --trace off
const OUT = process.env.WALK_OUT ?? 'docs/walk/r4-door-link';
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

async function open(page: Page, path: string, o: { signedOut?: boolean; accept?: unknown; mint?: unknown } = {}) {
  const fake = new OrganiserFake({ signedOut: o.signedOut });
  await fake.install(page);
  await page.route('**/rest/v1/rpc/ticket_door_seat_accept_v1*', (r) => json(r, o.accept ?? { result: 'ok', event_series_id: FRIDAY, expires_at: '2026-10-10T10:00:00Z' }));
  await page.route('**/rest/v1/rpc/ticket_door_seat_invite_v1*', (r) => json(r, o.mint ?? { result: 'ok', token: TOKEN, expires_at: '2026-10-10T10:00:00Z' }));
  await page.route('**/rest/v1/rpc/my_door_seats_v1*', (r) => json(r, { result: 'ok', rows: [{ event_series_id: FRIDAY, series_name: 'Friday Social', occurrence_date: '2026-10-09', expires_at: '2026-10-10T10:00:00Z' }] }));
  await page.route('**/rest/v1/rpc/ticket_door_list_v3*', (r) => json(r, LIST));
  await page.goto(path);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  return fake;
}

test('LINK card: Copy mints on tap, shows link + access end + Share', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const fake = await open(page, '/account/p3/you/team/door-invite');
  await expect(page.getByTestId('r4-door-invite')).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId('r4-door-invite-copy')).toBeEnabled({ timeout: 20_000 });
  expect(fake.sent('ticket_door_seat_invite_v1').length, 'nothing minted on page load').toBe(0);
  console.log('before', JSON.stringify(await facts(page, '01-invite-before')));
  await page.getByTestId('r4-door-invite-copy').click();
  await expect(page.getByTestId('r4-door-invite-link')).toBeVisible();
  console.log('link', JSON.stringify(await facts(page, '02-invite-link-card')), await page.getByTestId('r4-door-invite-link').innerText());
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(`/door/join/${TOKEN}`);
});

test('mint refused: occurrence_ended in plain words', async ({ page }) => {
  await open(page, '/account/p3/you/team/door-invite', { mint: { result: 'occurrence_ended', token: null, expires_at: null } });
  await expect(page.getByTestId('r4-door-invite-copy')).toBeEnabled({ timeout: 45_000 });
  await page.getByTestId('r4-door-invite-copy').click();
  await expect(page.getByTestId('r4-door-invite-why')).toContainText('This night has ended');
  console.log('ended-mint', JSON.stringify(await facts(page, '03-invite-ended')));
});

test('accept ok lands on the seat-only door screen', async ({ page }) => {
  await open(page, `/door/join/${TOKEN}`);
  await expect(page.getByTestId('door-screen')).toBeVisible({ timeout: 45_000 });
  expect(new URL(page.url()).pathname).toBe(`/door/${FRIDAY}`);
  await expect(page.getByTestId('door-back')).toHaveAttribute('href', '/');
  await page.getByTestId('door-tab-list').click();
  console.log('door', JSON.stringify(await facts(page, '04-seat-door-search')), await page.locator('body').innerText().then((t) => t.slice(0, 300)));
  const acct = await page.locator('a[href^="/account"]').evaluateAll((as) => as.map((a) => ({ href: a.getAttribute('href'), vis: !!(a as HTMLElement).offsetParent, inDoor: !!a.closest('[data-testid="door-screen"]'), text: a.textContent })));
  console.log('acct', JSON.stringify(acct));
  // The site header sits under the full-screen door (as on the organiser door today): only the door itself is judged.
  expect(acct.filter((a) => a.inDoor)).toEqual([]);
});

test('ended link', async ({ page }) => {
  await open(page, `/door/join/${TOKEN}`, { accept: { result: 'invite_ended', event_series_id: null, expires_at: null } });
  await expect(page.getByText('This link has stopped working. Ask the organiser for a new one.')).toBeVisible({ timeout: 45_000 });
  expect(new URL(page.url()).pathname).toBe('/door/join');
  console.log('ended', JSON.stringify(await facts(page, '05-accept-ended')));
});

test('signed out: sign in, then back to the link', async ({ page }) => {
  await open(page, `/door/join/${TOKEN}`, { signedOut: true });
  await expect(page.getByTestId('door-join-signin')).toBeVisible({ timeout: 45_000 });
  console.log('signedout', JSON.stringify(await facts(page, '06-accept-signed-out')));
  await page.getByTestId('door-join-signin').click();
  await page.waitForURL(/\/auth/);
  expect(decodeURIComponent(page.url())).toContain(`returnTo=/door/join/${TOKEN}`);
});
