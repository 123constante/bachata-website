# Handover: phone-qa failure on PR #744 (storage callers)

Status: NOT FIXED in code. Root cause not established; no speculative change pushed.

## What was measured
- `overlap /auth` at 360x640 (and once at 390x844) intermittently reports
  `scrollWidth 390 > viewport 360; widest: div.absolute.rounded-full` at scroll top.
  That is a FloatingElements orb (src/components/FloatingElements.tsx, mounted by
  GlobalLayout inside a `fixed ... overflow-hidden` wrapper), not an upload UI.
- Rate on this branch: 1/12, then 1/12 (CI=1, `--repeat-each 12`, all parallel).
  Single-spec isolated loops (`/auth`, 190 runs, 360x640): 0 failures.
  origin/main, same command, `--repeat-each 30` (60 runs): 0 failures.
  Not enough to prove the branch causes it; no file in #744's diff is reachable from `/auth`.
- A follow-up evaluate after the failure showed scrollWidth back at 360, so the
  overflow is a transient frame, not a steady layout bug. Could not catch the
  offending rects (the 1-in-12 rate defeated 190 more attempts).
- Both fixed wrappers clip (`overflow-hidden`, `fixed`), so the transient points at a
  paint/hydration timing window, not at message text or file inputs.

## Local runs of CI jobs (sandbox)
| Job step | Command | Result |
|---|---|---|
| phone-qa (full) | `CI=1 npx playwright test --config playwright.phone.config.ts` | exit 0, 120 passed (CI shows 152 tests; count differs, unexplained) |
| phone-qa (one spec) | `... overlap.phone.spec.ts` | exit 0, 28 passed; with repeat, flaky as above |
| unit offline | `npm run test:unit:offline` (TZ=Europe/London, stub Supabase env) | exit 1: 5 failed in tests/integrityCouldNotRun.test.ts, 5853 passed |
| unit timing | `npm run test:unit:timing` | exit 0, 6 files passed |
| same 5 tests on origin/main | `npx vitest run tests/integrityCouldNotRun.test.ts` | the same 5 fail on main (sandbox environment), not this PR |

## Suggested next step
Treat the CI failure as a flake: re-run `phone-qa` once. If it recurs, capture
`getBoundingClientRect()` of every `div.absolute.rounded-full` and its ancestors in
the failing frame (checkOverflow in tests/e2e/live/lib/pageChecks.ts only names the
widest element) before changing layout.
