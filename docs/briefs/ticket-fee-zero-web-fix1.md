# Brief: fix round 1 on PR #1135 (remove the 50p fee): the P3 tickets screen still names a fee

Branch `claude/ticket-fee-zero-web` (continue; head 17e84653). Copy + test only, no new rule.

## The failure (owner's order 2026-10-29: "remove the 50p fee"; required check `unit (Europe/London, full)` is RED)
`src/modules/organiser/p3/tickets/TicketsEntry.tsx:315` renders
`Buyers pay a {feeLabel(BOOKING_FEE_PENCE)} booking fee per paid ticket, up to {MAX_PER_ORDER} tickets an order.`
At fee 0 that prints "Buyers pay a 0p booking fee per paid ticket". 7 cases fail in
`src/modules/organiser/p3/tickets/__tests__/tickets.matrix.test.tsx` ("the sheet: rules line, one row per type, the
read-only note only for a contributor", once per shape). The earlier builder and the review only searched
`src/modules/organiser/tickets`, which is why both missed this second organiser surface.

## Do
1. Make the rules line fee-aware exactly like the sibling surface (`src/modules/organiser/tickets/SeriesTickets.tsx`
   rules line, from the first round): at fee 0 say "Buyers pay the ticket price, up to 20 tickets an order."; with a
   non-zero fee keep the old sentence. Reuse the one shared helper/constant if one exists; do not make a third copy.
2. Update the 7 failing assertions to the new line. Add one table case that renders the line at a mocked non-zero fee
   and proves the old sentence still appears (like `bookingFee.shared.test.tsx`).
3. Class fix: grep the WHOLE `src/` tree (not one folder) for `feeLabel(`, `BOOKING_FEE_PENCE`, `booking fee`, `BOOKING_FEE_LABEL`
   and list every non-test hit with file:line in your handover, each marked "gated on > 0" or "fixed". Fix any other
   ungated fee wording you find.
4. Do not touch `legalCopy.ts` or `LEGAL_COPY_STATUS`. Do not add screenshots.

## Checks you must run (CI runs them; run them first)
`npx vitest run src/modules/organiser src/modules/tickets` all green; `npx tsc --noEmit` has no NEW error vs main (main has
97 known). Say the counts. Walk `/account/p3/events/<id>/tickets` at 390x844 only if the harness works in 5 minutes;
otherwise say "not walked" (the orchestrator walks it).

## Finish
Push `claude/ticket-fee-zero-web` once. Update `docs/handovers/ticket-fee-zero-web.md` (a short "Fix round 1" section).
Last commit subject ends with the worker-done marker from the dispatch prompt. Context cap 50%.
