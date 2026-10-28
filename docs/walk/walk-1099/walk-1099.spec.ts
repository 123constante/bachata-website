// THROWAWAY walk spec (not part of PR #1086). Copy into tests/e2e/ of a checkout at 59cb27b and run:
//   WALK_OUT=<dir> npx playwright test tests/e2e/walk-1086.spec.ts --project=chromium
// Reuses the PR's own network stubs (tests/e2e/ambassador-queue.spec.ts), FLOWING clock throughout.
import { test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { ME, NOW, PHONE, json, projectRef } from './helpers/organiserFake';

test.use({ viewport: PHONE });
test.describe.configure({ mode: 'serial' });

const OUT = process.env.WALK_OUT ?? 'walk-out';
mkdirSync(OUT, { recursive: true });
const CITY = 'c1000000-0000-4000-8000-0000000000b1';
const ago = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const mk = (id: string, type: 'organiser' | 'series', name: string, d: number, extra: Record<string, unknown> = {}) => ({
  target_type: type, target_id: id, name, city_id: CITY, city_name: 'Bristol', lifecycle_status: 'pending_review',
  submitted_at: ago(d), organiser_ids: [], submitter_email: 'private.person@example.com', public_slug: id,
  organiser_names: null, next_occurrence_dates: null, future_occurrence_count: null, venue_name: null,
  price_min: null, price_max: null, price_currency: null, has_flyer: null, ...extra,
});
const series = (id: string, name: string, d: number, extra: Record<string, unknown> = {}) =>
  mk(id, 'series', name, d, { organiser_names: [], price_currency: 'GBP', next_occurrence_dates: ['2026-10-29', '2026-11-05', '2026-11-12'], future_occurrence_count: 13, venue_name: 'The Lantern Rooms', price_min: 8, price_max: 8, has_flyer: true, ...extra });
// 12 mixed items: ages 0..12 days, one non-GBP, one bare organiser (o4), one party item (s1 via selfApprove).
const ITEMS = [
  series('s1', 'Thursday Bachata at The Lantern', 12),
  mk('o2', 'organiser', 'Harbourside Dance Collective', 9),
  series('s3', 'Sunday Social Sensual', 6, { price_min: 0, price_max: 0, has_flyer: false }),
  mk('o4', 'organiser', 'Bristol Bachata Beginners', 5),
  series('s5', 'Tuesday Improvers Class', 4, { price_currency: 'EUR', price_min: 10, price_max: 12 }),
  mk('o6', 'organiser', 'Moonlight Moderna Crew', 3),
  series('s7', 'Friday Latin Night', 2),
  series('s8', 'Bachata Fundamentals Workshop', 1, { future_occurrence_count: 1, next_occurrence_dates: ['2026-11-08'] }),
  mk('o9', 'organiser', 'Redcliffe Sensual', 1),
  series('s10', 'Saturday Daytime Social', 0),
  mk('o11', 'organiser', 'Southville Salsa and Bachata', 0),
  series('s12', 'Bachata Weekender Warm-Up', 0),
];
const HUNDRED = Array.from({ length: 100 }, (_, i) => (i % 2 ? mk(`h${i}`, 'organiser', `Walk organiser ${i}`, i % 13) : series(`h${i}`, `Walk series ${i}`, i % 13)));

const F1_PAGE0 = Array.from({ length: 100 }, (_, i) => (i % 2 ? mk(`f${i}`, 'organiser', `Recent organiser ${i}`, i % 3) : series(`f${i}`, `Recent series ${i}`, i % 3)));
const F1_OLD = mk('old1', 'organiser', 'Thirty Day Old Organiser', 30);

const BIG = Array.from({ length: 1000 }, (_, i) => mk(`b${i}`, 'organiser', `Big organiser ${i}`, i % 20));

type Mode = { f1?: boolean; big?: boolean; hold?: Promise<void>; failList?: { on: boolean }; goneOnApprove?: boolean; selfApprove?: string[]; noAccess?: boolean; listStatus?: number; listBody?: unknown; empty?: boolean; hundred?: boolean };
const b64url = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function install(page: Page, m: Mode = {}) {
  const queue = m.f1 ? [...F1_PAGE0] : m.empty ? [] : m.hundred ? [...HUNDRED] : [...ITEMS].reverse();
  const user = { id: ME, aud: 'authenticated', role: 'authenticated', email: 'jan@bristol.example', user_metadata: {} };
  const token = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: ME, role: 'authenticated', amr: [{ method: 'otp', timestamp: 1 }] })}.sig`;
  await page.clock.install({ time: NOW }); // FLOWING clock
  await page.addInitScript(
    ({ value, ref }) => localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(value)),
    { value: { access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'r', user }, ref: projectRef },
  );
  await page.route('**/auth/v1/**', (route) => (route.request().url().includes('/auth/v1/user') ? json(route, user) : json(route, {})));
  await page.route('**/rest/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const rpc = url.pathname.match(/\/rpc\/([a-z0-9_]+)$/)?.[1];
    if (url.pathname.endsWith('/entity_members')) return json(route, m.noAccess ? [] : [{ entity_id: CITY }]);
    if (url.pathname.endsWith('/cities')) return json(route, [{ id: CITY, name: 'Bristol', slug: 'bristol' }]);
    if (!rpc) return json(route, []);
    const body = (req.postDataJSON?.() ?? {}) as Record<string, unknown>;
    if (rpc === 'admin_list_pending_review_v1') {
      if (m.failList?.on) return json(route, { code: 'XX000', message: 'boom', details: null, hint: null }, 500);
      if (m.listStatus) return json(route, m.listBody, m.listStatus);
      if (m.big) return json(route, BIG.slice(Number(body.p_offset), Number(body.p_offset) + 100));
      if (m.f1) {
        if (body.p_offset === 0) return json(route, queue);
        if (body.p_offset === 100) { await m.hold; return json(route, [F1_OLD]); }
        return json(route, []);
      }
      return json(route, body.p_offset === 0 ? queue : []);
    }
    if (rpc === 'admin_approve_entity_v1' || rpc === 'admin_reject_entity_v1') {
      if (m.selfApprove?.includes(String(body.p_target_id))) return json(route, { code: 'P0001', message: 'self_approval_not_allowed', details: null, hint: null }, 400);
      if (m.goneOnApprove) { const g = queue.findIndex((q) => q.target_id === body.p_target_id); if (g >= 0) queue.splice(g, 1); return json(route, { code: 'P0001', message: 'not_authorised', details: null, hint: null }, 400); }
      const at = queue.findIndex((q) => q.target_id === body.p_target_id);
      if (at >= 0) queue.splice(at, 1);
      return json(route, { ok: true });
    }
    return json(route, null);
  });
}

const records: unknown[] = [];
let errors: string[] = [];
const watch = (page: Page) => {
  errors = [];
  page.on('console', (c) => c.type() === 'error' && errors.push(`console: ${c.text().slice(0, 160)}`));
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.slice(0, 160)}`));
};

async function shot(page: Page, n: number, name: string, note = '') {
  await page.waitForTimeout(400);
  const file = `${String(n).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: `${OUT}/${file}` }); // viewport only, not fullPage
  const m = await page.evaluate(() => {
    const vh = window.innerHeight;
    const box = (sel: string) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), bottom: Math.round(r.bottom) };
    };
    const overlay = document.querySelector('[data-testid="decision-overlay"]');
    const root: ParentNode = overlay ?? document;
    const small: string[] = [];
    root.querySelectorAll('a,button,input,textarea,select,[role=button]').forEach((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || (el as HTMLElement).offsetParent === null && cs.position !== 'fixed') return;
      if (el.closest('[hidden]')) return;
      if (r.bottom < 0 || r.top > vh) return; // only what is on screen
      if (r.width < 44 || r.height < 44) small.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 28)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    });
    const lum = (c: string) => { const m = c.match(/[\d.]+/g)!.map(Number); const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
    const bgOf = (el: Element): string => { let e: Element | null = el; while (e) { const b = getComputedStyle(e).backgroundColor; const a = b.match(/[\d.]+/g)!; if (!(a.length === 4 && Number(a[3]) === 0)) return b; e = e.parentElement; } return 'rgb(255, 255, 255)'; };
    const contrast = (sel: string) => Array.from(document.querySelectorAll(sel)).slice(0, 40).map((el) => { const fg = getComputedStyle(el).color; const bg = bgOf(el); const a = lum(fg) + 0.05, b2 = lum(bg) + 0.05; return { text: (el.textContent || '').trim().slice(0, 24), fg, bg, ratio: Math.round((Math.max(a, b2) / Math.min(a, b2)) * 100) / 100 }; });
    const chips = contrast('[data-testid=age-chip]');
    const ageBar = contrast('[data-testid=age-bar]');
    const ageBarText = document.querySelector('[data-testid=age-bar]')?.textContent?.trim() ?? null;
    const clipped: string[] = [];
    (overlay ?? document.body).querySelectorAll('h1,h2,h3,p,span,a,button,li,label').forEach((el) => { const r = el.getBoundingClientRect(); if (r.width === 0 || r.bottom < 0 || r.top > vh) return; const cs = getComputedStyle(el); const x = el.scrollWidth > el.clientWidth + 1 && cs.overflow !== 'visible' && cs.display !== 'inline'; const y = el.scrollHeight > el.clientHeight + 1 && cs.overflowY !== 'visible' && cs.display !== 'inline'; if (x || y || r.right > window.innerWidth + 1) clipped.push(`${el.tagName.toLowerCase()} "${(el.textContent || '').trim().slice(0, 28)}"`); });
    const de = document.documentElement;
    return {
      scrollY: Math.round(window.scrollY), docHeight: de.scrollHeight, scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, vh,
      sheet: box('[role=dialog]'), confirm: box('[data-testid=approve-confirm]') ?? box('[data-testid=reject-submit]'),
      toast: box('[data-testid=toast]'), chips, ageBar, ageBarText, clipped, rowCount: document.querySelectorAll('[data-testid=queue-row]').length, back: box('[data-testid=review-back]'), small,
    };
  });
  records.push({ n, file, name, note, ...m, errors: errors.map((e) => e.slice(0, 110)) });
  errors = []; // per-screenshot: only what happened since the previous shot
  writeFileSync(`${OUT}/measurements.json`, JSON.stringify(records, null, 1));
}

test('A: Jan, 12 items', async ({ page }) => {
  watch(page);
  await install(page, { selfApprove: ['s1'] });
  await page.goto('/ambassador');
  const rows = page.getByTestId('queue-row');
  await rows.first().waitFor();
  await shot(page, 1, 'list');
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await shot(page, 2, 'list-scrolled-bottom');
  await page.evaluate(() => window.scrollTo(0, 0));
  await rows.nth(1).click(); // o2 -> review (series vs bare organiser below)
  await page.getByTestId('review-view').waitFor();
  await page.getByTestId('review-back').click();
  // (3) a series: s3 (4th row = index 3? order is oldest first -> s1,o2,s3,...)
  await page.getByTestId('queue-row').nth(2).click();
  await page.getByTestId('review-view').waitFor();
  await shot(page, 3, 'review-series', 'Sunday Social Sensual, free, no flyer');
  await page.getByTestId('review-back').click();
  await page.getByTestId('queue-row').nth(3).click(); // o4 bare organiser
  await page.getByTestId('review-view').waitFor();
  await shot(page, 4, 'review-bare-organiser', 'Bristol Bachata Beginners, all series fields NULL');
  await page.getByTestId('approve-open').click();
  await page.getByTestId('approve-confirm').waitFor();
  await shot(page, 5, 'approve-sheet');
  await page.keyboard.press('Escape');
  await page.getByTestId('reject-open').click();
  await page.getByTestId('reject-submit').click();
  await page.getByTestId('reject-reason-error').waitFor();
  await shot(page, 6, 'reject-sheet-empty-error');
  await page.getByRole('textbox').fill('The flyer shows another venue.');
  await shot(page, 7, 'reject-sheet-reason');
  await page.keyboard.press('Escape');
  await page.getByTestId('approve-open').click();
  await page.getByTestId('approve-confirm').click();
  await page.getByTestId('toast').waitFor();
  await shot(page, 8, 'toast-after-approve', 'approve from review (scrollY 0 there); returned to list');
  await page.waitForTimeout(3800);
  // (9) the party item s1
  await page.getByTestId('queue-row').first().click();
  await page.getByTestId('approve-open').click();
  await page.getByTestId('approve-confirm').click();
  await page.getByTestId('party-note').waitFor();
  await shot(page, 9, 'self-approval-refusal');
});

test('B: no access', async ({ page }) => {
  watch(page);
  await install(page, { noAccess: true });
  await page.goto('/ambassador');
  await page.getByText(/access/i).first().waitFor();
  await shot(page, 10, 'no-access');
});

test('C: signed out (401)', async ({ page }) => {
  watch(page);
  await install(page, { listStatus: 401, listBody: { code: 'PGRST301', message: 'JWT expired', details: null, hint: null } });
  await page.goto('/ambassador');
  await page.getByText(/sign/i).first().waitFor();
  await shot(page, 11, 'signed-out-401');
});

test('D: list RPC error', async ({ page }) => {
  watch(page);
  await install(page, { listStatus: 500, listBody: { code: 'XX000', message: 'boom', details: null, hint: null } });
  await page.goto('/ambassador');
  await page.getByText(/try again|retry/i).first().waitFor();
  await shot(page, 12, 'list-rpc-error');
});

test('E: caught up', async ({ page }) => {
  watch(page);
  await install(page, { empty: true });
  await page.goto('/ambassador');
  await page.getByText(/caught up/i).first().waitFor();
  await shot(page, 13, 'all-caught-up');
});

test('G: F1 101 rows, page 2 held', async ({ page }) => {
  watch(page);
  let release!: () => void;
  const hold = new Promise<void>((r) => (release = r));
  await install(page, { f1: true, hold });
  await page.goto('/ambassador');
  await page.getByTestId('queue-loading').waitFor();
  await shot(page, 15, 'f1-skeleton-while-page-2-held', 'page 1 is back, page 2 is held: list must not show yet');
  release();
  await page.getByTestId('queue-row').first().waitFor();
  await page.waitForTimeout(500);
  await shot(page, 16, 'f1-list-30-day-on-top', 'the 30-day item first, bar says Oldest waiting 30 days');
  await page.getByTestId('queue-count').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await shot(page, 17, 'f1-bottom-no-show-more', 'no Show more button at the bottom');
});

test('G2: F1 cap 1000 rows', async ({ page }) => {
  watch(page);
  await install(page, { big: true });
  await page.goto('/ambassador');
  await page.getByTestId('queue-row').first().waitFor({ timeout: 30000 });
  await shot(page, 18, 'f1-cap-oldest-loaded', 'bar Oldest loaded + capped note');
});

test('H: F2 moved then approve', async ({ page }) => {
  watch(page);
  await install(page, { goneOnApprove: true });
  await page.goto('/ambassador');
  await page.getByTestId('queue-row').first().waitFor();
  const before = await page.getByTestId('queue-row').count();
  await page.getByTestId('queue-row').nth(1).click();
  await page.getByTestId('approve-open').click();
  await shot(page, 19, 'f2-approve-sheet');
  await page.getByTestId('approve-confirm').click();
  await page.getByTestId('toast').waitFor();
  await shot(page, 20, 'f2-toast-changed-list', `sheet closed, toast, back on list; rows ${before} -> after (see rowCount), url ${'/ambassador'}`);
  records.push({ n: 20.5, url: new URL(page.url()).pathname, rowsBefore: before, rowsAfter: await page.getByTestId('queue-row').count() });
});

test('I: F4 deep link not in queue', async ({ page }) => {
  watch(page);
  await install(page, {});
  await page.goto('/ambassador/review/organiser/nope-123');
  await page.getByTestId('review-gone').waitFor();
  await shot(page, 21, 'f4-not-in-your-queue');
});

test('J: F5 stale refresh failure', async ({ page }) => {
  watch(page);
  const failList = { on: false };
  await install(page, { failList, selfApprove: ['s1'] });
  await page.goto('/ambassador');
  await page.getByTestId('queue-row').first().waitFor();
  // A real refetch trigger: the self-approval refusal invalidates the queue; the list RPC now fails.
  await page.getByTestId('queue-row').first().click();
  await page.getByTestId('approve-open').click();
  failList.on = true;
  await page.getByTestId('approve-confirm').click();
  await page.getByTestId('party-note').waitFor();
  await page.getByTestId('review-back').click();
  await page.getByTestId('queue-stale').waitFor({ timeout: 20000 });
  await shot(page, 22, 'f5-stale-line-try-again', 'rows stay, line + Try again above the age bar');
});

test('F: 100-row page', async ({ page }) => {
  watch(page);
  await install(page, { hundred: true });
  await page.goto('/ambassador');
  await page.getByTestId('queue-row').first().waitFor();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await shot(page, 14, 'list-100-bottom', 'extra: 100-row page variant, bottom (more-note)');
});
