import { test, expect, type Page, type Route } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { FRIDAY, NOW, OrganiserFake, PHONE, expectNoHorizontalScroll, json } from './helpers/organiserFake';

// The ticket door scanner (layout C) at 390x844 against the route-mocked organiser fake, with
// ticket_check_in_v1 and ticket_door_list_v1 answered in their live shapes (admin migration
// 20270308040000). The camera is Chromium's fake device (no QR in it), so every answer comes
// through the code box, the path a guest without a scannable QR takes. Dark set (door rooms are dark). Mounts only with
// organiserP3 AND organiserTicketing on:
//   VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true VITE_ENABLE_ORGANISER_TICKETING=true \
//     DOOR_SHOTS=docs/handovers/ticket-qr-door-screen npx playwright test tests/e2e/ticket-door-scanner.spec.ts --project=chromium
// With either flag off (the e2e gate's server today) the file skips itself, as the P3 walks do.

const OUT = process.env.DOOR_SHOTS ?? 'test-results/ticket-door';
mkdirSync(OUT, { recursive: true });
const TOKEN = 'ab'.repeat(32);
const NAMES = ['Aisha', 'Ben', 'Chloe', 'Daniel', 'Diego', 'Elena', 'Femi', 'Maria'];
const LIST = {
  result: 'ok', truncated: false, in_count: 3, total_count: 8,
  rows: NAMES.map((n, i) => ({ ticket_id: `t${i}`, first_name: n, quantity_in_order: (i % 3) + 1, ticket_type_name: i % 2 ? 'Standard' : 'Early bird', checked_in_at: i % 3 === 1 ? '2026-10-29T21:00:00Z' : null })),
};
// a scan from five minutes ago, the fake's frozen clock (NOW): 11:55 London time
const EARLIER = new Date(NOW.getTime() - 5 * 60_000).toISOString();
const NOBODY = { ticket_type_name: null, first_name: null, quantity: null, checked_in_at: null, checked_in_by_first_name: null };
const REPLIES: Record<string, unknown> = {
  ok: { result: 'ok', ticket_type_name: 'Early bird', first_name: 'Maria', quantity: 2, checked_in_at: '2026-10-29T21:42:00Z', checked_in_by_first_name: 'Sam', in_count: 4, total_count: 8 },
  already_in: { result: 'already_in', ticket_type_name: 'Standard', first_name: 'Daniel', quantity: 1, checked_in_at: EARLIER, checked_in_by_first_name: 'Sam', in_count: 3, total_count: 8 },
  wrong_event: { result: 'wrong_event', ticket_type_name: 'Standard', first_name: 'Priya', quantity: 1, checked_in_at: null, checked_in_by_first_name: null, in_count: 3, total_count: 8 },
  not_valid: { result: 'not_valid', ticket_type_name: 'Early bird', first_name: 'Tom', quantity: 2, checked_in_at: null, checked_in_by_first_name: null, in_count: 3, total_count: 8 },
  unknown_code: { result: 'unknown_code', ...NOBODY, in_count: 3, total_count: 8 },
  not_allowed: { result: 'not_allowed', ...NOBODY, in_count: null, total_count: null },
};
const HEADLINE: Record<string, string> = {
  ok: 'LET IN', already_in: 'ALREADY IN', wrong_event: 'NOT FOR THIS EVENT', not_valid: 'NOT VALID', unknown_code: 'CODE NOT RECOGNISED', not_allowed: 'CANNOT CHECK TICKETS',
};

test.use({ viewport: PHONE, colorScheme: 'dark', permissions: ['camera'], launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } });

async function open(page: Page, answer: string, list: unknown = LIST) {
  const fake = new OrganiserFake();
  await fake.install(page);
  // registered after the fake's own rest route, so these answer the door reads
  await page.route('**/rest/v1/rpc/ticket_door_list_v1*', (route: Route) => json(route, list));
  await page.route('**/rest/v1/rpc/ticket_check_in_v1*', (route: Route) => {
    const a = route.request().postDataJSON() as { p_qr_token: string; p_event_series_id: string };
    expect(a).toEqual({ p_qr_token: TOKEN, p_event_series_id: FRIDAY });
    if (answer === 'offline') return route.abort('internetdisconnected');
    return json(route, REPLIES[answer]);
  });
  await page.goto(`/account/p3/events/${FRIDAY}/door`);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  // the dev server compiles the lazy chunks on the first visit: give that one room
  await expect(page.getByTestId('door-screen')).toBeVisible({ timeout: 45_000 });
}

// The web server gets the same env (playwright.config.ts), so this is the server's flag state.
const MOUNTED = process.env.VITE_ENABLE_ORGANISER_P3 === 'true' && process.env.VITE_ENABLE_ORGANISER_TICKETING === 'true';
test.skip(!MOUNTED, 'organiserP3 / organiserTicketing is off in this server: the door screen is not mounted');

/** Every visible control is a >= 44 px tap; every box sits inside 390x844; no sideways scroll. */
async function geometry(page: Page) {
  await expectNoHorizontalScroll(page);
  const boxes = await page.locator('[data-testid="door-screen"] :is(a, button, input)').evaluateAll((els) =>
    els.filter((e) => (e as HTMLElement).offsetParent).map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent || e.getAttribute('data-testid'), h: r.height, l: r.left, r: r.right }; }));
  for (const b of boxes) {
    expect(b.h, String(b.t)).toBeGreaterThanOrEqual(44);
    expect(b.l, String(b.t)).toBeGreaterThanOrEqual(0);
    expect(b.r, String(b.t)).toBeLessThanOrEqual(PHONE.width);
  }
}

async function typeCode(page: Page) {
  await page.getByTestId('door-code-input').first().fill(TOKEN);
  await page.getByTestId('door-code-check').first().click();
}

test('ready: camera, counter and the code box', async ({ page }) => {
  await open(page, 'ok');
  await expect(page.getByTestId('door-count')).toHaveText(/3 of 8 in/);
  await expect(page.getByTestId('door-camera')).toHaveAttribute('data-cam', 'on');
  await expect(page.getByTestId('door-codebox')).toBeVisible();
  await geometry(page);
  await page.screenshot({ path: `${OUT}/1-ready.png` });
});

let n = 2;
for (const r of Object.keys(REPLIES)) {
  const shot = n++;
  test(`result: ${r}`, async ({ page }) => {
    await open(page, r);
    await typeCode(page);
    const card = page.getByTestId('door-result');
    await expect(card).toHaveAttribute('data-state', r);
    await expect(card.getByTestId('door-headline')).toHaveText(HEADLINE[r]);
    if (r === 'already_in') await expect(card.getByTestId('door-sub')).toHaveText('Scanned at 11:55 by Sam');
    if (r === 'ok') await expect(page.getByTestId('door-count')).toHaveText(/4 of 8 in/);
    await expect(card).toBeInViewport({ ratio: 1 });
    await geometry(page);
    await page.screenshot({ path: `${OUT}/${shot}-${r}.png` });
  });
}

test('offline: NO SIGNAL opens tonight\'s list with the banner', async ({ page }) => {
  await open(page, 'offline');
  await typeCode(page);
  await expect(page.getByTestId('door-offline-banner')).toBeVisible();
  await expect(page.getByTestId('door-tab-list')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('door-row')).toHaveCount(8);
  await geometry(page);
  await page.screenshot({ path: `${OUT}/8-offline.png` });
});

test("tonight's list: rows, search, 0 sold", async ({ page }) => {
  await open(page, 'ok');
  await page.getByTestId('door-tab-list').click();
  await expect(page.getByTestId('door-row')).toHaveCount(8);
  await expect(page.getByTestId('door-row').first()).toHaveText(/Aisha.*Not in/);
  await geometry(page);
  await page.screenshot({ path: `${OUT}/9-list.png` });
  await page.getByTestId('door-search').fill('zz');
  await expect(page.getByTestId('door-no-match')).toBeVisible();
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await open(page, 'ok', { ...LIST, rows: [], in_count: 0, total_count: 0 });
  await expect(page.getByTestId('door-empty')).toBeVisible();
  await geometry(page);
  await page.screenshot({ path: `${OUT}/10-empty.png` });
});
