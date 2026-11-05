# Brief: organiser page nights feed swap (Website only): all cities, next 20, city on each night

Brief-version: 4 (2026-11-05 22:50Z refresh against main 0fdfeee8, #1399 P1 head a6e13125, #1400 and the #1259 / hidden-flag plan; see 'Changes in v4')
Branch: claude/organiser-page-nights-feed (Website). Lane: normal. Model: Opus. Screen work: design record and walk required (design record already exists: docs/design/organiser-page-nights.md).
DEPENDS ON: admin migration for `get_organiser_nights_v2` APPLIED to prod (admin branch brief/organiser-nights-feed; read-only check 2026-11-05: the function does NOT exist on prod yet, only `get_organiser_calendar_events_v1` and `get_organiser_public_events_v1`) AND P1 (#1399) MERGED AND P2 (Team + larger cards) MERGED. P2 itself waits for admin #1259 (F6 fix, applied) and the hidden-flag admin piece, so this slice is third in line; it touches `OrganiserProfile.tsx` like P1 and P2, so it must be rebased on both before dispatch. Dispatch only after both; one Website branch at a time (Vercel cap).
Contract (do not reopen): docs/organiser-page/ACCEPTANCE.md E4, E5, E6, E7, E12 (decided lines added by P2) and docs/design/organiser-page-nights.md. Owner decisions 2026-11-05: cancelled nights hidden everywhere; ALL the organiser's nights whatever the city, city named on each night; the next 20 upcoming nights whenever they are; repeating events stay ONE row with an "N dates" tag; when the 20 cap is hit the tag reads "next 20 dates" and one quiet line "Showing the next 20 nights" ends the list; a repeating event spanning cities shows its first city plus "+1 city".

## Changes in v4 (read these first; they override anything older below)
- P1 (#1399) replaced the stats input. Stats are now computed by `src/modules/profile/organiserStatsByFeed.ts`, a wrapper around the unchanged `organiserStats()` that takes each feed's own status (a failed future feed gives a dash for "Next night", a failed past feed a dash for "Nights hosted", never a 0). Scope 5 therefore feeds the CAPPED upcoming list to that wrapper, not to `organiserStats` directly, and the "nights hosted" count keeps coming from the uncapped past list.
- E12 is already pinned on main: `src/modules/profile/__tests__/organiserPastWindow.test.ts` (#1400) asserts that the past feed passes `p_from` = today minus 3650 days, `p_to` = tomorrow and `p_include_past: true`, calling `get_organiser_calendar_events_v1`, and that the future feed passes only `p_organiser_id`. This slice MUST update that test in the same push (new RPC name `get_organiser_nights_v2`, new args `p_upcoming_limit: 20` for the future feed) and keep the 3650-day assertion and the "wider than the 730-day server default" assertion. Do not add a second copy of the window constant.
- E7 is decided and unchanged (cancelled nights hidden everywhere); E4 and E5 rows in ACCEPTANCE section 7 are rewritten by P2 (scope 6 there), not here.
- The upcoming (future) feed is prefetched by the SSR loader (`app/routes/organiser.tsx`), so a browser walk CANNOT inject a failure into it (verified on #1399: failing the RPC in the browser after reload changed nothing). Its error state is proven by the unit matrix and the loader test (`OrganiserProfileFeedError.matrix.test.tsx`, which pins that SSR never caches a failed feed, #1282); the browser walk covers the past feed and the page-level states only. Add one loader-level test that a failing `get_organiser_nights_v2` rejects the loader's prefetch and is not cached.
- The page matrix is now `organiserPage.matrix.test.tsx` with 167 tests (every combination of events, future, past, roster, names and contact feeds failing, owner and visitor). Extend it; do not create a parallel file. `noCopyWithoutControl()` in it must still hold for every new line you add ("Showing the next 20 nights" is not a control, "Show more nights" is and needs its list).
- Greps, not line numbers: the line numbers in older text have moved twice (P1, #1398). Always grep.
- Mixed-city rows: the Team and Get in touch sections from P1 stay as they are. Past-only organisers lead with a `last_night` stat (not in ACCEPTANCE section 1; the owner has been told); do not change that here.
- Hidden-person logic from #1259 does not touch nights; nothing in this brief reads `organiser_team_public_hides`.

## Goal (four lines)
1. Who: dancers on an organiser's public page.
2. After: they see the organiser's next 20 real nights in any city, each with its city, and past nights from every city, with no cancelled night anywhere.
3. Worked if: the six shapes in the design record (mixed, weekly 200+, series dates sheet, past-only, none, error) read right on prod-shaped organisers; no stat or count is derived from a failed or capped feed in a misleading way.
4. Limits: hero, Team, Get in touch, stats mapping logic untouched except for the stats input described below; no migrations, no admin changes; the old RPC is not deleted.

## What main lacks
- both feeds still call the city-filtered v1 RPC -- grep: get_organiser_calendar_events_v1 in src/modules/profile/organiserPublicProfile.ts (fetchOrganiserFutureOccEvents, fetchOrganiserPastOccEvents) and in app/routes/organiser.tsx (loader prefetch)
- no row names its city -- grep: city_name (expect 0 hits in src/pages/OrganiserProfile.tsx)
- the cancelled guard is client-only -- grep: is_cancelled in src/pages/OrganiserProfile.tsx
- the "Show all N dates" and "N dates" count assume the whole feed -- grep: totalUpcomingDateCount in src/pages/OrganiserProfile.tsx
- the new RPC is not in the generated types and `check:rpc-typing` will refuse a laundered call -- grep: get_organiser_nights_v2 in src/integrations/supabase/types.ts (expect 0 until regenerated)

## Files
src/modules/profile/organiserPublicProfile.ts
src/pages/OrganiserProfile.tsx
app/routes/organiser.tsx
src/integrations/supabase/types.ts (regenerate by the repo's script only; never by hand)
src/modules/profile/__tests__/organiserPage.matrix.test.tsx
docs/handover/organiser-page-nights-feed.md

Do not touch: `organiserStats.ts` / `organiserTeam.ts` logic, the hero, EventRow sizes (done in P2), perf-budgets.json, vite.config.ts, anything under supabase/, calendar density-exclusion files.

## Step 0: INVENTORY CHECK
Read docs/design/organiser-page-nights.md inventory (10 rows, file:line). Confirm each row against the merged code (line numbers will have moved after P1/P2) and write the coverage table at the top of the handover: N rows, N handled, none silently omitted.

## Scope
1. `fetchOrganiserFutureOccEvents(id)` calls `get_organiser_nights_v2(p_organiser_id, p_include_past: false, p_upcoming_limit: 20)`; `fetchOrganiserPastOccEvents(id)` calls it with `p_include_past: true` and the same explicit 3650-day window it passes today (one constant, E12; the pin test already exists on main, update it, see Changes in v4). Both keep throwing on RPC error (never `[]` on failure). Shared by the page query AND the SSR loader prefetch so the two cannot disagree (same keys as today).
2. Read the live RPC body and ACL first (prod project stsdtacfauprzrdebmzg, read-only); state in the handover which table/column each field depends on.
3. Page: show `city_name` on every night, always together with the venue (`venue, city`); a repeating row shows its first city and "+1 city" when its dates span cities; the dates sheet shows the city on each date. No hard-coded city anywhere (E6 stays closed).
4. Cap: when the upcoming feed returned exactly 20 nights (the cap), the tag of a repeating row reads "next 20 dates" when that row holds all 20, the heading count is dropped, the button reads "Show more nights" (not "Show all N dates") and one quiet centred line "Showing the next 20 nights" ends the list. Below the cap: heading count "N dates", no line. Use "nights" for anything the visitor reads about the cap.
5. Cancelled: keep the existing client guard as a belt (server now excludes them); never count a cancelled night. Stats: `organiserStats` is fed from the upcoming/past nights; with the upcoming list now capped, pass the CAPPED list only for the "next night" stat and never use it for counts that would be wrong when capped (nights-hosted uses the past list, which is not capped; state this in the handover and add a test over a 20-capped organiser).
6. States from the design record keep their copy: past-only ("No dates announced yet" + Recently hosted), none, per-section error with Try again; a failed feed never shows "No dates announced yet" and never feeds a stat.

## Standing lines (do not retype elsewhere)
- Zero bytes to the /app first load: `npm run check:bundle-budget` on main and the branch. Never edit perf-budgets.json or vite.config.ts.
- Types: regenerate `types.ts` with the repo's own script so `check:rpc-typing` passes; do not shrink or add allowlist entries by hand.
- Push rule: commit as often as needed, PUSH ONCE when coherent and tested; never add `run-ci`; one fix round after review is one more push.
- Design Gate: the lead decided the look (docs/design/organiser-page-nights.md); explicit px sizes, taps >= 44px, contrast >= 4.5 on shipped values.
- HTML entities for punctuation in JSX; source files over 2 KB through scripts/safe-edit.py or safe-write.py.

## Verification (all required before DONE)
- Shape survey on prod, counts only, no write, dated: organisers by upcoming count (0 / 1-20 / 21-100 / 100+), other-city upcoming, beyond +365 days, upcoming cancelled; compare with the admin brief's numbers (48 organisers with a series; 20 over 20 upcoming; 3 other-city; 4 beyond +365; 4 cancelled).
- Table-driven matrix (`organiserPage.matrix.test.tsx`): every section x shape: mixed cities, capped 20, under cap, repeating spanning cities, repeating single city, past-only, none, upcoming feed error, past feed error, both fail, cancelled present in the feed. Red first on unfixed code for each E row. One shared mapping for the cap wording.
- Every CI job step that applies, run in the sandbox, per-job table in the PR body.
- Walk at 390x844 on prod-shaped organisers (weekly 200+; mixed cities; past-only; none). Attach pictures; measure no sideways scroll, no clipping (long venue plus city wraps to two lines), taps >= 44px, contrast >= 4.5.
- PR body from the template with a Verified / Not verified block. Independent critique by a different worker, ONE round.

## Stop and handover
Push once, write docs/handover/organiser-page-nights-feed.md (what shipped, what is parked), add `[worker-done <ticket>]` to the final commit message, stop. At 50% context stop with the PARTIAL marker and a "what is left" list.
