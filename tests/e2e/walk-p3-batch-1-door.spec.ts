import { test, expect, type Page } from '@playwright/test';
import { appendFileSync, mkdirSync } from 'node:fs';
import { FRIDAY, OrganiserFake, PHONE, ORG, ORG_NAME, json } from './helpers/organiserFake';

// WALK (report only), PR #1317 door-camera-help, 390x844, every answer route-mocked. Run on the PR branch:
//   WALK_OUT=<dir> VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true npx playwright test tests/e2e/walk-p3-batch-1-door.spec.ts --project=chromium --workers=1
// Pictures -> $WALK_OUT/pics, facts -> $WALK_OUT/observations.jsonl. The test asserts only the picture guard; a person judges each picture.
const OUT = process.env.WALK_OUT ?? 'docs/walk/p3-batch-1';
const PICS = `${OUT}/pics`;
mkdirSync(PICS, { recursive: true });
test.use({ viewport: PHONE, reducedMotion: 'reduce', colorScheme: 'dark', launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } });
// Door flag is OFF in prod: run with VITE_ENABLE_ORGANISER_TICKETING=true as well.
const note = (row: string, text: string) => appendFileSync(`${OUT}/observations.jsonl`, JSON.stringify({ row, text }) + '\n');

async function snap(page: Page, row: string, name: string) {
  await page.waitForTimeout(500);
  await page.evaluate(() => Promise.race([Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))), new Promise((r) => setTimeout(r, 1500))])).catch(() => undefined);
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await page.waitForTimeout(150);
  const text = await page.locator('body').innerText();
  const bad = /Something went wrong|couldn.t reach Bachata Calendar|We couldn.t load this event/i.test(text);
  const facts = await page.evaluate(() => {
    const small: string[] = [];
    const roots = Array.from(document.querySelectorAll('.p3-theme, [role="dialog"]'));
    for (const el of Array.from(document.querySelectorAll('button, a, input, select, textarea, [role="tab"]')).filter((e) => roots.some((r) => r.contains(e)))) {
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height || b.bottom < 0 || b.top > innerHeight * 3) continue;
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      if ((el as HTMLElement).closest('[aria-hidden="true"]') || (el as HTMLElement).classList.contains('p3-ob-sr')) continue;
      if (b.height < 43.5 || b.width < 43.5) small.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}" ${Math.round(b.width)}x${Math.round(b.height)}`);
    }
    return { small, wide: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  const garbled = (text.match(/\u00c3.|\u00e2\u20ac.|&(mdash|hellip|rsquo|amp|nbsp|lsquo|ldquo|rdquo);|\ufffd/g) ?? []);
  await page.screenshot({ path: `${PICS}/${name}.png`, fullPage: false });
  appendFileSync(`${OUT}/observations.jsonl`, JSON.stringify({ row, pic: `${name}.png`, w19: { small: facts.small, sidewaysPx: facts.wide, garbled, errorCard: bad } }) + '\n');
  expect(bad, `${name}: the picture shows an error card`).toBe(false);
}

const STATUS_OFF = { v: 1, gate_on: false, is_admin: false, complete: true, person: { complete: true, missing: [] }, organisers: [{ id: ORG, name: ORG_NAME, role: 'owner', lifecycle: 'live', complete: true, missing: [], about: { done: true, skipped: false } }] };
const LIST = { result: 'ok', truncated: false, in_count: 3, total_count: 8, rows: ['Aisha', 'Ben', 'Chloe', 'Daniel'].map((n, i) => ({ ticket_id: `t${i}`, first_name: n, quantity_in_order: 1, ticket_type_name: 'Standard', checked_in_at: null })) };
type Perm = 'prompt' | 'granted' | 'denied' | 'throws';
type Gum = 'real' | 'NotAllowedError' | 'NotFoundError' | 'NotReadableError';
const UA = { iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1', android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36', insta: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 320.0' };

async function openDoor(page: Page, o: { perm: Perm; gum: Gum; ua?: keyof typeof UA }) {
  const fake = new OrganiserFake();
  await fake.install(page);
  await page.route('**/rest/v1/rpc/organiser_onboarding_status_v1*', (r) => json(r, STATUS_OFF));
  await page.route('**/rest/v1/rpc/ticket_door_list_v1*', (r) => json(r, LIST));
  await page.addInitScript(({ perm, gum, ua }) => {
    const w = window as unknown as { __gum: number; __perm: string; __gumMode: string };
    w.__gum = 0; w.__perm = perm; w.__gumMode = gum;
    if (ua) Object.defineProperty(navigator, 'userAgent', { get: () => ua });
    const realQuery = navigator.permissions?.query?.bind(navigator.permissions);
    const listeners: Array<() => void> = [];
    Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query: async (d: { name: string }) => {
      if (d.name !== 'camera') return realQuery!(d as PermissionDescriptor);
      if (w.__perm === 'throws') throw new TypeError('camera is not a valid permission name');
      return { get state() { return w.__perm; }, addEventListener: (_: string, f: () => void) => listeners.push(f), removeEventListener: () => undefined, onchange: null };
    } } });
    const realGum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (c) => {
      w.__gum += 1;
      if (w.__gumMode !== 'real') throw new DOMException(w.__gumMode, w.__gumMode);
      return realGum(c);
    };
  }, { perm: o.perm, gum: o.gum, ua: o.ua ? UA[o.ua] : null });
  await page.goto(`/account/p3/events/${FRIDAY}/door`);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await expect(page.getByTestId('door-screen')).toBeVisible({ timeout: 45_000 });
  await page.waitForTimeout(1200);
}
const gumCalls = (page: Page) => page.evaluate(() => (window as unknown as { __gum: number }).__gum);
const state = async (page: Page, tag: string) => note(tag, `cam=${await page.getByTestId('door-camera').getAttribute('data-cam').catch(() => 'n/a')}; getUserMedia calls=${await gumCalls(page)}; help="${(await page.getByTestId('door-cam-help').innerText().catch(() => 'NO HELP CARD')).replace(/\n+/g, ' | ')}"; buttons: start=${await page.getByTestId('door-cam-start').count()} retry=${await page.getByTestId('door-cam-retry').count()} steps=${await page.getByTestId('door-cam-steps').count()} codebox=${await page.getByTestId('door-codebox').count()}`);

test.skip(!(process.env.VITE_ENABLE_ORGANISER_P3 === 'true' && process.env.VITE_ENABLE_ORGANISER_TICKETING === 'true'), 'door flag off in this server');

test('ask -> Start camera -> granted', async ({ page }) => {
  await openDoor(page, { perm: 'prompt', gum: 'real' });
  await state(page, 'ask/0-load');
  await snap(page, 'ask', 'ask-0-load');
  await page.getByTestId('door-cam-start').click();
  await page.waitForTimeout(1500);
  await state(page, 'ask/1-after-start');
  await snap(page, 'ask', 'ask-1-after-start');
});
test('granted', async ({ page }) => {
  await openDoor(page, { perm: 'granted', gum: 'real' });
  await state(page, 'granted');
  await snap(page, 'granted', 'granted-0');
});
for (const ua of ['android', 'iphone', 'insta'] as const) {
  test(`denied (${ua}) -> Try again -> Still blocked -> list`, async ({ page }) => {
    await openDoor(page, { perm: 'denied', gum: 'NotAllowedError', ua });
    await state(page, `denied-${ua}/0-load`);
    await snap(page, `denied-${ua}`, `denied-${ua}-0-steps`);
    if (ua !== 'android') return;
    await page.getByTestId('door-cam-retry').click();
    await page.waitForTimeout(1200);
    await state(page, `denied-${ua}/1-after-retry`);
    note('denied-android/1', `camera words="${await page.getByTestId('door-cam-words').innerText().catch(() => 'none')}"`);
    await snap(page, 'denied-android', 'denied-android-1-still-blocked');
    await page.getByTestId('door-cam-openlist').click();
    await page.waitForTimeout(900);
    note('denied-android/2', `after open list: body=${(await page.locator('[data-testid="door-screen"]').innerText()).replace(/\n+/g, ' | ').slice(0, 500)}`);
    await snap(page, 'denied-android', 'denied-android-2-list');
  });
}
test('ask -> Start -> Don\'t allow (denied)', async ({ page }) => {
  await openDoor(page, { perm: 'prompt', gum: 'NotAllowedError' });
  await page.getByTestId('door-cam-start').click();
  await page.waitForTimeout(1200);
  await state(page, 'ask-decline/1');
  await snap(page, 'ask-decline', 'ask-decline-1-after');
});
test('unknown (iOS: permission query throws)', async ({ page }) => {
  await openDoor(page, { perm: 'throws', gum: 'real', ua: 'iphone' });
  await state(page, 'unknown/0-load');
  await snap(page, 'unknown', 'unknown-0-load');
  if (await page.getByTestId('door-cam-start').count()) { await page.getByTestId('door-cam-start').click(); await page.waitForTimeout(1500); await state(page, 'unknown/1-after-start'); await snap(page, 'unknown', 'unknown-1-after-start'); }
});
test('no camera', async ({ page }) => {
  await openDoor(page, { perm: 'granted', gum: 'NotFoundError' });
  await state(page, 'none');
  await snap(page, 'none', 'none-0');
});
test('camera failed', async ({ page }) => {
  await openDoor(page, { perm: 'granted', gum: 'NotReadableError' });
  await state(page, 'failed');
  await snap(page, 'failed', 'failed-0');
});
