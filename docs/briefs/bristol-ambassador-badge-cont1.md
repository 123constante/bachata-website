# Brief: ambassador badge, continuation 1 (use the claimed-profile function)
Brief-version: 2
Branch: claude/bristol-ambassador-badge
Lane: normal, Opus (permission-adjacent: badge visibility). CONTINUATION on the existing branch and draft PR 1474 (head a8ef566); do not restart it.
Serves: owner click 2026-11-08: the Bristol ambassador badge shows ONLY on a claimed page. The admin function is merged and APPLIED on prod (is_claimed_profile_ambassador_v1(p_profile_id uuid) returns boolean; read back 2026-11-08: ledger row present, grants anon/authenticated/service_role). Prod has 0 ambassadors, so real-data proof of "badge shown" is impossible; say that under Not verified.

## What main lacks
- the badge calls the NEW function with the PROFILE id (the public snapshot has no user id; 49 of 206 profile ids happen to equal an auth user id, so the old call was wrong) -- grep: is_claimed_profile_ambassador_v1
- src/integrations/supabase/types.ts knows the new function (regenerate with the Supabase connector's generate_typescript_types, never by hand; the types-drift check must be green) -- grep: p_profile_id
- a test where the function call throws: badge hidden, no crash; plus the DJ and Teacher role pages show the badge when the function says true -- grep: badge hidden when the call fails
- a table-driven matrix: profile shape (unclaimed, claimed non-ambassador, claimed ambassador, archived) x page (PersonHub, tabbed header, DJ, Teacher) x signed in/out -- grep: ambassadorBadge matrix

## Files
- src/modules/ambassador/link/AmbassadorBadge.tsx
- src/modules/ambassador/link/__tests__/AmbassadorBadge.test.tsx
- src/integrations/supabase/types.ts
- docs/design/1474.md
- docs/handover/bristol-ambassador-badge-cont1.md (new)

0. Write INVENTORY.md first (update the one the branch already has): every place the badge appears, with file:line, from the admin app, the current Website and the public page; report the coverage count at the end.
Walk at 390x844 with the stored city activeCitySlug=bristol-gb; seed the shape with a mocked function in the walk and say so. Do not touch the calendar density-exclusion files. Push once at the end; last commit subject ends with the worker-done marker; mark the PR ready for review only if all checks are green.
