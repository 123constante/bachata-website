# Handover -- bristol-ambassador-tracker

Branch `claude/bristol-ambassador-tracker`. Counts-only tracker card (owner change 2026-11-06).

Done: `link/trackerModel.ts`, `link/LinkCard.tsx`, `fetchLinkTracker` / `setLinkActive` in `ambassadorApi.ts`, card mounted in `AmbassadorQueuePage.tsx`, 26 table-driven tests in `link/__tests__/linkCard.test.tsx`, design record.

Prod shape re-checked read-only 2026-11-06 (function source): row keys link_id, code, city_name, city_slug, is_active, admin_locked, live, ambassador_first_name, joined, city_set; no `joiners`. 0 ambassador rows on prod.

Left: browser walk at 390x844 (not done by this worker); generated Supabase types lack the two RPCs, so `ambassadorApi.ts` calls them through an untyped wrapper -- drop it after a types regen. `/join/a/<code>` page is a separate brief.

tsc run on 19f9acd: 0 errors in branch files (whole project clean).
Checks run: vitest src/modules/ambassador (89 pass, incl. existing queue.matrix), eslint on touched files (0 errors), check:mojibake.
Verified: prod RPC source read-only. Not verified: browser walk 390x844, /code-review, full CI-job local replay (pre-ship), PR checks.

## Walk at 390x844 (tests/e2e/ambassador-link-card.spec.ts, stubbed backend, 14 tests green headless)
Shapes: {0,1,60 joined} x {active, off by ambassador, off by admin, not live} + admin with 2 links + confirm-off/Cancel. Each: labels, switch reason text (+aria-describedby), scrollWidth <= 390, buttons >= 44px, copy writes `<origin>/join/a/<code>` (stubbed clipboard), untouched card sends no set_ call.
Problem found and fixed: `AmbassadorQueuePage` read `isAdmin` from `useAuth`, which AppChrome never sets, so an admin always got the locked reason. Now `useIsAdmin` (admin_is_admin); the 2-link admin test covers it.
Spec added to `test:e2e` (stubs only, no network). Screenshots in walk-shots/ambassador-link-card/ (not committed): off-admin-60, admin-two-links, active-60, off-ambassador-0, not-live-0, confirm-off.
Copy note, not changed (owner words): not-live note ends "Ask us" with no contact control on screen.
Not verified: real device; real RPC (0 ambassador rows on prod); /code-review; full pre-ship replay.
