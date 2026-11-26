# Brief: early-bird count tier (ticket types)

Status: DRAFT 1, 2026-11-26. Money lane: do not merge until the owner approves prices. Nothing built.
Branch: `claude/early-bird-prices` (worktree `C:\dev\Website-earlybird`).
Class: BUILD-visual + MIGRATE (DB in `bachata-admin-11april`, not here). Website side is the ticket page and organiser sheet.

## Owner decisions (2026-11-26, clicks)
1. Scope: paid event tickets only (not courses in this brief; T5 presets stay as they are).
2. End rule: count only. The early tier ends when its count sells out. No date. (Date-based steps are T3/W1 and are a separate mechanism.)
3. Display: ticket page only. Not calendar cards or listings.
4. Organiser sets early price and early count per ticket type, in the organiser ticket sheet.
5. Sold out of early count: the normal price shows automatically.
6. Refund or cancel of an early ticket returns its slot to the early pool while the early tier is open.
7. Ticket type with no early price: normal price only. No early label, no "ended" line.
8. Organiser sees early left and sold per ticket type.
9. Any number of early tickets per order while stock lasts.
10. Checkout started at the early price keeps it; the seat is held (reserve hold, 15 min).
11. Display: normal price struck through, early price big, badge "Early bird". Exact copy and layout come from the approved mockup, not from this brief.

## Open for the owner (click before build)
- A. Does the early tier coexist with a T3 price step on the same ticket type? Proposed: refuse (one price mechanism per type at a time). Owner to confirm.

## Existing code this must respect (read before design)
- `ticket_types` (admin schema): `price_pence`, `capacity`, `reserved_count`, `status`, `manual_sold_out`, `sales_open_at`, `sales_close_at`.
- Price seam: `_ticket_effective_unit_price_v1(p_type, p_occurrence_id)` wraps `_ticket_effective_unit_price_at_v1(..., p_at)` (design-ticketing-organisers s.3a, contract-ticket-tiers R-1). Early tier must go through this seam. No second price function.
- Readers that must call the seam (R-2): promo preview v2, public list `ticket_types_public_v2`/`v3`, organiser read `ticket_types_manage_v1`, sales summary v1/v2.
- Reserve: v5 path (basket, `expected_unit_price_pence` per line) is the target. Do not add a v6 path. Early tier must not break the phased retirement of v1-v4 in progress (T2 / T2b).
- Stored price per order: `ticket_orders.unit_price_pence`. Existing buyers keep their price.
- Refund path: refund must decrement the early sold count (return the slot) only while the early tier is open; a refund after the tier closes does not reopen it.

## Checklist (prototype is the whole spec)
Mockup round is REQUIRED before any UI build (Flow step 2). This brief has no mockup yet. Until the owner approves a mockup, the UI elements are not listed. Elements to be listed here from the approved prototype:
- [ ] Ticket page: struck normal price, early price, badge, sold-out fallback to normal price.
- [ ] Organiser ticket sheet: early price field, early count field, read-only left/sold line.
- [ ] Tap table at 390x844 in the PR body (every button, destination, prototype/OLD).

## Steps (order)
1. Mockup (question walk) of ticket page and organiser sheet, BEFORE/AFTER, owner clicks. STOP until approved.
2. Admin repo: migration adds `early_price_pence`, `early_capacity`, `early_reserved_count` (or equivalent) to `ticket_types`; seam reads them; reserve reads them at `now()`. Author in admin repo only (`supabase/migrations/` must not exist in Website).
3. Website: readers show early price; picker shows struck price and badge; checkout sends expected price from the list (v5 basket wire, already in place behind `ticketPriceSteps`).
4. Organiser sheet fields behind a new flag `ticketEarlyBird` (default OFF).
5. Tests: unit matrix for the seam (early open, early sold out, refund in/out of window, no early price, T3 step conflict per click A); e2e walk at 390x844 and 360x640.
6. Real-data check: read-only counts on prod shapes (project `stsdtacfauprzrdebmzg`), no writes.

## Stop conditions
- Money or price change needs owner Approve. Do not ship a price path without it.
- Any change to the reserve or refund RPCs needs the independent review round (risky class).
