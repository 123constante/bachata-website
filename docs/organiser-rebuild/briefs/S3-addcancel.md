# Brief S3 -- Add a date, Cancel a date, the "no dates left" fix

Repo `123constante/bachata-website`, branch `claude/org-r1-addcancel`, base `feat/organiser-r1` (wave 3). READ FIRST: `docs/organiser-rebuild/briefs/00-COMMON.md` applies with `<X>` = S3; plan = `docs/organiser-rebuild/R1-PLAN.md`. Sections: 4.1, 4.3 #2 #4 #5 #6 #9 #11, 4.4 (S3 row; 4.11 moved `useRunCommands` to `shared/runCommands.ts` and gave `events/dateCap.ts`, `takenOff.ts`, `schedule.ts` to S5: import them read-only), 4.5 Flows + Consistency, 4.12 R3-3, R3-7, D6, D29, D31, D34, D35, D40, D46, D49, D61.

## Owns (4.4 row)
`flows/add/**` (C7 which event, C8 which day, C9 time, Done), `flows/cancel/**` (C11 which event, C12 which date, C13 confirm, Done), `flows/fix/NoDates*.tsx` (C15 -> C15b -> C15c: the SAME add screens with the event pre-chosen, reached from the Home `no_dates_left` row), tests.

## Boards (3.14 C2, C3, C4 groups)
- Add: `/add` (C7, live series; skip when one qualifies, D34) -> `/add/:seriesId` (C8: `comingDays()` list of the next 30 days minus days already holding a date; a day beyond the series cap per `events/dateCap.ts` is disabled with its reason) -> `/add/:seriesId/:date` (C9: time field prefilled from the series' usual time; Save) -> ONE `series.add_date` -> Done "Added - Friday 23 October, 19:30" (C10 without Undo).
- Cancel: `/cancel` (C11) -> `/cancel/:seriesId` (C12, coming SCHEDULED dates only) -> `/cancel/:seriesId/:occurrenceId` (C13 confirm: the ONLY screen importing `WARN_DATE` (D31, D40); a quiet "Keep it" link; the gold button "Cancel this date"; optional reason field) -> ONE `occurrence.cancel {cancelled:true, reason}` -> Done "Cancelled - Tuesday 27 October" with TWO buttons (D61): Back to Home and "Put it back", the second sends ONE `occurrence.cancel {cancelled:false}` (`uncancelCommand`, D46) and lands on Done again ("Back on - Tuesday 27 October").
- No dates left (C15 family, D6/R3-3): Home row -> `/add/:seriesId` with a one-line header naming the event (the only sentence allowed is none: the event name is the title); the rest is the add flow; after Done the Home row is gone (the matrix proves it through `homeJobs()` with the new fixture).
- `version_conflict` -> the R3-7 Done variant. No Undo anywhere.

## Tests (4.5), RED first
- Each path sends exactly ONE command with kind, keys, `expected_version` (rpc spy); the cancel Done screen has exactly two buttons and the second sends ONE uncancel command (D61); `WARN_DATE` is imported by exactly ONE file (the import-site counter from S0b, now asserting 1); the past-date refusal text equals `eventState.ts:75` verbatim; C12 lists scheduled dates only (an all-cancelled series shows the empty state "No dates to cancel" with the one action "Add a date"); the add-day list excludes held days and disables capped days with a reason (`aria-disabled` + visible sub-line); the one-event organiser skips C7/C11; fixtures straddle 2026-10-25; clock frozen; every control >= 44px.
