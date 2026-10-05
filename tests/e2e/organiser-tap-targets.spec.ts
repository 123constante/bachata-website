import { test, expect, type Page, type Route } from '@playwright/test';

// Lever 2 S4: every interactive control on the organiser self-serve screens
// (/account, /account/new, /account/series/:id, /account/team/:id) is at least
// 44px high (PRODUCT.md: touch targets minimum 44px), and none of the screens
// scrolls horizontally. Mocked backend, same style as organiser-home.spec.ts.
// The measurement is the element's bounding box, so a text link has to GROW its
// hit area (padding / min-height) without its text getting bigger.

const projectRef = 'stsdtacfauprzrdebmzg';
const userId = '11111111-1111-1111-1111-111111111111';
const MIN = 44;

const isoDay = (offset: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

const b64url = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

const nextDates = [1, 8, 15].map((n, i) => ({
  occurrence_id: `occ-${i + 1}`,
  occurrence_date: isoDay(n),
  lifecycle_status: 'scheduled',
  materialised_start_utc: `${isoDay(n)}T19:30:00+00:00`,
  version: 1,
  has_own_changes: false,
}));

const seriesRow = (id: string, status: string, over: Record<string, unknown> = {}) => ({
  id,
  name: id === 'ser-live' ? 'Tuesday Bachata Class' : 'Friday Bachata Party',
  slug: id,
  format: 'recurring',
  category: 'class',
  lifecycle_status: status,
  version: 3,
  default_city_id: 'city-1',
  default_venue_id: 'ven-1',
  default_local_start_time: '19:30:00',
  default_duration: '02:00:00',
  default_level: 'beginner',
  default_ticket_url: null,
  default_description: 'Friendly weekly class.',
  default_cover_image_url: null,
  default_start_date: isoDay(-30),
  created_at: '2026-09-01T10:00:00+00:00',
  recurrence_rule: { mode: 'weekly', weekdays: [2], end: { kind: 'none' } },
  removed_dates: [] as string[],
  upcoming_count: 3,
  next_dates: nextDates,
  latest_decision: null as unknown,
  ...over,
});

const rejection = {
  action: 'reject',
  to_state: 'rejected',
  reason: 'Please add the venue address.',
  created_at: '2026-10-02T09:00:00Z',
};

const members = [
  { user_id: userId, member_role: 'owner', is_primary: true, joined_at: '2026-09-01T10:00:00+00:00', email: 'diego@ritmo.example', display_name: 'Diego R.', is_self: true },
  { user_id: '22222222-2222-2222-2222-222222222222', member_role: 'owner', is_primary: false, joined_at: '2026-09-02T10:00:00+00:00', email: 'sofia@ritmo.example', display_name: null, is_self: false },
  { user_id: '33333333-3333-3333-3333-333333333333', member_role: 'manager', is_primary: false, joined_at: '2026-09-03T10:00:00+00:00', email: 'ana@ritmo.example', display_name: 'Ana M.', is_self: false },
];

const VENUES = [{ id: 'ven-1', name: 'Studio 3, Battersea Arts Hub', neighbourhood: 'Battersea', city_name: 'London' }];

async function mock(page: Page) {
  const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'diego@ritmo.example', user_metadata: {} };
  const token = `${b64url({ alg: 'HS256' })}.${b64url({ sub: userId, amr: [{ method: 'otp', timestamp: 1 }] })}.sig`;
  await page.addInitScript(
    ({ value, ref }) => localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(value)),
    {
      value: { access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'r', user },
      ref: projectRef,
    },
  );
  await page.route('**/auth/v1/**', (route) => json(route, route.request().url().includes('/user') ? user : {}));
  await page.route('**/rest/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = (route.request().postDataJSON?.() ?? {}) as Record<string, unknown>;
    if (path.endsWith('/rpc/organiser_home_v1')) {
      return json(route, {
        today: isoDay(0),
        organisers: [{
          id: 'org-1', name: 'Ritmo Bachata London', slug: 'ritmo', avatar_url: null, city_id: null, lifecycle_status: 'live',
          role: 'owner', is_primary: true, joined_at: '2026-09-01T10:00:00+00:00', latest_decision: null,
          series: [seriesRow('ser-live', 'live'), seriesRow('ser-rej', 'rejected', { latest_decision: rejection })],
          team: members,
        }],
      });
    }
    if (path.endsWith('/rpc/admin_event_workspace_p5')) {
      const id = JSON.stringify(body).includes('ser-rej') ? 'ser-rej' : 'ser-live';
      const series = seriesRow(id, id === 'ser-live' ? 'live' : 'rejected');
      return json(route, {
        meta: { version: 3, has_more: false },
        series: { series, program: [] },
        occurrences: [...nextDates].reverse().map((d) => ({
          id: d.occurrence_id, occurrence_date: d.occurrence_date, lifecycle_status: 'scheduled', version: 1,
          has_override: false, session_overrides_count: 0, added_sessions_count: 0, materialised_start_utc: d.materialised_start_utc,
        })),
      });
    }
    if (path.endsWith('/rpc/get_organiser_venue_options_v1') || path.endsWith('/rpc/get_public_venues_list_v4')) return json(route, VENUES);
    if (path.endsWith('/rpc/list_organiser_access_requests_v1')) {
      if (body.p_scope === 'mine') return json(route, []);
      return json(route, [{
        request_id: 'req-1', user_id: '44444444-4444-4444-4444-444444444444', requester_email: 'maria.k@example.com',
        message: 'Can I get access?', created_at: '2026-10-03T09:00:00+00:00', organiser_name: 'Ritmo Bachata London',
      }]);
    }
    return json(route, []);
  });
}

/** Every visible control inside the screen (plus breadcrumbs and header account link), with its box. */
async function controls(page: Page) {
  return page.evaluate(() => {
    const roots = Array.from(document.querySelectorAll('[data-testid$="-page"], [data-testid="date-sheet"], nav[aria-label="breadcrumb"], [data-testid="header-account-link"]'));
    const seen = new Set<Element>();
    const out: { name: string; kind: string; h: number }[] = [];
    for (const root of roots) {
      const list = root.matches('a, button, input, select') ? [root] : Array.from(root.querySelectorAll('a, button, input, select, textarea, [role="button"]'));
      for (const el of list) {
        if (seen.has(el)) continue;
        seen.add(el);
        const input = el as HTMLInputElement;
        if (el.tagName === 'INPUT' && ['checkbox', 'radio', 'hidden'].includes(input.type)) continue;
        if ((el as HTMLElement).closest('[aria-hidden="true"]')) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const kind = el.tagName === 'A' ? 'link' : el.tagName === 'TEXTAREA' ? 'textarea' : el.tagName.toLowerCase();
        const label = (el.getAttribute('aria-label') || el.getAttribute('data-testid') || el.textContent || input.placeholder || input.id || '').trim().slice(0, 40);
        out.push({ name: `${kind}:${label}${r.height < 44 ? ' [' + (el.getAttribute('class') ?? '').slice(0, 90) + ']' : ''}`, kind, h: Math.round(r.height * 10) / 10 });
      }
    }
    return out;
  });
}

async function expectTapTargets(page: Page) {
  const found = await controls(page);
  expect(found.length, 'the screen has controls to measure').toBeGreaterThan(2);
  const small = found.filter((c) => c.h < MIN - 0.5);
  expect(small, `controls under ${MIN}px high`).toEqual([]);
  // Polled: the route's entrance animation can overshoot for a frame or two.
  const measure = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await expect.poll(measure, { message: 'document scrolls horizontally', timeout: 5000 }).toBeLessThanOrEqual(0);
}

for (const width of [390, 768, 1280]) {
  test.describe(`organiser self-serve tap targets @${width}`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('/account', async ({ page }) => {
      await mock(page);
      await page.goto('/account');
      await expect(page.getByTestId('series-card').first()).toBeVisible();
      await expectTapTargets(page);
      await page.getByRole('button', { name: /Add another organiser/ }).click();
      await expect(page.getByTestId('create-open').or(page.getByTestId('claim-open')).first()).toBeVisible();
      await expectTapTargets(page);
      await page.screenshot({ path: `test-results/tap-account-${width}.png`, fullPage: true });
    });

    test('/account/new', async ({ page }) => {
      await mock(page);
      await page.goto('/account/new');
      await expect(page.getByTestId('create-event')).toBeVisible();
      await expectTapTargets(page);
      await page.getByRole('button', { name: 'Change venue' }).first().click();
      await expect(page.getByPlaceholder(/venue/i).first()).toBeVisible();
      await expectTapTargets(page);
      await page.screenshot({ path: `test-results/tap-new-${width}.png`, fullPage: true });
    });

    test('/account/series/:id (live) and the date sheet', async ({ page }) => {
      await mock(page);
      await page.goto('/account/series/ser-live');
      await expect(page.getByTestId('series-date-row').first()).toBeVisible();
      await expectTapTargets(page);
      await page.screenshot({ path: `test-results/tap-series-${width}.png`, fullPage: true });
      await page.getByTestId('date-open').first().click();
      await expect(page.getByTestId('date-sheet')).toBeVisible();
      await expectTapTargets(page);
    });

    test('/account/series/:id (returned for changes)', async ({ page }) => {
      await mock(page);
      await page.goto('/account/series/ser-rej');
      await expect(page.getByTestId('review-submit')).toBeVisible();
      await expectTapTargets(page);
      await page.screenshot({ path: `test-results/tap-series-rejected-${width}.png`, fullPage: true });
    });

    test('/account/team/:id', async ({ page }) => {
      await mock(page);
      await page.goto('/account/team/org-1');
      await expect(page.getByTestId('team-title')).toBeVisible();
      await expectTapTargets(page);
      await page.screenshot({ path: `test-results/tap-team-${width}.png`, fullPage: true });
    });
  });
}
