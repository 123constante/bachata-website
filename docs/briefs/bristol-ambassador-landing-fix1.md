# Brief: fix round 1 for Website PR #1455 (Bristol ambassador landing), from the independent review
Brief-version: 2

Branch: `claude/bristol-ambassador-landing` (the existing PR branch, continue it; `git fetch origin claude/bristol-ambassador-landing`). Lane: careful. Model: opus. Page: `src/modules/ambassador/link/*`.

## What main lacks
- fixes for review findings M1, L1 and a documented decision for M2 -- grep: joinRefusal

## Read first
The review: `git fetch origin claude/review-1455-ambassador-landing` then `git show FETCH_HEAD:docs/review/review-1455-ambassador-landing.md`. Verdict SAFE AFTER FIXES, 0 high, 2 medium, 4 low.

## Do (minimum fixes only)
1. M1: `joinRefusal` (linkLandingModel.ts) maps every unknown server refusal to `failed`, whose copy blames the connection. Add a separate `refused` state with a calm sentence that does not blame the connection and offers a way out (back to the calendar / contact link), no retry loop. Keep `failed` only for thrown network errors. Add the matrix rows and a design screenshot for the new state.
2. L1: an unknown `status` from the public RPC (for example `locked`) must render the plain not-found state, never the generic error with a retry. Add a test row.
3. M2: do not change the RPC. In docs/design/bristol-ambassador-landing.md state that the own-link state is reached after one server round trip by design, and why.
4. L5: add one test for the city chip fallback (the `cities` read fails, the chip uses the RPC city name).
5. Change nothing else. No types.ts edits (types-drift is red on main too; leave it).

## Files
- src/modules/ambassador/link/* (as needed), its tests, docs/design/bristol-ambassador-landing.md, docs/handover/bristol-ambassador-landing.md

## Done
Run the page tests and `npx tsc --noEmit -p .`. Push once; commit subject ends `[worker-done <ticket>]`. Report: what changed per finding, tests run, Not verified.
