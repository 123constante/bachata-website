# Brief: ticket sheet stopgaps for Saturday 14 November -- a date guard, and Connect payments inline

Brief-version: 2
Branch: claude/ticket-date-guard
Lane: normal, Sonnet. bachata-website; src + tests + docs, NO migration, no supabase/**, no workflow edit. Money-adjacent: you never approve or merge. ONE push at the end. Screen-only copy and form logic; do NOT touch the event screens, the calendar-protected files in the project rules, the checkout, or any RPC.
Serves: an organiser with a WEEKLY event (first: Bachateame, Saturdays) who adds a ticket. Two owner decisions (2026-11-07): (1) tell him a ticket covers every date and default its sales close to the next date; (2) when a PAID ticket is complete and payments are not connected, do not show a greyed Put on sale that points at another screen: save the ticket as a DRAFT and offer ONE Connect payments button right there.

## Why
A ticket type carries no date today: a new ticket keeps occurrenceId null (formOf in ticketModel.ts), so it is SERIES-WIDE. Capacity is per ticket type, so a series-wide ticket's capacity is shared across ALL the Saturdays, and an old ticket whose sales window has closed stays on later Saturdays as a disabled "Sales closed" row (ticketCheckoutModel.ts lines 95-107). Deliverable 1 is only the stopgap; the real fix (a ticket per date, the editor setting occurrence_id) is a separate product choice and is NOT built here. For deliverable 2, today a paid ticket with payments not connected shows Put on sale disabled with the reason "Connect payments in You > Get paid before selling paid tickets." (moveBlock in ticketModel.ts), which sends the organiser to a different screen.

## What main lacks
Found by the 2026-11-07 read of origin/main:
- any warning in the Add a ticket sheet that a ticket covers every date -- grep: covers every date
- a default for the sales close that follows the next date of a series with several dates -- grep: defaultCloseFor
- a Connect payments button inside the ticket flow, with a return to this event's Tickets sheet -- grep: Connect payments to put this on sale
- the Tickets sheet opening itself on return from Stripe -- grep: tickets=1

## Files
src/modules/organiser/p3/tickets/TypeSheet.tsx (exists: the note, the prefill, and the end-of-flow Connect payments block)
src/modules/organiser/p3/tickets/TicketsEntry.tsx (exists: open the sheet when the URL has tickets=1; the per-row Put on sale at the moveBlock use near line 477)
src/modules/organiser/tickets/ticketModel.ts (exists: `formOf` gets an optional second argument; one pure helper `defaultCloseFor`; one pure helper for the end-of-flow state)
src/modules/organiser/p3/tickets/data.ts (exists: reuse useStartOnboarding; add the optional return-path argument)
src/modules/organiser/p3/tickets/paths.ts (exists: stripeBack gets an optional return-to-event form; default output unchanged for every current caller)
src/modules/organiser/p3/tickets/__tests__/typeSheet.dateGuard.test.tsx (new)
src/modules/organiser/p3/tickets/__tests__/typeSheet.connectInline.test.tsx (new)
docs/handover/ticket-date-guard.md (new)

## What to build
1. DATE GUARD. When the series has MORE THAN ONE upcoming date, the Add a ticket sheet shows under the sales window: "This ticket is for every date of this event, and its numbers are shared across them. To stop selling after one night, set Sales close." Nothing for a one-date or non-recurring series. For a NEW ticket on such a series, prefill Sales close with the start time of the next upcoming date (London wall clock via the existing isoToLondonInput), editable and clearable, computed by the pure helper `defaultCloseFor(series)` (null when fewer than two upcoming dates or the next start is missing). `formOf(null)` stays exactly as today for any caller that passes no series; editing an EXISTING ticket never changes or prefills a field, and an untouched edit save sends nothing (the existing rule).
2. CONNECT PAYMENTS INLINE. In the Add a ticket flow, when the ticket is PAID and complete (valid price and capacity) and the Stripe state is not connected: save as a DRAFT as today and, at the end of the flow (and on that draft's row in the list), show the sentence "Connect payments to put this on sale" with ONE button that calls the existing useStartOnboarding(org.id) with a return path back to this event: `/account/p3/events/<seriesId>?tickets=1`. TicketsEntry reads `tickets=1` once on arrival, opens the Tickets sheet, and drops the param; with `stripe=return` in the URL it refetches the Stripe state. When the state turns connected, that same draft shows Put on sale ENABLED (the existing move). States: Stripe loading shows the existing "Checking your payment set-up. Reload the page if this stays." and no button; not_configured (onboarding cannot start) keeps the EXISTING disabled reason copy as the fallback and no button; the start error shows its message; a non-manager keeps NOT_MANAGER and sees no button; a FREE ticket never shows this block. Stripe cancel or refresh (stripe=refresh) returns to the same sheet with the same button, labelled "Carry on with Stripe" when the state is 'started'. One shared mapping in ticketModel.ts decides the block for the sheet and the list row; the markup only draws it. Use entities in JSX, not raw Unicode punctuation, and the explicit px sizes the P3 sheets use; the button is 44 px or taller.

## Tests
Table-driven, ONE shared mapping per fact, red first (record how many new rows fail on the unfixed code). typeSheet.dateGuard.test.tsx: series shapes {no dates, 1 date, 2 dates, 13 weekly dates, next start missing, next start in the past} x {new ticket, edit with a close set, edit with no close set} x {manager, contributor}: the note only for 2 or more dates; the prefill equals the next start in London time; an existing ticket's fields unchanged; an untouched edit save sends nothing. typeSheet.connectInline.test.tsx: {paid, free} x {connected, started, none, loading, not_configured} x {owner, manager, contributor} x arrival {fresh, stripe=return then connected, stripe=return still pending, stripe=refresh, cancel back with no param}: where the block shows, which one button, that it stays a draft until connected, that Put on sale is enabled only when connected, that NOT_MANAGER and the not_configured fallback copy survive, that the Stripe return path is exactly `/account/p3/events/<seriesId>?tickets=1` plus the stripe param. Mutate once each (return the first date instead of the next; show the button for a free ticket) and see rows fail.

## Verify
New tests, the existing tests in the p3 tickets folder and the ticketModel matrix test, `npm run typecheck`, `npm run check:mojibake`.

## Done when
Both deliverables in, tests green with the red-first counts recorded, the handover with Verified / Not verified (Not verified names: the sheet at 390x844, a real weekly series, a real Stripe round trip, the clock change in late October and March); last commit subject ends with your worker-done marker; one push; do not edit the PR body.
