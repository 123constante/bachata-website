# Brief: independent (Fable) review of PR #1099, ambassador A1 follow-up (F1-F6 of review r3 on #1086) -- READ-ONLY, findings doc only

Repo 123constante/bachata-website. Review branch `claude/ambassador-a1-followup` at head be77e3fb against `main`. Opus built it (one round, no prior review of this diff). You write ONE file on branch `claude/review-1099`: `docs/reviews/review-1099.md`. No source edits, no DB write (Supabase read-only: function bodies and counts only, no personal data). Stopping rule: this is the one independent review; do not ask for another fix round without a stated reason.

## Context
Source of the findings: `docs/reviews/review-1086-r3.md` on branch `claude/review-1086-r3`. Builder handover `docs/handovers/ambassador-a1-followup.md` and design record `docs/design/ambassador-a1-followup.md` are on the PR branch. Admin RPCs are live (`admin_list_pending_review_v1`, `_moderate_entity`, `_is_city_ambassador`; project stsdtacfauprzrdebmzg). Prod has 0 ambassadors, so the route is dormant. Prove the data source yourself: read the RPC bodies and state the ORDER BY and the check order in `_moderate_entity`.

## Judge
1. F1: the page now loads EVERY page (cap 1000 rows per city) before rendering. Is `fetchQueue` in `ambassadorApi.ts` correct: offsets, the exactly-100 extra empty request, cities in parallel but pages per city sequential, the cap, `cappedCityIds`, error mid-way (page 2 fails: whole query errors? partial list never shown?), a city with 0 rows, two cities. Is the age bar and "Oldest loaded" copy true? Slow-phone first paint with N sequential requests: acceptable?
2. F2: `access` error on an item that is in the served list -> take off + toast + refetch. Can this hide a REAL access loss wrongly (ambassador removed from the city entirely: is a "changed" toast right or should the no-access page show)? Is it reachable only from `decide.onError`? Any double-toast, stale `sheetError`, or review-route state left over?
3. F3 refetch after party refusal, F4 copy, F5 minute tick (`setInterval`, cleanup, chips and bar recount, `queue-stale` line: shown only with rows on screen, Try again disabled while fetching, 44px), F6 ASCII test file.
4. Regressions vs #1086 as merged: scroll restore after Back, overlay geometry (sheet, confirm button, toast inside 390x844), focus `preventScroll`, deep link, double-tap safety, reject-needs-reason, submitter email never fetched or shown. The `now` state now changes every minute: does a re-render every 60 s disturb an open sheet, a typed reject reason, scroll position or focus?
5. Bundle: /app first load must stay at 0 added bytes (CI `bundle-budget` is green; say if the logic could still be wrong). `perf-budgets.json` and `vite.config.ts` untouched?
6. Tests: do the new matrix cases fail on the unfixed code (read them: do they assert the failing behaviour or just the new strings)? Is the e2e F2 case real? Any assertion that cannot fail?
7. Known gaps (do not fail on these): S1/S2/N1/N2, daily publish gate skipped on review-city go-live, no decision emails, no server-side noindex on /ambassador, no party flag in the list RPC.

## Output
Findings ranked most severe first: file:line, what is wrong, a concrete failing input, severity (blocks merge / fix before arc end / nit), CONFIRMED or PLAUSIBLE. End with a one-line verdict (PASS / PASS with should-fix / BLOCK) and "Not reviewed". Zero findings is valid if you say what you checked. Stop at 30% context with a PARTIAL marker; final commit subject ends with the done marker from your prompt.
