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

---

# Update 2026-10-13: ROOT CAUSE FOUND AND FIXED

The orb (`div.absolute.rounded-full`) was a red herring: `checkOverflow` names the
last element whose `getBoundingClientRect().right` exceeds the viewport, and the
orbs always do (they are clipped by their own wrapper, which rects ignore).

## Reproduction
`CI=1`, 4 workers, `Emulation.setCPUThrottlingRate` 4x, `/auth`, `--repeat-each 40`:
9 of 80 failed (main-like conditions, no code of #744 involved).

## Measurement in the failing frame (390x844)
Non-fixed elements past the viewport edge, leaf to root:
- `DIV` (PageTransition `motion.div`): rect `[30,60,420,904]`, computed
  `transform: matrix(1,0,0,1,29.79,0)`, `filter: blur(4px)`, `position: static`,
  `overflow: visible`, `contain: none`. This is `PageTransition`'s `initial`/`in`
  tween, `x: 30 -> 0` over 0.25s.
- `MAIN` (`#main-content`): rect `[0,60,390,904]`, `overflow: visible`, scrollWidth 420.
- `BODY`: `overflow: hidden/auto` (propagated to the viewport, so it does not clip),
  scrollWidth 420. `HTML`: scrollWidth 421.
Inside it, `DIV.min-h-screen ... overflow-x-clip relative` (page root) clips ITS
children but sits below the transformed wrapper, so cannot clip the wrapper itself.
The fixed layers (header, gradient-bg, toast viewport) then measure 421 wide because
mobile emulation grows the layout viewport to fit the overflow.
The orb layer is NOT the containing block of anything involved: its wrapper is
`fixed ... overflow-hidden` and clips correctly.

## Fix
`src/components/AppChrome.tsx`: `<main id="main-content" className="overflow-x-clip">`.
`clip` (not `hidden`) creates no scroll container, so `position: sticky` and fixed
descendants are unaffected; no visual change. No global `html` overflow rule.

## Regression test
`tests/e2e-phone/route-transition-clip.phone.spec.ts` holds the route wrapper at
`translateX(30px)` (the enter pose) and asserts `checkOverflow` is clean, on `/auth`
and `/faq` at 390x844 and 360x640. Deterministic: red on unfixed code (scrollWidth
421 > 390), green with the fix; 120/120 green with `--repeat-each 30 --workers 4`.

## CI jobs run in the sandbox
| Job step | Command | Exit |
|---|---|---|
| phone-qa full | `CI=1 npx playwright test --config playwright.phone.config.ts` | 0 (124 passed, 32 skipped real-Supabase specs) |
| regression repeat | `... route-transition-clip --repeat-each 30 --workers 4 --retries 0` | 0 (120 passed) |
| flake repro, fixed | `... overlap -g "/auth" --repeat-each 60 --workers 4 --retries 0` | 0 (120 passed; 9/80 failed unfixed under 4x CPU throttle) |
| unit offline | `TZ=Europe/London npm run test:unit:offline` | 1: 5 x tests/integrityCouldNotRun.test.ts (also fail on main, sandbox) plus 1 load-flake in tests/client/festivalClientState.test.tsx that passes alone, with and without this change |
