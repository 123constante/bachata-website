import { test, expect, type Page, type Route } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { FRIDAY, OrganiserFake, PHONE, expectNoHorizontalScroll, json } from './helpers/organiserFake';

// The door short code + Tonight-list Check in at 390x844 against the route-mocked organiser
// fake, ticket_check_in_by_code_v1 / ticket_check_in_by_id_v1 / ticket_door_list_v1 answered in
// their live prod shapes (admin 20270314140000_ticket_door_short_code_v1). Mounts only with
// organiserP3, organiserTicketing AND ticketDoorCode on:
//   VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true VITE_ENABLE_ORGANISER_TICKETING=true \
//     VITE_ENABLE_TICKET_DOOR_CODE=true DOOR_SHOTS=docs/walk/ticket-door-code-screen \
//     npx playwright test tests/e2e/ticket-door-code.spec.ts --project=chromium
// With any of them off (the e2e gate's server today) the file skips itself.

const OUT = process.env.DOOR_SHOTS ?? 'test-results/ticket-door-code';
mkdirSync(OUT, { recursive: true });
const NAMES = ['Aisha', 'Ben', 'Chloe', 'Daniel', 'Diego', 'Elena'];
const LIST = {
  result: 'ok', truncated: false, in_count: 0, total_count: 6,
  rows: NAMES.map((n, i) => ({ ticket_id: `t${i}`, short_code: 'K7M2QX', first_name: n, quantity_in_order: 1, ticket_type_name: 'Standard', checked_in_at: null })),
};
const NOBODY = { ticket_type_name: null, first_name: null, quantity: null, checked_in_at: null, checked_in_by_first_name: null };
const OK = { result: 'ok', ticket_type_name: 'Standard', first_name: 'Chloe', quantity: 1, checked_in_at: '2026-10-29T21:42:00Z', checked_in_by_first_name: 'Sam', in_count: 1, total_count: 6 };
const CODE: Record<string, unknown> = {
  ok: OK,
  too_many_attempts: { result: 'too_many_attempts', ...NOBODY, in_count: 0, total_count: 6 },
  not_allowed: { result: 'not_allowed', ...NOBODY, in_count: null, total_count: null },
};

test.use({ viewport: PHONE, colorScheme: 'dark', permissions: ['camera'], launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } });

async function open(page: Page, codeAnswer: string) {
  const fake = new OrganiserFake();
  await fake.install(page);
  await page.route('**/rest/v1/rpc/ticket_door_list_v1*', (route: Route) => json(route, LIST));
  await page.route('**/rest/v1/rpc/ticket_check_in_by_code_v1*', (route: Route) => {
    expect(route.request().postDataJSON()).toEqual({ p_code: 'K7M2QX', p_event_series_id: FRIDAY });
    if (codeAnswer === 'offline') return route.abort('internetdisconnected');
    return json(route, CODE[codeAnswer]);
  });
  await page.route('**/rest/v1/rpc/ticket_check_in_by_id_v1*', (route: Route) => {
    expect(route.request().postDataJSON()).toEqual({ p_ticket_id: 't2', p_event_series_id: FRIDAY });
    return json(route, OK);
  });
  await page.goto(`/account/p3/events/${FRIDAY}/door`);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await expect(page.getByTestId('door-screen')).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId('door-codebox')).toBeVisible();
}

const MOUNTED = process.env.VITE_ENABLE_ORGANISER_P3 === 'true' && process.env.VITE_ENABLE_ORGANISER_TICKETING === 'true'
  && process.env.VITE_ENABLE_TICKET_DOOR_CODE === 'true';
test.skip(!MOUNTED, 'organiserP3 / organiserTicketing / ticketDoorCode is off in this server: the short code is not mounted');

const shot = (page: Page, name: string) => page.screenshot({ path: `${OUT}/${name}.png` });

test('ready, then a malformed code is refused with a reason and sends nothing', async ({ page }) => {
  await open(page, 'ok');
  await shot(page, '1-ready');
  await page.getByTestId('door-code-input').fill('K7M 2Q0');
  // aria-disabled (not disabled) on purpose: a tap still lands and shows the reason
  await page.getByTestId('door-code-check').click({ force: true });
  await expect(page.getByTestId('door-code-why')).toContainText('6 letters and numbers');
  await shot(page, '2-malformed');
  await expectNoHorizontalScroll(page);
});

test('typed short code lets the person in', async ({ page }) => {
  await open(page, 'ok');
  await page.getByTestId('door-code-input').fill('k7m-2qx');
  await page.getByTestId('door-code-check').click();
  await expect(page.getByTestId('door-headline')).toHaveText('LET IN');
  await shot(page, '3-ok');
});

test('too many wrong codes: wait, then Tonight-list Check in by id', async ({ page }) => {
  await open(page, 'too_many_attempts');
  await page.getByTestId('door-code-input').fill('K7M2QX');
  await page.getByTestId('door-code-check').click();
  await expect(page.getByTestId('door-headline')).toHaveText('TOO MANY WRONG CODES');
  await shot(page, '4-too-many');
  await page.getByTestId('door-act-list').click();
  await expect(page.getByTestId('door-paused-banner')).toBeVisible();
  await shot(page, '5-list-checkin');
  for (const b of await page.getByTestId('door-row-checkin').all()) {
    const box = await b.boundingBox();
    expect(box && box.height >= 44 && box.width >= 44).toBeTruthy();
  }
  await page.getByTestId('door-row-checkin').nth(2).click();
  await expect(page.getByTestId('door-headline')).toHaveText('LET IN');
  await shot(page, '6-list-ok');
  await expectNoHorizontalScroll(page);
});

test('not allowed and no signal', async ({ page }) => {
  await open(page, 'not_allowed');
  await page.getByTestId('door-code-input').fill('K7M2QX');
  await page.getByTestId('door-code-check').click();
  await expect(page.getByTestId('door-headline')).toHaveText('CANNOT CHECK TICKETS');
  await shot(page, '7-not-allowed');
  await open(page, 'offline');
  await page.getByTestId('door-code-input').fill('K7M2QX');
  await page.getByTestId('door-code-check').click();
  await expect(page.getByTestId('door-offline-banner')).toBeVisible();
  await shot(page, '8-no-signal');
});
