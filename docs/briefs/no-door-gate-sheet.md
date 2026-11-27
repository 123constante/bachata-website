# Brief: No-door switches open the 'A few details first' sheet on an onboarding refusal (P76)
Brief-version: 2
Branch: claude/no-door-gate-sheet
Lane: normal, Sonnet. Repo 123constante/bachata-website. One PR.

## Goal
Since admin#2540 the server refuses organiser_set_night_no_door_v1 with onboarding_incomplete for an organiser who has not finished onboarding. Both no-door controls must then open the ONE "A few details first" sheet (no error line), like every other P3 write; other failures keep today's error.

## What main lacks
- NightCard and SkipDoorSheet route organiser_set_night_no_door_v1 failures through useGatedCopy, so onboarding_incomplete opens the gate sheet with no error line -- grep: noDoorGated

## Files
- src/modules/organiser/p3/v2/NightCard.tsx
- src/modules/organiser/p3/v2/SkipDoorSheet.tsx
- src/modules/organiser/p3/v2/__tests__/nightNoDoor.test.tsx
- src/modules/organiser/p3/v2/__tests__/skipDoorSheet.test.tsx

## What to build
0. INVENTORY (short, in the PR body, not a file): the two catch sites (NightCard.tsx flipNoDoor ~line 117, SkipDoorSheet.tsx save ~line 15) and the shared rule src/modules/organiser/p3/onboarding/gate.ts useGatedCopy; coverage count at the end.
1. NightCard flipNoDoor: catch (e). Name the routed result `noDoorGated` = gated(e, () => 'x') from `const gated = useGatedCopy();` (import from '../onboarding/gate'). Always roll back the switch (setNoDoorOpt(!next)). Set the error flag only when the result is not null (onboarding refusal: no error line, the gate sheet opens).
2. SkipDoorSheet save: same pattern with useGatedCopy. On onboarding refusal: no `failed` line, busy off, sheet stays open, ticks kept (typed input never lost). On any other failure: today's behaviour. Nights already written before the failure stay written; invalidate their dateDetail queries as today (no change to the loop order).
3. Tests (extend the two listed test files): mock setNightNoDoor to reject with { message: 'onboarding_incomplete', details: '{"missing":["photo"],"organiser_id":"o1"}' }; assert getGate() is non-null (or subscribeGate fires, with a listener registered) and the error testid is absent; a generic rejection still shows the error; switch rolls back in both cases; SkipDoorSheet keeps its ticks. Run the new tests against unfixed code first and say so in the PR body.
No copy change, no new strings, no other screens.

## Do NOT touch
EventCalendar.tsx, calendar/CalendarGrid.tsx, calendar/CalendarListView.tsx, calendar/DayDetailModal.tsx, calendar/calendarUtils.ts, useCalendarEvents.tsx (density-exempt calendar files), src/components/ui/dialog.tsx, supabase/**, migrations, workflows, scripts/**, .env*, any file not listed under Files.

## Done when
One push; PR body has "## Verified on real data" (- Shapes surveyed: / - Checks run: / - NOT verified:) and "## Phone QA" (- Sizes checked: / - Walked: / - Not verified:); tests green; every CI job step that applies has been run and the per-job table is in the PR body; last commit subject ends with the [worker-done ...] marker. Docs-only or tests-only PR: delete the Phone QA section.
