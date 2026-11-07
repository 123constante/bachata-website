# Brief: ticket date guard -- tell the organiser a ticket covers every date, and default its sales close to the next date

Brief-version: 2
Branch: claude/ticket-date-guard
Lane: normal, Sonnet. bachata-website; src + tests + docs, NO migration, no supabase/**, no workflow edit. Money-adjacent: you never approve or merge. ONE push at the end. Screen-only copy and a form default; do NOT touch the event screens, the calendar-protected files in CLAUDE.md, the checkout, or any RPC.
Serves: an organiser with a WEEKLY event (first: Bachateame, Saturdays) who adds a ticket and expects it to be for one night. Needed by Saturday 14 November; the real fix is a separate product choice and is NOT in this brief.

## Why
A ticket type carries no date today: the Add a ticket form has only a name, a price, a capacity and an optional sales window, and a new ticket keeps occurrenceId null (formOf in ticketModel.ts), so it is SERIES-WIDE. Capacity is per ticket type, so a series-wide ticket's capacity is shared across ALL the Saturdays, not renewed each week. And an old ticket whose sales window has closed stays on later Saturdays as a disabled "Sales closed" row (ticketCheckoutModel.ts lines 95-107). So an organiser who forgets the window sells one pool of tickets forever. This guard is ONLY the stopgap: the real fix (a ticket per date, the editor setting occurrence_id) is a follow-up the owner decides; do NOT build it.

## What main lacks
Found by the 2026-11-07 read of origin/main:
- any warning in the Add a ticket sheet that a ticket covers every date -- grep: covers every date
- a default for the sales close that follows the next date of a series with several dates -- grep: defaultCloseFor

## Files
src/modules/organiser/p3/tickets/TypeSheet.tsx (exists: the note and the prefill; reads the series' upcoming count and next dates from what the sheet already receives; add no read)
src/modules/organiser/tickets/ticketModel.ts (exists: `formOf` gets an optional second argument, and one pure helper `defaultCloseFor`)
src/modules/organiser/p3/tickets/__tests__/typeSheet.dateGuard.test.tsx (new)
docs/handover/ticket-date-guard.md (new)

## What to build
1. In the Add a ticket sheet, when the series has MORE THAN ONE upcoming date, show under the sales window: "This ticket is for every date of this event, and its numbers are shared across them. To stop selling after one night, set Sales close." Show nothing for a one-date series and nothing for an event that is not recurring.
2. For a NEW ticket on such a series, prefill the Sales close field with the start time of the next upcoming date (London wall clock, via the existing isoToLondonInput), editable and clearable. `formOf(null)` stays exactly as today for every caller that passes no series; the prefill comes through the new optional argument, computed by the pure helper `defaultCloseFor(series)`, which returns null when there are fewer than two upcoming dates or the next start is missing.
3. Editing an EXISTING ticket must not change its stored window or show the prefill: `formOf(existing)` is byte-identical to today, and saving an untouched edit sends no command (the repo's existing untouched-save rule). The note may show on an edit of a series-wide ticket on a multi-date series; it must not alter any field.
Use entities in JSX, not raw Unicode punctuation (CLAUDE.md), and the explicit px sizes the P3 sheets use.

## Tests
Table-driven, ONE shared mapping for `defaultCloseFor` and the note: series shapes {no dates, 1 date, 2 dates, 13 weekly dates, next start missing, next start in the past} x {new ticket, edit of a ticket with a close set, edit of a ticket with no close set} x {manager, contributor}. Assertions: the note appears only for 2 or more dates; the new-ticket prefill equals the next start in London time; an existing ticket's form fields are unchanged; an untouched edit save sends nothing; the contributor still sees the disabled state with its reason as today. Red first: run the new rows on the unfixed code and record how many fail. Mutate once (return the first date's start instead of the next upcoming one) and see rows fail.

## Verify
New tests, the existing tests in the p3 tickets folder and the ticketModel matrix test, `npm run typecheck`, `npm run check:mojibake`.

## Done when
Tests green with the red-first count recorded, the handover with Verified / Not verified (Not verified names: the sheet at 390x844, a real weekly series, the timezone change in late October and March); last commit subject ends with your worker-done marker; one push; do not edit the PR body.
