# Brief: buyer tickets show refunded, cancelled-night note, Used, list order (P2 Website slice)
Class: BUILD-visual. Website only, zero migrations. One branch, one PR. Check the current code first: some rules may already match, change only what differs.
Prod now returns (admin migration 20261118194506, applied): every ticket object from `my_tickets_v1` has `refunded` (boolean, order fully refunded, qr_token and short_code NULL then) and `order_refunded_pence` (integer, > 0 on a paid order = money-only part refund, tickets keep their QR). `my_ticket_order_qr_v1` unchanged (never returns refunded tickets). Refunded tickets of a fully refunded order are now returned, including those of past nights.

## Owner decisions (click answers 2026-11-18, binding; DESIGN-REGISTRY rows "Buyer ticket card: refunded", "round 2", "cancelled night + used", "My tickets list")
1. Refunded ticket (`refunded = true`): greyed card, 'Refunded' tag, no QR. ONE line ON the card (no tap needed): amount + 'usually 5 to 10 working days to reach your card'. Amount = `order_refunded_pence` formatted GBP. No contact line.
2. Refunded AND night cancelled: Refunded wins (amount shown); the cancelled wording shows only when not refunded.
3. Money-only part refund (`refunded = false`, `order_refunded_pence > 0`): tickets look normal with QR; one quiet line 'Part refunded GBP X' on the order card.
4. Cancelled-night card: 'This night was cancelled' + second line 'The organiser will be in touch about refunds' (never promise a refund). Stays listed until the original date passes.
5. Checked-in ticket: greyed, 'Used' tag, QR hidden.
6. List order: soonest night first; greyed cards (refunded, cancelled, used) at the bottom. Past nights drop off entirely (no history section). Refunded card stays listed until the night passes, then drops off.
7. Empty state: 'No tickets yet' + one button to browse events.

## Where
Both surfaces: `src/modules/tickets/` (MyTicketsPage, myTicketsModel.ts, myTicketsApi.ts, ticketCardStatus.ts: the ONE status mapping, extend it, never copy it) and `src/modules/dancer-app/screens/tickets/` (model.ts, TicketCard.tsx, useTicketCard). Map the two new keys in the api/model layers; regenerate/extend types only if they are typed there (`src/integrations/supabase/types.ts`, fix call sites, not checks). Use HTML entities for punctuation in JSX.

## Checks
Table-driven vitest: every surface x shapes (valid, used, cancelled, refunded, refunded+cancelled, part refund, past night, empty). New tests must fail on the unfixed code first. `npm run test:unit` for the touched modules, `npm run pre-ship`. 390x844 walk with prod-shaped data (recipe: memory reference_account_link_walk_recipe.md): screenshots in the PR of refunded card, cancelled card, used card, part-refund line, empty state. PR body needs the "Verified on real data" block with an honest "Not verified". Flags stay as they are.
