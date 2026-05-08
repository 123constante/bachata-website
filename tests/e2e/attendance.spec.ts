/**
 * Attendance flow — Going / Not going / Waitlist on a known event.
 *
 * Reference: ~/.claude/plans/repo-bachata-admin-11april-phases-0-3-adaptive-pebble.md
 * (section 4.E — E2E coverage backfill after Phase 4.D consolidated event_attendees
 * RLS policies; this spec is the authoritative behavioural gate against future
 * policy regressions.)
 *
 * TODO (human, before un-fixme'ing):
 *   1. Pick a stable seed event id with capacity > 0 and a free slot. Replace
 *      EVENT_ID below. Prefer a long-lived published event in the seed
 *      database (calendar_events row, status='published').
 *   2. Provide a seed dancer auth session: either
 *        a) bake a storageState file under tests/e2e/.auth/dancer.json, or
 *        b) use the addInitScript pattern from
 *           dancer-dashboard-concept-b-smoke.spec.ts (mock supabase auth token
 *           in localStorage under sb-stsdtacfauprzrdebmzg-auth-token).
 *      Set DANCER_USER_ID + DANCER_AUTH_EMAIL to match.
 *   3. Confirm the rsvp button selectors:
 *        - data-testid='attendance-going'
 *        - data-testid='attendance-not-going'
 *        - data-testid='attendance-waitlist'
 *      If the actual testids differ, update both selectors and the
 *      expected-toast text below.
 *   4. The waitlist test requires a CAPACITY-FULL event. Either pick a second
 *      seed event id (EVENT_ID_FULL) or add a test fixture that fills the
 *      capacity before the test runs.
 *   5. Decide whether to assert on the new policy contract by inspecting the
 *      RPC response shape (rsvp_event_v1 / rsvp_status_v1) — recommended,
 *      because Phase 4.D consolidated the SELECT policies and a regression
 *      would silently change return shape.
 */

import { test, expect } from '@playwright/test';

const EVENT_ID = '00000000-0000-0000-0000-000000000000'; // TODO: replace with a published event with free capacity
const EVENT_ID_FULL = '00000000-0000-0000-0000-000000000001'; // TODO: replace with a capacity-full event
const DANCER_USER_ID = '99999999-1111-2222-3333-444444444444'; // TODO: align with seed dancer
const BASE = 'http://127.0.0.1:4173';

test.describe('attendance flow on event page', () => {
  test.fixme('signed-in dancer can mark Going on an event with capacity', async ({ page }) => {
    // Golden path:
    // 1. Sign in (storageState or init script).
    // 2. Navigate to /event/EVENT_ID.
    // 3. Click data-testid='attendance-going'.
    // 4. Expect toast / inline confirmation: /going/i.
    // 5. Reload page; assert button reflects persisted Going state.
    // 6. (Optional) Inspect rsvp_status_v1 RPC response to confirm
    //    consolidated SELECT policy returns the expected shape.
    await page.goto(`${BASE}/event/${EVENT_ID}`);
    await expect(page.getByTestId('attendance-going')).toBeVisible();
    await page.getByTestId('attendance-going').click();
    await expect(page.getByText(/going/i)).toBeVisible();
  });

  test.fixme('signed-in dancer can switch from Going to Not going', async ({ page }) => {
    // 1. Pre-state: dancer is Going (assumed from previous test or seeded).
    // 2. Navigate to /event/EVENT_ID.
    // 3. Click data-testid='attendance-not-going'.
    // 4. Expect toast / inline confirmation: /not going|removed/i.
    // 5. Reload; verify Going button is no longer the active variant.
    await page.goto(`${BASE}/event/${EVENT_ID}`);
    await page.getByTestId('attendance-not-going').click();
    await expect(page.getByText(/not going|removed/i)).toBeVisible();
  });

  test.fixme('capacity-full event routes attendance to Waitlist', async ({ page }) => {
    // Edge case — exercises the Phase 4.D policy contract on capacity overflow.
    // 1. Navigate to /event/EVENT_ID_FULL (a published, capacity-full event).
    // 2. Assert data-testid='attendance-waitlist' is visible (Going hidden or
    //    auto-routes to waitlist).
    // 3. Click waitlist button.
    // 4. Expect /waitlist/i confirmation.
    // 5. Reload; verify persisted waitlist state.
    await page.goto(`${BASE}/event/${EVENT_ID_FULL}`);
    await expect(page.getByTestId('attendance-waitlist')).toBeVisible();
    await page.getByTestId('attendance-waitlist').click();
    await expect(page.getByText(/waitlist/i)).toBeVisible();
  });

  test.fixme('anon visitor sees attendance CTA but is prompted to sign in', async ({ page, context }) => {
    // Edge case — guards against the Phase 4.D anon-policy collapse going wrong.
    // 1. Clear cookies/localStorage so we're definitely anon.
    // 2. Navigate to /event/EVENT_ID.
    // 3. Click data-testid='attendance-going'.
    // 4. Expect either a redirect to /auth or a sign-in prompt
    //    (locator: text=/sign in/i).
    // 5. Confirm NO RSVP RPC was sent — listen on
    //    **/rest/v1/rpc/rsvp_event_v1 and assert request count === 0.
    await context.clearCookies();
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto(`${BASE}/event/${EVENT_ID}`);
    await page.getByTestId('attendance-going').click();
    await expect(page.getByText(/sign in/i)).toBeVisible();
  });
});
