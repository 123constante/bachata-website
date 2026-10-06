import { test, expect, type Page, type Route } from '@playwright/test';

// Lever 2 W2: the organiser home on /account (mockup 01-B under 01-C's
// "needs you" notice). organiser_home_v1 is mocked with a real-shaped payload;
// e2e-smoke.yml turns VITE_ENABLE_ORGANISER_SELF_SERVE on.

const projectRef = 'stsdtacfauprzrdebmzg';
const userId = '11111111-1111-1111-1111-111111111111';
const TODAY = '2026-10-04';

const b64url = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

/** A PostgREST refusal: the RPC's RAISE EXCEPTION '<code>' as the client reads it. */
const refuse = (route: Route, code: string) => json(route, { code: 'P0001', message: code, details: null, hint: null }, 400);

const date = (d: string, over: Record<string, unknown> = {}) => ({
  occurrence_id: `occ-${d}`,
  occurrence_date: d,
  lifecycle_status: 'scheduled',
  materialised_start_utc: `${d}T19:30:00+00:00`,
  version: 1,
  has_own_changes: false,
  ...over,
});

const series = (over: Record<string, unknown>) => ({
  id: 'ser-1',
  name: 'Tuesday Bachata Class',
  slug: 'tuesday-bachata-class',
  format: 'recurring',
  category: 'class',
  lifecycle_status: 'live',
  version: 3,
  default_city_id: null,
  default_venue_id: null,
  default_local_start_time: '19:00:00',
  default_cover_image_url: null,
  updated_at: '2026-10-01T10:00:00Z',
  upcoming_count: 12,
  next_dates: [],
  latest_decision: null,
  ...over,
});

const organiser = (over: Record<string, unknown>) => ({
  id: 'org-1',
  name: 'Ritmo Bachata London',
  slug: 'ritmo-bachata-london',
  avatar_url: null,
  city_id: null,
  lifecycle_status: 'live',
  role: 'owner',
  is_primary: true,
  joined_at: '2026-10-01T10:00:00Z',
  latest_decision: null,
  series: [],
  ...over,
});

type SubmitMock = { status: 'ok' } | { status: 'refuse'; code: string };

/**
 * submit_organiser_profile_v1 answers like the server (admin D6): on success
 * the organiser is pending_review from then on, so the refetched home agrees.
 * A refusal plays the case the server refuses for: the team moved the
 * organiser to pending_review meanwhile, which the refetched home then shows.
 * Returns the submit bodies seen and a live count of organiser_home_v1 reads.
 */
async function openHome(page: Page, organisers: Record<string, unknown>[], submit: SubmitMock = { status: 'ok' }) {
  const submits: unknown[] = [];
  const reads = { home: 0 };
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
    if (path.endsWith('/rpc/organiser_home_v1')) {
      reads.home += 1;
      return json(route, { today: TODAY, organisers });
    }
    if (path.endsWith('/rpc/submit_organiser_profile_v1')) {
      const body = route.request().postDataJSON() as { p_organiser_id?: string };
      submits.push(body);
      const org = organisers.find((o) => o.id === body.p_organiser_id);
      const from = org?.lifecycle_status;
      if (org) org.lifecycle_status = 'pending_review';
      if (submit.status === 'refuse') return refuse(route, submit.code);
      return json(route, { organiser_id: body.p_organiser_id, from_state: from, lifecycle_status: 'pending_review', audit_id: 'audit-1' });
    }
    return json(route, []);
  });
  await page.goto('/account');
  await expect(page.getByTestId('account-page')).toBeVisible();
  return { submits, reads };
}

for (const width of [390, 768, 1280]) {
  test.describe(`organiser home @${width}`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('lists series with their next dates under the "needs you" notice', async ({ page }) => {
      await openHome(page, [
        organiser({
          series: [
            series({
              next_dates: [
                date(TODAY),
                date('2026-10-13', { lifecycle_status: 'cancelled' }),
                date('2026-10-20', { has_own_changes: true }),
              ],
            }),
            series({ id: 'ser-2', name: 'Bachata Sundays Party', slug: 'sundays', format: 'one_off', category: 'party',
              lifecycle_status: 'pending_review', upcoming_count: 1, next_dates: [date('2026-10-11')] }),
          ],
        }),
      ]);

      const notice = page.getByTestId('attention-notice');
      await expect(notice.getByTestId('attention-in_review')).toContainText('Bachata Sundays Party');
      await expect(notice.getByTestId('attention-cancelled')).toContainText('Tue 13 Oct');
      await expect(notice.getByTestId('attention-tonight')).toContainText('at 19:30');

      const tuesday = page.getByTestId('series-card').filter({ hasText: 'Tuesday Bachata Class' });
      await expect(tuesday.getByTestId('series-date')).toHaveCount(3);
      await expect(tuesday.getByTestId('series-date').first()).toContainText('Tonight');
      await expect(tuesday.getByTestId('date-cancelled')).toHaveCount(1);
      await expect(tuesday).toContainText('Changed for this date');
      await expect(tuesday.getByTestId('view-as-dancer')).toHaveAttribute('href', '/event/tuesday-bachata-class');
      // Only a live series gets a public link.
      const sundays = page.getByTestId('series-card').filter({ hasText: 'Bachata Sundays Party' });
      await expect(sundays.getByTestId('view-as-dancer')).toHaveCount(0);

      await page.screenshot({ path: `test-results/organiser-home-${width}.png`, fullPage: true });
    });
  });
}

for (const width of [390, 768, 1280]) {
  test.describe(`send for review @${width}`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('a draft organiser is sent for review and then reads In review', async ({ page }) => {
      const { submits } = await openHome(page, [organiser({ lifecycle_status: 'draft' })]);
      await expect(page.getByTestId('organiser-status')).toHaveText('Draft');
      await page.getByTestId('send-for-review').click();
      await expect(page.getByTestId('organiser-status')).toHaveText('In review');
      await expect(page.getByTestId('organiser-status-note')).toHaveText('The team checks new organisers within a day.');
      await expect(page.getByTestId('send-for-review')).toHaveCount(0);
      await expect(page.getByTestId('account-confirmation')).toContainText('Sent for review');
      expect(submits).toEqual([{ p_organiser_id: 'org-1' }]);
      await page.screenshot({ path: `test-results/organiser-send-for-review-${width}.png`, fullPage: true });
    });

    test('a rejected organiser sees the reason, then the button', async ({ page }) => {
      const { submits } = await openHome(page, [
        organiser({
          lifecycle_status: 'rejected',
          latest_decision: { action: 'reject', from_state: 'pending_review', to_state: 'rejected',
            reason: 'Add your Instagram so we can check it is you', created_at: '2026-10-03T10:00:00Z' },
        }),
      ]);
      const note = page.getByTestId('organiser-status-note');
      await expect(note).toHaveText('Ritmo Bachata London needs changes: Add your Instagram so we can check it is you');
      const button = page.getByTestId('send-for-review');
      await expect(button).toBeVisible();
      // The reason sits above the button.
      const [noteBox, buttonBox] = [await note.boundingBox(), await button.boundingBox()];
      expect(noteBox!.y).toBeLessThan(buttonBox!.y);
      await button.click();
      await expect(page.getByTestId('organiser-status')).toHaveText('In review');
      expect(submits).toEqual([{ p_organiser_id: 'org-1' }]);
    });

    test('an invalid_state refusal re-reads the home and keeps its explanation', async ({ page }) => {
      const { reads } = await openHome(page, [organiser({ lifecycle_status: 'draft' })], { status: 'refuse', code: 'invalid_state' });
      await expect(page.getByTestId('send-for-review')).toBeVisible();
      const before = reads.home;
      await page.getByTestId('send-for-review').click();
      // The team had moved the organiser meanwhile: the re-read home shows where
      // it is, the button goes, the refusal stays, and nothing is confirmed.
      await expect.poll(() => reads.home).toBeGreaterThan(before);
      await expect(page.getByTestId('organiser-status')).toHaveText('In review');
      await expect(page.getByTestId('send-for-review')).toHaveCount(0);
      await expect(page.getByTestId('send-for-review-error')).toHaveText(
        'Nothing to send: this organiser is already in review, live, or no longer active.',
      );
      await expect(page.getByTestId('account-confirmation')).toHaveCount(0);
    });
  });
}

test('live and in-review organisers are not offered "Send for review"', async ({ page }) => {
  await openHome(page, [organiser({}), organiser({ id: 'org-2', name: 'Latino Nights', lifecycle_status: 'pending_review' })]);
  await expect(page.getByTestId('organiser-home')).toBeVisible();
  await expect(page.getByTestId('send-for-review')).toHaveCount(0);
  await page.getByRole('button', { name: 'Latino Nights' }).click();
  await expect(page.getByTestId('organiser-status')).toHaveText('In review');
  await expect(page.getByTestId('send-for-review')).toHaveCount(0);
});

test('an organiser with no series sees the empty state and no notice', async ({ page }) => {
  await openHome(page, [organiser({ lifecycle_status: 'draft', series: [] })]);
  await expect(page.getByTestId('home-empty')).toBeVisible();
  await expect(page.getByTestId('attention-notice')).toHaveCount(0);
});

test('several organisers: choosing one shows its home', async ({ page }) => {
  await openHome(page, [
    organiser({ series: [series({})] }),
    organiser({ id: 'org-2', name: 'Latino Nights', series: [series({ id: 'ser-9', name: 'Friday Salsa Party' })] }),
  ]);
  await expect(page.getByTestId('series-card')).toContainText('Tuesday Bachata Class');
  await page.getByRole('button', { name: 'Latino Nights' }).click();
  await expect(page.getByTestId('series-card')).toContainText('Friday Salsa Party');
});
