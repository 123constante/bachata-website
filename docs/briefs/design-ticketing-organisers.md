# DESIGN: ticketing for organisers (scheduled price rise, whole-course sale, early-bird, promo codes)

Written 2026-11-09 by website-72. Status: DRAFT 1, docs only, NOT reviewed, NOTHING dispatched or claimed on PROGRAM.md. Inputs: CONTRACT-ticket-tiers.md (tiers half reviewed twice; section 0b = owner answers Q1-Q10), website-a2's buyer-screen arc (admin #1300, S1a new reserve version, S1b per-line reserve, S1d; Q47 course QR scans once per night). Order set by the lead: organiser slices, then buyer tickets (a2), then this. Dispatch only after a2's S1a/S1b land.
Source of the "ownership" and priority: a peer message from the lead (website-8e), which says it relays an owner click I have not seen. Treat ownership as the lead's statement until the owner confirms.

## 1. Owner decisions this design obeys (do not reopen)
Course = WHOLE COURSE ONLY, one ticket, scans once per night (a2). Rise = date+time UK, removable/movable until it happens, public text "price rises on <date>", stale page = show new price and ask to confirm, paid-to-paid only (up or down), max 3 steps, early buyers keep what they paid, group prices NOT in v1, course refunds case by case via the existing refund screen. Early-bird = the same thing as a price step (no separate feature).

## 2. Design: one concept, "price steps"
A ticket type keeps `price_pence` as its BASE price (the current price today). Add a small schedule of later steps:
`ticket_price_steps(id, ticket_type_id, effective_from timestamptz, price_pence int, created_by, created_at)`, at most 3 rows per type, `price_pence > 0`, unique (ticket_type_id, effective_from), `effective_from > now()` when written. The EFFECTIVE price at time t = the price of the latest step with `effective_from <= t`, else the base price. Early-bird, "last-minute" and a rise are all just steps. (Alternative rejected: editing `price_pence` by cron: late, not auditable, races with reserves.)
- One DB function `_ticket_effective_price_v1(type_id, at timestamptz) returns int` is the ONE place price is computed. Public list, both reserves, organiser list and the buyer confirm state all call it (the contract's rule: one shared mapping, never two copies).
- Orders already store `unit_price_pence` per order (prod column), so buyers keep what they paid (Q9) with no extra work. The existing rule that blocks editing the base price once orders exist stays; steps are the sanctioned way to change price after sales.
- Free ticket (base 0): no steps allowed (Q6, paid-to-paid only). A step may not make price 0.
- Organiser actions: add step (date+time picker in UK time, price), move step, remove step, only while `effective_from > now()`; at most 3; a step must be later than the previous. Server returns reasons (`step_in_past`, `too_many_steps`, `not_paid_ticket`, `out_of_order`).

## 3. Checkout behaviour (shared with a2; the delicate part)
- The buyer page loads the effective price AND the next step (price, date) from `ticket_types_public_v1` (new columns or a v2 of it), so the page can say "price rises on <date>".
- At reserve, the buyer sends the price they SAW (`p_expected_unit_price_pence`). The reserve computes the effective price at `now()` inside the type-row lock. If it differs: return `{ok:false, reason:'price_changed', new_unit_price_pence, ...}` and create nothing (Q5: buyer sees the new price and confirms; confirming sends the new expected price). No grace period.
- Both reserve paths must do this (no-code v1 and code v2, the same two functions a2 is touching), or v1 is retired (CONTRACT OPEN-6). This is a hard dependency on a2's S1a/S1b; per-line pricing in S1b must read the effective price, never `price_pence` directly.
- Promo codes: discount is computed on the effective price at reserve time; the existing "no_discount" and "below_minimum" refusals apply to the effective price. A percentage code follows the step; a fixed-amount code can make a later step cheaper than... (see OPEN-D1).
- Stripe (VERIFIED in admin origin/main `_shared/ticketing.ts` `buildCheckoutSessionParams`, ~l.325-345): the Checkout line item `unit_amount` = `order.unit_price_pence - discount_pence / quantity`, read from the ORDER row, never from the ticket type. So a price step needs no edge-function change as long as the reserve writes the effective price into `unit_price_pence`. The edge function refuses a discount that is not the same per ticket (`discount_not_per_ticket`) and a non-positive unit amount.

## 3b. Dependencies on website-a2's arc (read from ~/.claude/plans/ticket-arc-briefs/, drafts, NOT landed, 2026-11-10)
- S1a adds `ticket_types_public_v2(p_event_series_id, p_occurrence_id default null)` with per-night remaining / sold_out / `effective_close_at`. The public price and next-step fields in section 3 must be added to THAT function, not to v1. T2 therefore waits for S1a.
- S1b replaces the one-type order with `ticket_order_lines(order_id, ticket_type_id, occurrence_id, quantity, unit_price_pence, discount_pence)`; order totals become sums of lines, and the edge function builds one Stripe line item per line. So the "write the effective price into `ticket_orders.unit_price_pence`" step in T2 becomes "write the effective price into each line's `unit_price_pence`", and `price_changed` must be evaluated PER LINE (a basket can hold a stepped ticket and an unstepped one; one stale line should name that line). The Stripe amount stays order-derived (verified today for the single-type order; to re-verify against S1b's edge change).
- S1b locks ticket types in `ticket_type_id` order; `_ticket_effective_price_v1` must not take extra locks (it reads `ticket_price_steps` only under the type locks already held).
- Course (kind=course, valid_from/valid_to, per-night check-in) comes from S1a; T5 starts after it.
- Both reserve functions still exist today; whether S1a/S1b make a new version or edit v1/v2 decides where `p_expected_unit_price_pence` goes (per line in a basket). Ask website-a2 before T2 is briefed.

## 4. Whole-course sale
Decided in a2's arc (`ticket_types.kind=course`, `valid_from/valid_to`, `ticket_night_check_ins`). This design adds only: a course ticket is a normal type with `kind=course` and can have price steps (early-bird on a course is the common case); organiser create flow asks "one night or a whole course"; public page shows the course dates. Refunds: existing screen, organiser decides (Q10). NOT designed here: how a course is tied to the series' sessions (a2 owns).

## 5. Slices (briefs, to write once a2 S1a/S1b land; each its own branch/PR; careful lane because money)
- T1 DB: `ticket_price_steps` table (explicit GRANT/REVOKE incl. service_role), `_ticket_effective_price_v1`, organiser RPCs `ticket_price_step_set_v1` / `_remove_v1` (can-manage check, onboarding gate), guard-list edit `scripts/onboarding-write-doors.json`. Replay proof + independent review; migration standing approval does NOT cover money, so owner Approve.
- T2 DB: reserve integration: `p_expected_unit_price_pence`, `price_changed` refusal, effective price in both reserves, public list gives current + next step. Coordinated with a2 (same functions). Owner Approve (money).
- T3 Website organiser: price-steps editor on the Tickets screen (add/move/remove, UK time, 3 max, empty state says what to do, disabled controls say why). Normal lane after T1.
- T4 Website buyer: "price rises on <date>" text and the "price changed, confirm" state (a2's screens; prototype v4 lacks it). a2 owns, I supply the contract rows.
- T5 Course create flow + early-bird presets (after a2's course schema).
- S1 (unchanged, first): phone walk + copy for existing pause + add.
Each slice: shape survey (counts), table-driven test, walk at 390x844 on seeded accounts, Verified / Not verified block. Contract rows to add: W1 journeys x P1-P8 (add step, move, remove, step passes while page open, step during checkout, step x promo, step x sold-out x chain, step on free ticket refused, step in past refused, 4th step refused).

## 6. Open design decisions (mine to settle before briefs; none is a product question for the owner unless marked)
OPEN-D1 Fixed-amount promo codes across steps: a code for 5 GBP off on a 15 GBP early price vs a 25 GBP later price. Proposed: discount applies as written to whatever price is effective. (Product: owner only if he wants codes tied to a step.)
OPEN-D2 Chain (sequence-opening) x steps: a successor tier opening with its own steps. Proposed: independent; steps are per type.
OPEN-D3 Time source: all comparisons use `now()` in the reserve transaction (server time), never the client clock. Display in Europe/London.
OPEN-D4 DST edge: a step at 01:30 on the clock-change night. Proposed: store timestamptz, show London; the editor refuses non-existent local times.
OPEN-D5 (RESOLVED, verified) A step in flight for a pending (unpaid) order: the order keeps the price confirmed at reserve. Bounds: Stripe session lifetime 32 min (`CHECKOUT_EXPIRES_AFTER_SECONDS`), sweep closes a pending order after 37 min with a session, 10 min without (`ticket_orders_sweep_v1`). A buyer who reserved at the early price at 17:59 can therefore pay up to ~37 min after the rise at 18:00. Decide whether that is acceptable: proposed YES, because they confirmed the price they were shown (owner Q5).
OPEN-D6 Visibility of the next step when the next price is LOWER than the current (price drop): proposed show it too (same text, "price changes on").

## 7. Not verified
(Closed 2026-11-09: Stripe amount and sweep window, see section 3 and OPEN-D5. Platform fee: edge default is 0 pence, `TICKET_BOOKING_FEE_PENCE` can override; all 3 paid orders on prod carry booking_fee_pence 0, latest 2026-11-07; the secret itself is still unread.) a2's actual S1a/S1b function signatures (nothing landed, #1300 unmerged); prod data for courses (17 course-format series, none with ticket types); whether Anna's event is ticketed at all; team-member write access; any phone walk. No migration, code or dispatch exists for this design.


INVENTORY.md first, coverage count last (see the review brief).
