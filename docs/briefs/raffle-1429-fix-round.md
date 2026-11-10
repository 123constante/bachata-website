# Brief: ONE fix round for Website PR 1429 (raffle board screens, R3b-2)
Branch: claude/raffle-r3b-board-screens (the existing PR branch). Lane: normal. Sonnet. Push ONCE.

## Goal
The independent review (docs/review/review-door-raffle-1439-1429.md on branch claude/review-door-raffle-1439-1429, head 27f03565) said BLOCK. Safe only while VITE_ENABLE_RAFFLE_V2 is off; that flag MUST stay off and you must not touch any env or flag file. Fix every item in the review's #1429 section. Prove the data source first: read the live board RPC response shape read-only on prod (project stsdtacfauprzrdebmzg, SELECT only, no personal data) and state which fields the page depends on.

## Fixes (read the review for file:line)
1. The board reads start and venue but the RPC sends start_local and venue_name: map the real fields; add a test built from the real response shape (red first), so blanks cannot recur.
2. start_local is a UTC wall clock with no zone: do not treat it as local time without the zone the RPC supplies; test across a DST boundary.
3. Loading and error states read like "not in the raffle": give distinct, actionable copy for loading, error (with retry), empty and not-entered.
4. "Winners so far" would show about 766 on prod: show only what the RPC defines as winners for this raffle, and a real-shape test.
5. The earliest night may be yesterday: pick the first night not in the past, using the London date.
6. "See who won" shows on an empty board: hide it when there are no winners.
7. "You're in" is only in session storage so it is lost next visit: derive it from the server entry, with sessionStorage only as a fallback.

## Do NOT touch
supabase/**, workflows, .env*, flags, perf-budgets.json, vite.config.ts, calendar density-exempt files. Zero bytes added to dancer-app first load. Never add run-ci yourself.

## Done when
One push; every empty/loading/error state actionable; 390x844 geometry asserted; PR body "Verified on real data" block and Not verified updated; last commit subject ends with the [worker-done ...] marker.
