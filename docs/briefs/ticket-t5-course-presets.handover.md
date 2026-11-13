# T5 course ticket create + early-bird presets: handover

Branch `claude/ticket-t5-course-presets`. Brief: `docs/briefs/ticket-t5-course-presets.md` on `brief/ticket-t5-course-presets`. Flag `ticketCoursePresets` (`VITE_ENABLE_TICKET_COURSE_PRESETS=true`; needs `organiserTicketing` and `ticketPriceStepsEditor`). Money lane: do not merge; the arc owner posts the independent review.

## Done
- No database change. `ticket_type_upsert_v1` already takes `kind`, `valid_from`, `valid_to` (read-only check of the live function, 2026-11-13).
- `tickets/coursePresets.ts`: pure model and copy. Presets are 4, 2 and 1 weeks before the start, at 00:00 London (never in a spring gap or an autumn repeat). Skipped with a reason: past, or a step already at that instant. None for free types or at 3 steps. A preset fills the T3 form with the time only; the price stays empty.
- `ticketModel.ts` / `ticketsApi.ts`: `TypeForm` and `UpsertDraft` gain optional kind and dates; only a NEW course adds `kind`, `valid_from`, `valid_to` to the payload. A night ticket or an edit is byte-identical to before.
- `ticketsApi.fetchCourseDates` (a plain table read) and `data.useCourseDates`: the saved type's kind and dates.
- `TypeSheet.tsx`: "This ticket is for: Each night / A course" with start and end date on a NEW ticket; "save first" note under a new paid course; presets passed to `PriceSteps`.
- `PriceSteps.tsx`: optional `presets` prop renders the preset block; tapping one opens the existing add form with the time filled in. Saving is the unchanged T3 path.
- No new RPC, so `onboarding-write-doors.json` is untouched.
- Tests: `tickets/__tests__/coursePresets.model.test.ts` (17), `p3/tickets/__tests__/coursePresets.matrix.test.tsx` (12), walk `tests/e2e/walk-ticket-t5-course-presets.spec.ts` (390x844 and 360x640, 6 pass), registered in `check-e2e-spec-coverage.mjs`. The new modules did not exist before, so the tests were red by construction.

## Left / next steps
- Owner Approve; turn the flag on a preview and walk it on a phone with a real course. Prod has no course type to survey beyond the schema.
- Decide whether presets should also suggest a price (today the organiser enters it).

## Not verified
- No real write against prod (connector is read-only); screenshots are not attached to the PR.
- A course created from the editor was not run against the real RPC.
