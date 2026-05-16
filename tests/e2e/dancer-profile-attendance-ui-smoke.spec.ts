/**
 * Phase 5.6 round 3 — Dancer profile attendance UI smoke
 *
 * Asserts the two public RPCs added in
 *   admin/supabase/migrations/20260602000000_get_profile_event_timeline_v2.sql
 *   admin/supabase/migrations/20260603000000_get_my_event_attendance_v1.sql
 * surface correctly on /dancers/:id.
 *
 * Coverage:
 *   1. Anon viewer sees the public "Event appearances" timeline section and
 *      does NOT see the self-only "Your plans" block (which would mis-render
 *      the viewer's own attendance under someone else's profile).
 *   2. Self-viewer (mocked authed as the dancer's owner) sees both the public
 *      timeline AND the "Your plans" block.
 *
 * Uses route mocks for predictable data; no real Supabase calls.
 */

import { test, expect, type Page, type Route } from '@playwright/test';

const projectRef = 'stsdtacfauprzrdebmzg';
const dancerId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const ownerUserId = '99999999-1111-2222-3333-444444444444';
const otherEventId = '11111111-2222-3333-4444-555555555555';

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const dancerRecord = {
  id: dancerId,
  created_by: ownerUserId,
  first_name: 'Test',
  surname: 'Dancer',
  nationality: 'British',
  dance_started_year: 2020,
  favorite_styles: ['Sensual'],
  dance_role: 'Lead',
  looking_for_partner: false,
  instagram: null,
  facebook: null,
  avatar_url: null,
  website: null,
  achievements: null,
  favorite_songs: null,
  partner_search_role: null,
  partner_search_level: null,
  partner_practice_goals: null,
  partner_details: null,
  gallery_urls: null,
  cities: { name: 'London' },
};

const setupDancerRoutes = async (page: Page) => {
  await page.route('**/rest/v1/dancer_profiles*', async (route) => {
    if (route.request().method() === 'GET') {
      return json(route, dancerRecord);
    }
    return route.continue();
  });

  await page.route('**/rest/v1/rpc/get_profile_event_timeline_v2', async (route) => {
    return json(route, []); // No appearances; we just need the section to render
  });

  await page.route('**/rest/v1/rpc/get_my_event_attendance_v1', async (route) => {
    return json(route, [
      { event_id: otherEventId, status: 'going', updated_at: '2026-05-01T00:00:00Z' },
    ]);
  });

  await page.route('**/rest/v1/events*', async (route) => {
    if (route.request().method() === 'GET') {
      return json(route, [
        {
          id: otherEventId,
          name: 'Mock Event',
          city: 'London',
          country: 'UK',
          date: '2099-12-01',
          start_time: '2099-12-01T20:00:00Z',
          type: 'standard',
        },
      ]);
    }
    return route.continue();
  });
};

const setupAuthAsOwner = async (page: Page) => {
  const session = {
    access_token: 'mock-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: 4102444800,
    refresh_token: 'mock-refresh-token',
    user: {
      id: ownerUserId,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'owner@example.com',
      user_metadata: { first_name: 'Test', surname: 'Dancer' },
    },
  };

  await page.addInitScript(
    ({ session, ref }) => {
      localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session));
    },
    { session, ref: projectRef },
  );

  await page.route('**/auth/v1/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/v1/user')) {
      return json(route, session.user);
    }
    return json(route, {});
  });
};

test('anon viewer sees public timeline but no Your plans block', async ({ page, context }) => {
  await context.clearCookies();
  await setupDancerRoutes(page);

  await page.goto(`/dancers/${dancerId}`);

  await expect(page.getByRole('heading', { name: 'Event appearances' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your plans' })).toHaveCount(0);
});

test('self-viewer sees both public timeline and Your plans block', async ({ page }) => {
  await setupAuthAsOwner(page);
  await setupDancerRoutes(page);

  await page.goto(`/dancers/${dancerId}`);

  await expect(page.getByRole('heading', { name: 'Event appearances' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your plans' })).toBeVisible();
});
