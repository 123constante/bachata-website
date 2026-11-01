# Brief: independent review of PR #1252 (p3-wt-dates: F-27 all-dates paging, F-33 public-view refresh)

Repo bachata-website. You review; you do NOT edit the PR branch. Output: ONE file `docs/review/pr-1252-r1.md` on branch `claude/review-1252-r1` (docs only), verdict PASS / PASS-WITH-NITS / BLOCK, findings ranked, each with file:line and a concrete failing scenario. Read the builder's handover `docs/handover/p3-wt-dates.md` on `claude/p3-wt-dates` first, then the diff against main.

## Check against the contract (docs/design/p3-acceptance/ FIXLIST F-27, F-33)
1. F-27: "All dates" shows every date for a series over 100 rows (prod has 1 series with 132 dates; read-only SELECT on project stsdtacfauprzrdebmzg to confirm the RPC `admin_event_workspace_p5` paging: p_before strictly-before cursor, p_limit 1..200). Check: no duplicated or skipped date across page boundaries, loop guard, 10-page cap behaviour (what the person sees past the cap), "N+" count states, retry, counts after a write.
2. F-33: every save path that changes what the public sees calls `invalidatePublicViews`. Check the key shapes against the real public query keys (`['event-page-snapshot', seriesId, occurrenceId|null]`, `['calendar-events', start, end, city]`). Is a prefix invalidation correct for the calendar key? A refused or failed save must not invalidate. NOTE: this is client-side (same tab) only; do not claim it fixes the edge-cached city page for other visitors.
3. Are the tests non-vacuous? Run them against `main` (they should be red for 101+ rows and every save path) and against the branch (green). Mutate the new code once and confirm a test fails.
4. Shape coverage: 0/1/99/100/101/132/250/450 dates x Coming/Past/All; empty states say what the person can do.
5. Bundle: the handover says /city first load grew 153 B; check against `perf-budgets.json` and say whether the budget job passes.
6. CI: read `.github/workflows`, say which jobs apply and their state on the PR head (`gh pr checks 1252`).
Hard limits in the dispatch prompt apply. Report honest Verified / Not verified.
