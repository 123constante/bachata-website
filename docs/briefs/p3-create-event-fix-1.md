# Brief: P3 create-event build, fix round 1 (branch claude/p3-create-event-build, PR #1208) (NORMAL lane, Opus)

Context cap 50%. Never merge/approve. Supabase read-only. Push ONCE (end of work), final subject ends with the [worker-done <ticket>] marker named in the dispatch prompt.

## Fix 1: the red unit job
On head 03b3024f the CI job `unit (Europe/London, full)` fails exactly one test: `src/modules/organiser/p3/new/__tests__/review2.test.tsx` "R2-2: a created draft left in storage never takes over the next New e..." at line 191. 700 other files pass. Reproduce with `npx vitest run src/modules/organiser/p3/new/__tests__/review2.test.tsx` (also try TZ=Europe/London and the full file set in the same order CI uses, since it may be an order/timing flake in the shared storage). Find the root cause (not a retry or skip), fix it, red first, show it green. If it is a flake caused by shared sessionStorage/localStorage between tests, fix the test isolation AND check the production code path is really safe.

## Fix 2: the PR body (two failing body checks: phone-qa-section, real-data-verified)
Write the real PR body with `node ~/.claude/bin/pr-body.mjs` style content (plain git only: put the body in docs/handovers/p3-create-event-pr-body.md; the lead applies it): sections `## What changed` (plain words), `## Verified on real data` (shapes surveyed on prod read-only, matrix tests, red-first facts, per-job CI table), `## Phone QA` with exact lines `Sizes checked: 390x844`, `Walked: ...` (from your own walk screenshots), `Not verified: ...` (honest, e.g. creating on a real device, the DEFERRED rows).

## Fix 3: coverage honesty
In docs/design/p3-create-event/BUILD-INVENTORY.md add a final line `Coverage: N rows, N built, N deferred (with reason), 0 silent`. The 71 rows must all be accounted for.

Do not add features. Do not touch the DEFERRED rows.
