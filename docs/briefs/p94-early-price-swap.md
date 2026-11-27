# Brief: P94: Ways in summary shows a date early price the right way round
Brief-version: 2
Branch: claude/p94-early-price-swap
Lane: normal, Sonnet. Repo 123constante/bachata-website. One PR.

## Goal
Open problem P94. A date early bird is stored as: the ticket's price NOW is the early price, and a later price step (higher) is the normal price. The Ways in summary shows it the wrong way round. Real walk: organiser typed £12, early £8 until 30 Nov. DB: price now 800, step 1200 from 2026-12-01. Summary shows "Online £8, 50 a night" and "Early buyers £12 until Tuesday". It must show "Online £12, 50 a night" and "Early buyers £8 until Monday".

## What main lacks
- WaysInSummary has a dateEarly helper that swaps a future higher step into the main price -- grep: dateEarly

## Files
- src/modules/organiser/p3/v2/WaysInSummary.tsx
- src/modules/organiser/p3/v2/__tests__/waysInSummary.test.tsx

## What to build
0. Inventory first (short, in the PR body): list the ticket-line and early-line cases in WaysInSummary.tsx lines ~113-125 (free, count early, date step higher, date step lower or equal, past step, no step) with file:line. Report coverage at the end.
1. In WaysInSummary.tsx add an exported pure helper `dateEarly(t, now)`. It returns `{ mainPence, earlyPence, lastEarlyIso }` only when `t.nextStep` is in the future AND `t.nextStep.pricePence > t.pricePence`; otherwise null. mainPence = step price; earlyPence = t.pricePence; lastEarlyIso = the instant 1 ms before step.effectiveFrom (so the "until" day is the LAST early day, Europe/London).
2. The ticket line uses mainPence when dateEarly is not null (Free stays Free only when the main price is 0). The early line uses `S.earlyDate(formatPence(earlyPence), untilWords(lastEarlyIso, now))`.
3. A future step that is NOT higher than the current price is not an early bird: show no early line for it. Count early bird (t.early ...) is unchanged and still wins first. Past steps unchanged (no early line).
4. Tests: fix the existing date early tests in waysInSummary.test.tsx to the real shape (current price lower than the step). Add: the P94 case (pricePence 800, step 1200 from 2026-12-01T00:00:00Z, NOW before it) shows ticket line with £12 and "Early buyers £8 until Monday" (or "Monday 30 November" if more than 6 days from NOW; pick the assert to match the test file's NOW); a lower/equal step shows no early line; dateEarly unit cases incl. the 1 ms boundary.
5. No copy changes in copy.ts. No other file.

## Do NOT touch
EventCalendar.tsx, calendar/CalendarGrid.tsx, calendar/CalendarListView.tsx, calendar/DayDetailModal.tsx, calendar/calendarUtils.ts, useCalendarEvents.tsx (density-exempt calendar files), src/components/ui/dialog.tsx, supabase/**, migrations, workflows, scripts/**, .env*, any file not listed under Files.

## Done when
One push; PR body has "## Verified on real data" (- Shapes surveyed: / - Checks run: / - NOT verified:) and "## Phone QA" (- Sizes checked: / - Walked: / - Not verified:); tests green; every CI job step that applies has been run and the per-job table is in the PR body; last commit subject ends with the [worker-done ...] marker. Docs-only or tests-only PR: delete the Phone QA section.
