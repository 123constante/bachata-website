# Brief: In Add a ticket, connecting payments is the obvious default and the external link is a small text link under it
Brief-version: 2
Branch: claude/connect-sheet-default
Lane: normal, Sonnet. bachata-website, screen change inside the P3 tickets sheets; must not touch supabase/**, the calendar density-exclusion files, or the Stripe onboarding edge function.
Serves: an organiser setting a ticket price who should land on "payments connected, on sale" without help (owner priority 2026-11-08). Owner click: the external ticket link is a small plain text link UNDER the Connect payments button, never promoted.

## What main lacks
- Stripe is named at price entry (step 1 of Add a ticket) with a one-line "About 10 minutes, you leave the app for Stripe and come back" hint, so a person choosing a paid price knows the next step -- grep: STRIPE_AT_PRICE_HINT
- A small plain text link "Selling elsewhere? Add a ticket link" under the Connect payments button (sheet step 3 and the draft row), opening the event Details ticket link field; no other external-link entry point is promoted -- grep: SELLING_ELSEWHERE_LINK
- The Stripe start error is shown in the sheet and in the return banner "Carry on with Stripe", not only on the draft row -- grep: CONNECT_START_ERROR_SHOWN
- The switched-off wording ("Connect payments in You > Get paid") becomes a real tap target that goes to Get paid, and the stale "Stripe tickets come later" comment is removed -- grep: PAYMENTS_WHERE_LINK
- A `stripe=refresh` arrival on the Tickets sheet says why the person is back ("The Stripe link ran out") and offers Carry on with Stripe -- grep: STRIPE_REFRESH_NOTE

## Files
src/modules/organiser/p3/tickets/TypeSheet.tsx
src/modules/organiser/p3/tickets/TicketsEntry.tsx
src/modules/organiser/tickets/ticketModel.ts
src/modules/organiser/p3/new/sheets.tsx
src/modules/organiser/p3/tickets/__tests__/connectSheetDefault.matrix.test.tsx (new)
docs/arcs/organiser.md

## What to build
0. FIRST read the audit: git fetch origin claude/walk-ticket-connect-flow; git show FETCH_HEAD:docs/walk/ticket-connect-flow/RESULTS.md (gaps named in the title block). Then write INVENTORY.md first: every field, state and option of the Add a ticket sheet, the draft row and the return banner from the admin app (quote what the Website reads), the current Website and the public page, each with file:line. Build only after it exists and report the coverage count (covered / total) at the end. Put it at docs/design/connect-sheet-default.INVENTORY.md (new).
1. Copy constants (the tokens above) live in ticketModel.ts, one shared mapping, no text pointing at a missing control; every state in the audit walk table (none, started, connected, switched off, refresh) has a next action.
2. Wire the five items in TypeSheet.tsx and TicketsEntry.tsx; the external link is plain small text (not a button, not a chip), 44 px tap area, under Connect.
3. Do NOT split the `started` state into needs-details vs waiting (a later slice) and do not change return-path polling (a later slice).
4. Update this slice's row in docs/arcs/organiser.md.

## Tests
Table-driven matrix test over stripe state x series live x ticket paid/free x arrival (none, return, refresh) asserting: exactly one primary action, the external link is never primary, every state has a next action, an untouched save sends nothing. Red first. `npm run check:mojibake`; tsc on touched files.

## Done when
Matrix green, Verified / Not verified block (Not verified: signed-in 390x844 walk, real Stripe round trip), design record linked.
