# Brief: ticket promo codes, ORGANISER section (Website). BUILD-visual, careful lane. Branch claude/ticket-promo-codes-organiser. Repo 123constante/bachata-website.

Brief-version: 2
Lane: careful
Model: Opus
Never merge/approve/--no-verify. Plain git only. Supabase READ-ONLY on prod. PUSH ONCE (subject ends [skip preview] on early pushes only; never on the final push). Under 30% context; push + handover by 30%. No flag flips, no deploys, nothing turned on. Owner un-paused the TICKETING parts of the organiser area only (lead message 2026-11-04): touch nothing outside the ticketing files listed under Files.

Do NOT import from or touch the buyer half (Website PR #1364: src/modules/tickets/promo.ts, TicketsBlock.tsx, ticketCheckout*.ts): it is still open and stacking is forbidden. Keep the code rules in your own organiser module (a later cleanup can merge the two).

## Step 0: INVENTORY.md first (owner rule), before any code
Write `docs/design/ticket-promo-codes-organiser-INVENTORY.md`: every field, state and action the promo RPCs support (below), the existing P3 ticketing screens it must sit beside (src/modules/organiser/p3/tickets/TicketsEntry.tsx, TypeSheet.tsx, StackSheet.tsx, RefundSheet.tsx, gateCopy.ts, model.ts, data.ts) with file:line, GAPS listed, and a coverage count at the end (N rows, N shown, none silently omitted). Use the existing sheet and toast patterns; invent no new visual language. Design record `docs/design/ticket-promo-codes-organiser.md` with the state table.

## Prove the data source first (read-only prod, counts only)
The four RPCs exist on prod: ticket_promo_create_v1, ticket_promo_update_v1, ticket_promo_list_v1 (authenticated), ticket_promo_preview_v1 (anon, buyer side, not yours). Read their live definitions and the ACL; state which tables they read and who writes them. 0 promo codes exist today. Do not write anything to prod.

## RPC shapes (admin PR #1125 handover, verified merged)
- `ticket_promo_create_v1(p_event_series_id, p_organiser_id, p_code, p_kind 'percent'|'fixed', p_value, p_max_uses?, p_expires_at?)` -> `{ok, id, code}` or reasons `not_authorised, series_not_organisers, invalid_code, invalid_value, invalid_max_uses, invalid_expiry, code_taken`. Codes: 3..32 of A-Z 0-9 _ -, stored upper-case (send any case). percent 1..100; fixed is pence 1..100000.
- `ticket_promo_update_v1(p_id, p_patch)` patch keys `active, expires_at, max_uses, kind, value` (null clears expiry/max_uses) -> extra reasons `locked_after_use, invalid_request`. kind/value are locked once any order carries the code; max_uses cannot go below counted uses. Send ONLY changed keys; an untouched save sends nothing.
- `ticket_promo_list_v1(p_event_series_id)` -> `{ok, rows:[{id, organiser_id, code, kind, value, max_uses, used_count, expires_at, active, created_at, paid_orders}]}`.
- Rules: percent rounds DOWN per ticket; fixed is pence off EACH ticket, never below 0; zero total = free order; a discounted subtotal of 1..29p is refused for the buyer (below_minimum); max_uses counts ORDERS; a code applies to every type that organiser sells on that series; active codes are unique per series.
- `ticket_sales_summary_v1` now returns `gross_pence` (money taken, after discounts) and `discounts_pence`; show both on the sales line (list price = gross + discounts) wherever the sales summary is already shown.

## Build
A "Promo codes" section on the P3 Tickets screen for a series, behind the existing `organiserTicketing` flag (read how TicketsEntry is gated; add no new flag): list (code, discount in words, used x of max, expiry, on/off, paid orders), a create sheet, turn off/on, edit rules until first use (then locked: say why in words). Owner/manager only is decided BY THE SERVER (not_authorised): do not copy permission logic; show the server's refusal as plain copy with what the person can do next. British English, full weekday names, no jargon. Entities not raw unicode punctuation in JSX (`&mdash;`).

## State table (REQUIRED in the PR body and tests; table-driven; ONE shared mapping module)
Screen x state: empty list; 1 code; many codes (more than 100 rows is impossible per series but test 20); percent / fixed display; unlimited uses / limited; no expiry / future / past (expired); used / locked / used up; turned off; create errors (code_taken, invalid_code, invalid_value, invalid_max_uses, invalid_expiry, not_authorised, series_not_organisers); update errors (locked_after_use, invalid_request); network error and slow double-tap. Every state names what the person CAN do next; every disabled control says why; an untouched save sends no command.

## Checks
Shape survey (read-only counts): organisers with a Stripe account, series with ticket types, promo rows (0). Walk 390x844 AND 320x568, dark + light, with fakeSupabase fixtures (no prod write); `npm run check:bundle-budget` on main and branch: ZERO bytes added to the /app first load (lazy-load the section); overlay geometry (sheets/toasts portalled, no page scroll on open, an e2e at 390x844 asserting boxes inside the viewport). Run every applicable CI job step; per-job table + a Verified on real data block + honest Not verified in the PR body (use the repo's body checkers).

## What main lacks
- no promo codes UI for organisers -- grep: ticket_promo in src/modules/organiser (absent on main)
- no promo state table or tests for it -- src/modules/organiser/p3/tickets/promo/

## Files
src/modules/organiser/p3/tickets/promo/**
src/modules/organiser/p3/tickets/TicketsEntry.tsx
src/modules/organiser/p3/tickets/data.ts
src/modules/organiser/p3/tickets/__tests__/promo.matrix.test.tsx
docs/design/ticket-promo-codes-organiser.md
docs/design/ticket-promo-codes-organiser-INVENTORY.md
docs/handovers/ticket-promo-codes-organiser.md

TicketsEntry.tsx and data.ts: smallest possible edit (one mount, one data hook); say in the handover exactly which lines. Handover docs/handovers/ticket-promo-codes-organiser.md with Verified / Not verified. Final commit subject ends `[worker-done <ticket>]`.
