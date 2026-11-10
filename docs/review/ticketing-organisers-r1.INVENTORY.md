# INVENTORY: every price / tier / step surface (review ticketing-organisers r1)

Written 2026-11-10, BEFORE judging, per `docs/briefs/review-ticketing-organisers.md`.
Sources: Website `origin/main` f0f3b29 (git grep, file:line); prod `stsdtacfauprzrdebmzg`
`pg_proc` / `pg_class` / `pg_default_acl` / counts (SELECT only, no personal data, no writes).
The admin repo (`bachata-admin-11april`) is NOT attached to this session; its DB objects are
inventoried from prod `pg_proc` (the deployed truth), its edge-function source is a GAP.

Numbering: I-n. Every I-n is judged in the review (coverage count at its end).

## A. Admin-owned DB objects on prod (read from pg_proc, 2026-11-10)

### Price source and the existing seam
- I-1 `ticket_types.price_pence` (integer, base price). 17 types on prod: 15 on_sale, 2 paused (1 free, 1 paid); all `kind='night'`, all `occurrence_id IS NULL`; 3 series. Course types: 0.
- I-2 `_ticket_effective_unit_price_v1(p_type ticket_types, p_occurrence_id uuid) returns integer`, STABLE, NOT security definer, `search_path=pg_catalog, public`, EXECUTE postgres only. Body: `SELECT p_type.price_pence;`. **An effective-price seam already exists; the design does not mention it.**
- I-3 `_ticket_type_per_night_v1(p_type)` = `kind='night' AND occurrence_id IS NULL`. True for all 17 prod types.
- I-4 `ticket_price_steps` table: DOES NOT EXIST (public ticket tables: checkout_attempts, door_code_attempts, night_check_ins, night_counts, order_lines, orders, promo_checkout_refusals, promo_codes, promo_preview_reads, status_reads, types, webhook_events, tickets).

### Reserve functions (all SECURITY DEFINER, search_path pinned, EXECUTE service_role only)
- I-5 `ticket_checkout_reserve_v1(p_ticket_type_id, p_quantity, p_buyer_email, p_buyer_name, p_buyer_user_id, p_booking_fee_per_ticket_pence)`: unit = `v_type.price_pence` (direct), `FOR UPDATE`, free gate `v_type.price_pence > 0`.
- I-6 `ticket_checkout_reserve_v2(... , p_promo_code, p_email_hash, p_ip_hash)`: unit = `v_type.price_pence` (direct); discount `_ticket_promo_unit_discount_v1(kind, value, v_type.price_pence)`.
- I-7 `ticket_checkout_reserve_v3(... , p_occurrence_id)`: unit = `v_type.price_pence` (direct, twice); same discount call.
- I-8 `ticket_checkout_reserve_v4(p_lines jsonb, p_occurrence_id, p_buyer_email, p_buyer_name, p_buyer_user_id, p_booking_fee_per_ticket_pence, p_promo_code, p_email_hash, p_ip_hash)`: per line `v_unit[i] := _ticket_effective_unit_price_v1(v_types[i], v_night)`; locks all basket types `ORDER BY t.id FOR UPDATE`, then night-count rows; refusals carry `line` + `ticket_type_id`; `hold_expires_at = now() + 15 min`; writes `ticket_orders.unit_price_pence = v_unit[1]` and `ticket_order_lines.unit_price_pence = v_unit[k]`. Only reserve that uses the seam.
- I-9 Order shapes on prod (5 orders): expired 2, paid 2, refunded 1; all `line_count=1`, `occurrence_id NULL`, `hold_expires_at NULL`, no promo. **No order on prod was written by v4** (v4 always sets hold_expires_at).

### Refusal / pricing helpers
- I-10 `_ticket_checkout_sale_refusal_v1` / `_v2(p_type, p_quantity, p_occurrence_id)`: status, window (`now() < sales_open_at`, `now() >= effective close`), capacity. No price logic.
- I-11 `_ticket_promo_unit_discount_v1(kind, value, unit)` IMMUTABLE: percent = `least(floor(unit*value/100), unit)`, fixed = `least(value, unit)`. Integer pence; percent rounds the discount DOWN.
- I-12 `_ticket_stripe_min_charge_pence_v1()` = 30 (below_minimum threshold).
- I-13 `ticket_promo_preview_v1` / `_v2` (anon EXECUTE): `v_unit := v_type.price_pence` (direct).
- I-14 Promo codes on prod: 1 (percent, active).

### Public / organiser reads
- I-15 `ticket_types_public_v1(p_event_series_id)` (anon): returns `t.price_pence`, `ORDER BY t.price_pence, t.name`.
- I-16 `ticket_types_public_v2(p_event_series_id, p_occurrence_id)` (anon): returns `d.price_pence` (base, direct), per-night remaining / sold_out / effective_close_at, `ORDER BY d.price_pence, d.name`. No next-step columns.
- I-17 `ticket_sales_summary_v1` / `_v2` (authenticated): type `price_pence` direct; v2 money from line `unit_price_pence`.
- I-18 `ticket_type_upsert_v1` (authenticated): `price_pence` refused to change only when `has_orders`; a type with no orders can change price, including to 0.
- I-19 `ticket_type_set_status_v1` (authenticated): Stripe gate `v_type.price_pence > 0`.

### Payment / refund paths
- I-20 `ticket_order_mark_paid_v1`: refuses `amount_mismatch` unless Stripe `amount_total = order.total_pence`; late payment of an expired order re-takes capacity (`_ticket_order_retake_lines_v1`) at the stored line price.
- I-21 Refund / dispute functions (`ticket_order_mark_refunded_v1`, `_charge_refunded_v1`, `_mark_disputed_v1`, `_dispute_closed_v1`): no reference to `price_pence` or `unit_price_pence` (prosrc search); they work on order totals / amounts.
- I-22 `_ticket_order_lines_v1`, `_ticket_order_line_fill_v1` (trigger), `_ticket_order_lines_check_v1` (trigger: lines must sum to order subtotal/discount/quantity; line 1 unit must equal order unit for one-line orders).
- I-23 `ticket_orders_sweep_v1`: pending without session closed after 10 min, with session after 37 min. `ticket_orders_hold_due_v1`: pending with `hold_expires_at <= now()` (v4 holds, 15 min).

### ACL environment
- I-24 `pg_default_acl` in `public` (owners postgres and supabase_admin): new TABLES grant `arwdDxtm` to anon and authenticated; new FUNCTIONS grant EXECUTE to anon and authenticated.
- I-25 `ticket_types`: RLS on; grants authenticated `r`, service_role all; one policy `ticket_types_member_read` (authenticated SELECT). `ticket_order_lines`: RLS on; service_role `r` only; no anon/authenticated.
- I-26 `_ticket_can_manage_organiser_v1(p_organiser_id)`: SECURITY DEFINER, EXECUTE service_role only (callable from inside definer RPCs).
- I-27 DB `TimeZone` = UTC.

### Edge function (admin repo)
- I-28 GAP: `supabase/functions/ticket-checkout` source NOT read (admin repo not in this session). Which reserve version prod calls is NOT verified; I-9 shows no v4 orders yet.

## B. Website (origin/main f0f3b29)

### Buyer
- I-29 `src/modules/tickets/ticketCheckoutApi.ts:51` buyer list reads `ticket_types_public_v2`; `:66` promo preview reads `ticket_promo_preview_v2`; `:91-125` checkout POST to edge `ticket-checkout`.
- I-30 `src/modules/tickets/ticketCheckoutModel.ts:35,70` `pricePence` parsed from `price_pence`; no next-step / effective-price fields.
- I-31 `ticketCheckoutModel.ts:174-178` `totals()` = `pricePence * qty + BOOKING_FEE_PENCE * qty` (client-side display).
- I-32 `ticketCheckoutModel.ts:235-246` `CheckoutBody`: `ticket_type_id`, `quantity`, email, name, urls, `promo_code?`, `occurrence_id?`. **No expected price field.**
- I-33 `ticketCheckoutModel.ts:302-337` `REASON_COPY`: no `price_changed` entry (unknown reason falls to the generic path).
- I-34 `src/modules/tickets/TicketsBlock.tsx:85` list `staleTime: 30_000`; `:126` promo only on paid; `:205-207` pay total = preview `appliedTotalPence` (server preview, base price) + fee, else `totals()`; `:300` price shown `formatPence(t.pricePence)`; `:412-428` summary lines.
- I-35 `src/modules/tickets/ticketSymbol.ts:10-11` and `ticketCheckoutModel.ts:233` `buyLabel`: free-ness from `pricePence === 0`.
- I-36 `src/lib/ticketBookingFee.ts` `BOOKING_FEE_PENCE` constant (0), mirrored server-side by env `TICKET_BOOKING_FEE_PENCE`.

### Organiser
- I-37 `src/modules/organiser/tickets/ticketsApi.ts:113-119` organiser list = direct `ticket_types` select (RLS read), `price_pence` base only; `:184-191` upsert payload `price_pence`; `:197` set_status.
- I-38 `src/modules/organiser/tickets/ticketModel.ts:185` `priceLabel`; `:439-440` price validation; `:481` payload price; `:499-507` `PRICE_LOCKED_TEXT` / `priceLock(hasOrders)`; `:642` `has_orders` copy; `:672-684` `buyerTotal` preview line.
- I-39 `ticketModel.ts:251-257` `moveBlock`: Stripe gate on `pricePence > 0`.
- I-40 `ticketModel.ts:360-369` `isoToLondonInput` / `londonInputToIso` (London wall clock <-> instant, used for sales window; the obvious reuse for step times). Probe 2026-11-10: `2027-03-28T01:30` (does not exist in London) -> `01:30Z` -> shown back as `02:30` (silently moved, not refused); `2026-10-25T01:30` (exists twice) -> `01:30Z` (the later, GMT, instant).

## C. Design / contract claims to check (inputs)
- I-41 Design s.2: new `_ticket_effective_price_v1(type_id, at timestamptz)` as "the ONE place".
- I-42 Design s.3: `p_expected_unit_price_pence`, `price_changed` refusal, "both reserve paths (v1 and v2)".
- I-43 Design s.3b: S1a/S1b "NOT landed".
- I-44 Design OPEN-D5: early-price exposure bounded by 32/37 min.
- I-45 Design s.5 T1: explicit GRANT/REVOKE, can-manage, onboarding gate.
- I-46 Design OPEN-D3/D4: server `now()`, London display, editor refuses non-existent local times.
- I-47 Design s.2: free base -> no steps; steps > 0.
- I-48 Design s.4 course + steps; contract Q1/Q7/Q9.

## GAPs (cannot be inventoried here)
- G-1 Admin edge function `ticket-checkout` and `_shared/ticketing.ts` source (I-28).
- G-2 Admin app organiser UI (if any separate from the Website) for ticket types: not readable here.
- G-3 Admin `origin/main` migration bodies vs prod bodies (no md5 compare done; prod is what I judged).
- G-4 Any phone walk (docs-only review; no UI exists to walk).

Inventory size: 48 items (I-1..I-48) + 4 GAPs.
