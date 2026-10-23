# Brief: main is red -- datesCard.consistency test leaks the real clock

Lane: NORMAL (test/clock fix only). Repo: bachata-website. Branch: `claude/fix-datescard-clock` (from `origin/main`). One PR, push ONCE.
Owner decision 2026-10-23: fix ONLY this. Touch nothing else in the organiser area.

## Failure (on main since London midnight 23 Oct)
`unit (Europe/London, full)` fails on main (run 39859358193 re-run on a48ccd3: passed 2026-10-22 21:42Z, failed after 23:35Z, same code):
`src/modules/organiser/events/__tests__/datesCard.consistency.test.tsx > Coming dates card: rows and count from the same dates
(one event screen) > Home lists none, the workspace holds 2 coming + 1 past` -> expected { rows: 2 }, received { rows: 3 }.
Every Website PR is red on it (a Required check), so nothing can merge.

The test freezes Date: `vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime(FROZEN)` with
`FROZEN = 2026-10-20T12:00:00Z` (`src/modules/organiser/flows/add/__tests__/fixtures.tsx`), and fixture dates are
`day(n) = addDaysToKey(londonTodayKey(), n)`. So some code on the render path reads the REAL clock while the fixtures use the
frozen one. Suspects: `Intl.DateTimeFormat#format()` called with NO argument (V8 uses the real clock, not the faked Date), `performance.now`,
`Temporal`, a module-level "today" computed at import time BEFORE setSystemTime, or a query cached across tests.

## What to do
1. Reproduce red first: run the file with the system clock at a date where the real date differs from FROZEN (e.g. faketime, or
   temporarily set FROZEN far from now) and show the failure. Find the exact real-clock read.
2. Fix the ROOT cause:
   - If it is PRODUCT code reading "now" a second way (e.g. a `format()` with no date), make it read the one clock (`new Date()` /
     `londonTodayKey()`), so product and test agree. That is a real bug: say so in the PR.
   - If it is TEST-only (import-time today, fake setup order), fix the test setup.
   Never loosen the assertion, never skip the test, never change the expected numbers.
3. Check the sibling tests that import the same fixtures (`grep -rl "flows/add/__tests__/fixtures"`) for the same leak; fix only the same leak.
4. Prove: the file passes with the real clock set to several dates (yesterday, today, +30 days, a BST/GMT change date such as 2026-10-25).

## Done means
- Full `npm run test:unit` green in the sandbox (TZ=Europe/London plus the two tz-sensitive runs the workflow uses); per-job table in the PR body.
- PR body: `## Verified on real data` with lines `- Shapes surveyed:` (none, test-only; say why) / `- Checks run:` / `- NOT verified:`, and `## Phone QA` (no visible change).
- Handover `docs/handover/fix-datescard-clock.md` (root cause in one paragraph).
- Do NOT push again after the commit carrying the done marker.
