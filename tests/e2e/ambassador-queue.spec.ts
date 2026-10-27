import { expect, test, type Page } from '@playwright/test';
import { ME, NOW, PHONE, json, projectRef } from './helpers/organiserFake';

// Ambassador A1 (option B): a Jan-shaped ambassador with 12 mixed items, walked list -> review ->
// approve and reject. Every Supabase REST/auth call is answered at the network layer, so nothing
// leaves the browser and no ambassador account is needed (none exists on prod).

test.use({ viewport: PHONE });

const CITY = 'c1000000-0000-4000-8000-0000000000b1';
const ago = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const mk = (id: string, type: 'organiser' | 'series', name: string, d: number, extra: Record<string, unknown> = {}) => ({
  target_type: type, target_id: id, name, city_id: CITY, city_name: 'Bristol', lifecycle_status: 'pending_review',
  submitted_at: ago(d), organiser_ids: [], submitter_email: 'private.person@example.com', public_slug: id,
  organiser_names: [name], next_occurrence_dates: [], future_occurrence_count: 0, venue_name: null,
  price_min: null, price_max: null, price_currency: 'GBP', has_flyer: false, ...extra,
});
const series = (id: string, name: string, d: number, extra: Record<string, unknown> = {}) =>
  mk(id, 'series', name, d, { next_occurrence_dates: ['2026-10-29', '2026-11-05', '2026-11-12'], future_occurrence_count: 13, venue_name: 'The Lantern Rooms', price_min: 8, price_max: 8, has_flyer: true, ...extra });
const ITEMS = [
  series('s1', 'Thursday Bachata at The Lantern', 9),
  mk('o2', 'organiser', 'Harbourside Dance Collective', 6),
  series('s3', 'Sunday Social Sensual', 5, { price_min: 0, price_max: 0, has_flyer: false }),
  mk('o4', 'organiser', 'Bristol Bachata Beginners', 3),
  series('s5', 'Tuesday Improvers Class', 3),
  mk('o6', 'organiser', 'Moonlight Moderna Crew', 2),
  series('s7', 'Friday Latin Night', 2),
  series('s8', 'Bachata Fundamentals Workshop', 1, { future_occurrence_count: 1, next_occurrence_dates: ['2026-11-08'] }),
  mk('o9', 'organiser', 'Redcliffe Sensual', 1),
  series('s10', 'Saturday Daytime Social', 0),
  mk('o11', 'organiser', 'Southville Salsa and Bachata', 0),
  series('s12', 'Bachata Weekender Warm-Up', 0),
];

const b64url = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function install(page: Page, opts: { selfApprove?: string[] } = {}) {
  const queue = [...ITEMS].reverse(); // the RPC returns newest first
  const sent: { fn: string; body: Record<string, unknown> }[] = [];
  const user = { id: ME, aud: 'authenticated', role: 'authenticated', email: 'jan@bristol.example', user_metadata: {} };
  const token = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: ME, role: 'authenticated', amr: [{ method: 'otp', timestamp: 1 }] })}.sig`;
  await page.clock.setFixedTime(NOW);
  await page.addInitScript(
    ({ value, ref }) => localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(value)),
    { value: { access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'r', user }, ref: projectRef },
  );
  await page.route('**/auth/v1/**', (route) => (route.request().url().includes('/auth/v1/user') ? json(route, user) : json(route, {})));
  await page.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const rpc = new URL(req.url()).pathname.match(/\/rpc\/([a-z0-9_]+)$/)?.[1];
    if (!rpc) return json(route, []);
    const body = (req.postDataJSON?.() ?? {}) as Record<string, unknown>;
    if (rpc === 'admin_get_my_city_scopes') return json(route, [{ city_id: CITY, city_name: 'Bristol', city_slug: 'bristol' }]);
    if (rpc === 'admin_list_pending_review_v1') return json(route, body.p_offset === 0 ? queue : []);
    if (rpc === 'admin_approve_entity_v1' || rpc === 'admin_reject_entity_v1') {
      sent.push({ fn: rpc, body });
      if (opts.selfApprove?.includes(String(body.p_target_id))) return json(route, { code: 'P0001', message: 'self_approval_not_allowed', details: null, hint: null }, 400);
      const at = queue.findIndex((q) => q.target_id === body.p_target_id);
      if (at >= 0) queue.splice(at, 1);
      return json(route, { ok: true });
    }
    return json(route, null);
  });
  return sent;
}

test('list -> review -> approve, then reject, with the right RPC bodies and no email anywhere', async ({ page }) => {
  const sent = await install(page);
  await page.goto('/ambassador');
  const rows = page.getByTestId('queue-row');
  await expect(rows).toHaveCount(12);
  await expect(page.getByTestId('queue-count')).toHaveText('12');
  await expect(rows.first()).toContainText('Thursday Bachata at The Lantern');
  await expect(page.getByTestId('age-bar')).toContainText('Oldest waiting 9 days');

  await rows.first().click();
  await expect(page).toHaveURL(/\/ambassador\/review\/series\/s1$/);
  await expect(page.getByTestId('review-view')).toContainText('+ 10 more (13 in all)');
  await page.getByTestId('approve-open').click();
  await page.getByTestId('approve-confirm').click();
  await expect(page.getByTestId('toast')).toHaveText('Approved: Thursday Bachata at The Lantern. 11 left.');
  await expect(page).toHaveURL(/\/ambassador$/);
  await expect(rows).toHaveCount(11);

  await rows.first().click();
  await page.getByTestId('reject-open').click();
  await page.getByTestId('reject-submit').click();
  await expect(page.getByTestId('reject-reason-error')).toContainText('Say why');
  await page.getByRole('textbox').fill('Not clear');
  await page.getByTestId('reject-submit').click();
  await expect(page.getByTestId('reject-reason-error')).toContainText('9 of 10');
  expect(sent.filter((s) => s.fn === 'admin_reject_entity_v1')).toHaveLength(0);
  await page.getByRole('textbox').fill('The flyer shows another venue.');
  await page.getByTestId('reject-submit').click();
  await expect(page.getByTestId('toast')).toContainText('Rejected: Harbourside Dance Collective. 10 left.');
  await expect(rows).toHaveCount(10);
  expect(sent).toEqual([
    { fn: 'admin_approve_entity_v1', body: { p_target_type: 'series', p_target_id: 's1' } },
    { fn: 'admin_reject_entity_v1', body: { p_target_type: 'organiser', p_target_id: 'o2', p_reason: 'The flyer shows another venue.' } },
  ]);
  expect(await page.content()).not.toContain('private.person@example.com');
});

test('an item the ambassador is part of turns into "needs an admin" and stays listed', async ({ page }) => {
  await install(page, { selfApprove: ['s1'] });
  await page.goto('/ambassador');
  await page.getByTestId('queue-row').first().click();
  await page.getByTestId('approve-open').click();
  await page.getByTestId('approve-confirm').click();
  await expect(page.getByTestId('party-note')).toContainText('an admin has to decide it');
  await expect(page.getByTestId('approve-open')).toHaveCount(0);
  await page.getByTestId('review-back').click();
  await expect(page.getByTestId('queue-row')).toHaveCount(12);
  await expect(page.getByTestId('queue-row').first()).toContainText('Needs an admin');
});

test('Back from a review returns to the list at the same scroll position; taps are at least 44px; no sideways scroll', async ({ page }) => {
  await install(page);
  await page.goto('/ambassador');
  const rows = page.getByTestId('queue-row');
  await expect(rows).toHaveCount(12);
  const heights = await rows.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  expect(heights.filter((x) => x < 44)).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 220));
  const before = await page.evaluate(() => window.scrollY);
  await rows.nth(9).click();
  await expect(page.getByTestId('review-view')).toBeVisible();
  await page.goBack();
  await expect(rows.first()).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
