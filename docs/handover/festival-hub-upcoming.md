# Handover: festival hub upcoming filter

Done: `FestivalHub` useQuery now has `select: filterUpcomingFestivals(rows, londonTodayKey())` (shared rule, no copy, no slice). Counter block (~line 330, PR #961) untouched.
SSR: `app/routes/festivals.tsx` dehydrates the raw list; `select` runs identically on server and client render, so no loader change and no hydration mismatch.
Test: `tests/client/festivalHubUpcoming.test.tsx` (yesterday/today/tomorrow/null). Red before fix (2 failed), green after. Existing hub snapshots unchanged (fixture date 2026-12-20 is upcoming).

Verified: new test, tests/client + tests/regression (1164 pass), dancer-area-isolation, lint chain 19/20 links.
Not verified: `check:integrity` exits 126 in this sandbox (permission); tsc has 99 pre-existing errors identical on main; not run: build-smoke, bundle-budget, e2e, live-DB gates; no prod read or browser walk (orchestrator walks it).
Design Gate: bug fix, no new UI; stage 4 only.
Next: open PR, check CI.
