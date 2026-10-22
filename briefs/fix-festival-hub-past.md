# Brief: Festival Hub shows past festivals as "Now!" (prod bug)

Lane: NORMAL. Repo: bachata-website. Branch: `claude/festival-hub-upcoming` (from `origin/main`). One PR, push ONCE.

## The bug (prod, 2026-10-23)
https://bachatacalendar.co.uk/festivals lists "Tunisia Bachata Festival 2026" (24 Sept 2026) with a "Now!" pill a month
after it happened, and "BOS Majorca Holiday" (22 Oct). The RPC `get_public_festivals_list_v1` returns EVERY public
festival, past included (checked read-only on prod: 7 rows, 2 in the past). `src/pages/FestivalHub.tsx` (~line 97) uses
`fetchPublicFestivalsList` with no upcoming filter. The home rail and search already apply the ONE shared rule:
`filterUpcomingFestivals(rows, londonTodayKey())` from `src/lib/festivalsList.ts` (see `src/hooks/useUpcomingFestivalsGlobal.ts`).

## What to change
1. In FestivalHub's `useQuery` for `FESTIVALS_LIST_QUERY_KEY`, add the same `select` the home rail uses:
   `select: (rows) => filterUpcomingFestivals(rows, londonTodayKey())` (no `.slice`). Reuse; never hand-copy the predicate.
2. Nothing else. Another open PR (#961, branch claude/festival-counter-gap) edits the counter block near line 330 of the
   same file; do NOT touch that block, so the two PRs do not conflict.
3. Check the /festivals SSR loader / prerender (search for FESTIVALS_LIST_QUERY_KEY under app/ or src/ssr): if the server
   renders the list from dehydrated rows without `select`, make sure server and client render the same filtered list (no
   hydration mismatch). If the loader needs the same filter, apply the same helper there.

## Tests (red first against current code)
- Table-driven vitest: rows dated yesterday, today, tomorrow and a null date -> Hub shows today + tomorrow only
  (match `filterUpcomingFestivals` semantics; a null date is dropped, as the helper does).
- Existing festival hub snapshot / today tests stay green (update snapshots ONLY where the past fixture rows now drop out;
  say which in the PR body).

## Done means
- Every CI job step that applies is run in your sandbox (read `.github/workflows/*.yml`, incl. build-smoke, bundle-budget,
  dancer-area-isolation); per-job table in the PR body.
- "Verified on real data": you may read prod read-only to confirm which festivals drop out; the orchestrator walks it.
- Design Gate: bug fix, no new UI; stage 4 only. Say so.
- Handover `docs/handover/festival-hub-upcoming.md`.
- Do NOT push again after your final commit (fix everything BEFORE the commit that carries the done marker).
