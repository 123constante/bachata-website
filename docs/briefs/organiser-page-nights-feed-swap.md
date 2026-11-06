# Organiser page nights feed swap: all cities, next 20, city on each night (NORMAL lane, Website only)

Brief-version: 2
Branch: claude/organiser-page-nights-feed-swap (from main). One push. Normal lane, Sonnet, context cap 50%. No `supabase/**`, no admin changes, old RPC not deleted.

## Decisions
Admin migration APPLIED on prod: `get_organiser_nights_v2(p_organiser_id uuid, p_include_past boolean, p_upcoming_limit integer, p_from text, p_to text, p_past_limit integer)`; rows carry `city_name`; upcoming default starts yesterday; cancelled nights excluded server-side. P1, P2 (#1437), #1428, #1436, #1438 are merged. Owner decisions 2026-11-05: ALL the organiser's nights whatever the city, city named on each night; next 20 upcoming; a repeating event stays ONE row ("N dates", or "next 20 dates" when capped); when the cap is hit one quiet line "Showing the next 20 nights" ends the list; a repeating row spanning cities shows its first city plus "+1 city". Contract: docs/organiser-page/ACCEPTANCE.md (E4-E7, E12). Design record docs/design/organiser-page-nights.md is NOT on main: read it from `origin/brief/organiser-page-nights-feed`, and commit it with this PR.

## What main lacks
- both feeds call the city-filtered v1 RPC -- grep: get_organiser_nights_v2 (0 hits in src/ on main)
- the generated types lack the new RPC, `check:rpc-typing` refuses a laundered call -- grep: get_organiser_nights_v2 in src/integrations/supabase/types.ts
- no night names its city -- grep: city_name in src/pages/OrganiserProfile.tsx (0 hits)
- cap wording and "Show more nights" -- grep: Showing the next 20 nights
- the "N dates" count and "Show all N dates" assume the whole feed -- grep: totalUpcomingDateCount in src/pages/OrganiserProfile.tsx (line ~990, ~1369, ~1397)

Already on main, do NOT redo: `organiserStatsByFeed.ts` (per-feed failure dashes), `organiserPage.matrix.test.tsx`, `OrganiserProfileFeedError.matrix.test.tsx`, `organiserPastWindow.test.ts` (3650-day pin), the client `is_cancelled` guard (OrganiserProfile.tsx ~799, ~812; keep as a belt). The SSR loader (`app/routes/organiser.tsx`) already prefetches through `fetchOrganiserFutureOccEvents` / `fetchOrganiserPastOccEvents`, so changing those two functions changes page and loader together.

## Files
- docs/design/organiser-page-nights/INVENTORY.md (new)
- docs/design/organiser-page-nights.md (new)
- src/modules/profile/organiserPublicProfile.ts
- src/pages/OrganiserProfile.tsx
- src/integrations/supabase/types.ts (regenerate by the repo's script only)
- src/modules/profile/__tests__/organiserPastWindow.test.ts
- src/modules/profile/__tests__/organiserPage.matrix.test.tsx
- app/routes/organiser.loader.test.ts
- docs/handover/organiser-page-nights-feed.md (new)

## What to build
0. Write INVENTORY.md first (docs/design/organiser-page-nights/INVENTORY.md): every field, state and option from the admin app, the current Website and the public page, each with file:line, plus a coverage count.
1. `fetchOrganiserFutureOccEvents` calls `get_organiser_nights_v2(p_organiser_id, p_include_past: false, p_upcoming_limit: 20)`; `fetchOrganiserPastOccEvents` calls it with `p_include_past: true` and the same explicit 3650-day `p_from`/`p_to` it passes today (one constant). Both still throw on RPC error, never return `[]`. Regenerate types.
2. Update `organiserPastWindow.test.ts` (new RPC name, `p_upcoming_limit: 20` on the future feed, keep the 3650 and "wider than 730-day default" assertions). Add a loader test: a failing `get_organiser_nights_v2` rejects the prefetch and is not cached (`organiser.loader.test.ts` mocks only v1 names today).
3. Page: show `city_name` with the venue on every night (`venue, city`); repeating row shows first city plus "+1 city" when dates span cities; the dates sheet shows city per date. No hard-coded city.
4. Cap: exactly 20 upcoming returned means tag "next 20 dates" when one row holds all 20, heading count dropped, button "Show more nights", quiet centred line "Showing the next 20 nights". Below cap: "N dates", no line. One shared mapping for the wording.
5. Stats: feed the CAPPED upcoming list only to the "next night" stat via `organiserStatsByFeed`; "nights hosted" stays on the uncapped past list; test a 20-capped organiser.
6. Extend `organiserPage.matrix.test.tsx` (not a new file): mixed cities, capped 20, under cap, repeating across cities, repeating single city, past-only, none, each feed failing, cancelled in feed. `noCopyWithoutControl()` must hold.

## Done when
Red-first tests, lint chain, tsc, `check:rpc-typing`, `check:bundle-budget` green; per-job CI table in PR body; walk at 390x844 on prod-shaped organisers (weekly 200+, mixed cities, past-only, none) with no sideways scroll and taps >= 44px; shape survey on prod (counts only: 0 / 1-20 / 21-100 / 100+ upcoming, other-city, cancelled). Verified / Not verified block. Note the SSR upcoming feed cannot have a failure injected in a browser walk (unit matrix and loader test cover it). Push once, handover file, `[worker-done <ticket>]` in the last commit.
