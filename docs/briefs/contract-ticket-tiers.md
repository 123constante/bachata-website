# CONTRACT: ticket tiers (person type x journey x data shape)

Written 2026-11-09 by website-72 (ticketing-support chat) at website-8e's request. Status: DRAFT 5 (2026-11-10: ticketing reviews r1 F1-F11 and r2 N1-N6 applied to the W1 price-step rows, section 0c; tiers half unchanged since DRAFT 3). Nothing dispatched, claimed or built. Input: NOTES-ticket-tiers-contract.md (owner answers). Layout follows CONTRACT-organiser-area-v2.md.

## 0. HEADLINE CORRECTION (read first)

Earlier in this chat I told the owner "no pause control exists". That was WRONG: my checkout of C:\dev\Website was 440 commits behind main. On current main and prod:
- Pause already exists: DB `ticket_type_set_status_v1` (draft/on_sale/paused/sold_out/closed machine), organiser "Selling switch" in `src/modules/organiser/tickets/ticketModel.ts` (`switchMove`: on_sale <-> paused) and `ticketsApi.ts`.
- Add a price already exists: `ticket_type_upsert_v1` (create needs organiser can-manage, onboarding complete, series live).
- Price edit is blocked once any order exists (`has_orders`), so "pause the old, add a new price" is already the only route after a sale, and works today.
- Public page hides paused tiers: `ticket_types_public_v1` returns only on_sale/sold_out. Checkout refuses non-on_sale, outside window, over capacity: `_ticket_checkout_sale_refusal_v1`, used by `ticket_checkout_reserve_v2`; `ticket_checkout_reserve_v1` refuses the same three cases INLINE (see V-7).
So Anna's need may be met TODAY. The real gap is (a) whether the screen makes the "pause old, add new" route obvious on a phone, (b) the sequence-opening feature (new). Slice 1 "pause + add" is probably a walk + copy job, not a build. See section 6.

## 0b. SCOPE WIDENED (owner clicks, 2026-11-09 evening): "ticketing for organisers"
Owner chose: (1) widen from tiers-only to ONE contract for every organiser ticket journey; (2) a price that rises on a date = ONE price with a "rises on" date (NOT two dated tiers); (3) also cover courses (several sessions, one ticket), early-bird and group prices, promo codes (built). This file is still the tiers half; sections below marked NEW-WIDE are sketches, NOT designed, NOT reviewed, and the independent review of the tiers half does not cover them.
NEW-WIDE journeys to add to the matrix once designed (each needs person types x shapes x verified/not verified like the rest):
- W1 Scheduled price rise: one ticket with price P1 now and P2 from a date. Conflicts to resolve: `ticket_type_upsert_v1` blocks price change once orders exist (V-4) and `ticket_orders.unit_price_pence` is stored per order, so existing buyers keep their price; the rise must be a schedule applied at RESERVE time (reserve reads the effective price at `now()`), shown to the buyer, and refused honestly if the price changes between page load and pay (stale-page buyer, Stripe session amount). Needs a new table or column (e.g. `ticket_price_steps(ticket_type_id, effective_from, price_pence)`), a migration, a change in BOTH reserves and the public list. Money surface = careful lane + owner Approve. Free -> paid step and paid -> free step: decide (proposed: refuse).
- W2 Course: one ticket covering several sessions of a series. Not surveyed: how a course (format `course`, 17 series in prod) is ticketed today, whether the door accepts a course ticket at every session (check-in marks the ticket `used` once, so a multi-session ticket would be scanned out after session 1: a real gap), and what a refund or a missed session means.
- W3 Early-bird and group prices: early-bird = W1 or a dated tier; group price = quantity-based unit price (needs a rule: from N tickets the unit price is X). Not designed.
- W4 Promo codes: exist (v2); the tiers-half already has J9b-d. Add W1 x code and W2 x code.
Product questions for the owner, not yet asked: how Anna's course actually sells (per session, per course, both); whether the rise date is a date or a date-time and in which timezone (UK time proposed); whether an organiser may remove a scheduled rise; whether buyers see "price rises on <date>" on the public page.
OWNER ANSWERS (10 click questions, 2026-11-09 night; these close the "Product questions" line above):
Q1 Course sells WHOLE COURSE ONLY (no per-session price in v1). Q2 Rise time = date AND time, UK time. Q3 Organiser can remove or move a scheduled rise any time before it happens. Q4 Public page shows "price rises on <date>". Q5 Stale page at pay time: show the NEW price and ask the buyer to confirm (nobody charged a price they did not see; no grace period). Q6 Steps: up or down, PAID to PAID only (no free<->paid step). Q7 Up to 3 price steps per ticket. Q8 Group prices NOT in v1. Q9 Early buyers keep what they paid. Q10 Course refunds after session 1: organiser decides case by case via the existing refund screen (no automatic rule).
Consequences for the design (still not designed): v1 course = one ticket, kind=course, scans once per night (a2's Q47); no quantity price rule; the schedule is <=3 rows per ticket, effective_from timestamptz in Europe/London, paid > 0 in every row; removal/move allowed only before effective_from; buyer screen needs a "price changed, confirm" state (a2 notes prototype v4 lacks it).
Slices: S1 (walk + copy for pause + add) is unchanged and still goes first. Everything else waits on a widened contract and its independent review.

## 0c. W1 price steps after reviews r1 and r2 (2026-11-10; design: `design-ticketing-organisers.md` DRAFT 3)
Supersedes the W1 sketch above where they differ. Prod state (probe 2026-11-10): reserves v1-v4 all EXECUTE service_role; only v4 calls `_ticket_effective_unit_price_v1`; v1-v3, promo preview v1/v2 read `v_type.price_pence`; public v1/v2 and sales summary v1/v2 read the base. The deployed edge (v22, review r2) sends every live Website sale to reserve v3 (single body) and `lines` bodies to v4; v1/v2 have no caller.
- R-1 (F1, r2 N1) ONE seam: `_ticket_effective_unit_price_v1(p_type, p_occurrence_id)` (existing), wrapping `_ticket_effective_unit_price_at_v1(..., p_at)`. No second price function. PHASED retirement (design s.3a): T1 revokes ONLY the callerless reserve v1, v2, public v1, preview v1; T2 adds reserve v5 and an edge v5 path and KEEPS the v3 single and v4 `lines` paths; T4 moves the Website to the basket wire with `expected_unit_price_pence` per line and `expected_total_pence` (0 for free); T2b (last) ships the edge that refuses missing expected values with no v3/v4 path, then REVOKEs v3, v4 and public v2. The step writer refuses `reserve_not_ready` while any reserve v1-v4 is executable, so steps open only after T2b. G-1 proof: v5-only marker `ticket_orders.reserve_version = 5` (not `hold_expires_at`, not "has lines"), deployed-edge grep, deploy-order timestamps T4 < edge < migration, post-revoke `has_function_privilege` assertions run after the migration.
- R-2 (F2, F10) Every price reader calls the seam: promo preview v2 (v1 revoked), public list (price and sort; next step via `ticket_types_public_v3`; v2 patched then revoked in T2b), organiser read RPC `ticket_types_manage_v1`, and sales summary v1/v2 PATCHED to the seam in T1 (v1 has a live Website caller, `ticketsApi.ts:93`, so not revoked). Public v1 revoked. Strict static guard: no `.price_pence` token in any executable reserve/preview/public/summary function; canary RED on prod today.
- R-3 (F3, r2 N2/N5) Expected price is REQUIRED: per line `expected_unit_price_pence` and `p_expected_total_pence` (reserve v5, no default). Missing, null, a JSON string or a non-integer -> `expected_price_required` (type-checked before any cast, never a 500). Two checkpoints: per-line unit right after the seam, before the promo limiter, code lock and refusal row; order total after the fee, before the capacity write. Differs -> `price_changed` with the stale lines and `new_total_pence`, on every type. Fee is 0 on a zero net on both server and Website.
- R-4 (F5, DECIDED owner-delegated) Steps are ABSOLUTE date+time (Europe/London) per ticket type; on a per-night type a step applies to every night; editor copy "This new price applies to every night of this ticket from <date, time>". Relative-to-night: parked.
- R-5 (F6, F11) Invariant: base > 0 or no steps. Upsert refuses price 0 while steps exist (`has_price_steps`); step writer refuses a free base (`not_paid_ticket`) and an unchanged price (`same_price`). Free/paid step proposal above ("refuse") is now the rule.
- R-6 (F7, r2 N3) Exact GRANT/REVOKE/RLS/search_path lists and post-apply privilege assertions for T1 (incl. `ticket_types_manage_v1` and the outage guard: v3/v4 still executable), T2 (v5 service_role only; public v3 anon+authenticated; patched preview/public v2 keep their ACL) and T2b: design s.5.
- R-7 (F8) London-time editor; non-existent time refused when `isoToLondonInput(londonInputToIso(v)) !== v`; ambiguous time = the later (GMT) instant, stated under the field; "rises on <date>" built on the client in Europe/London; DB boundary test at `effective_from - 1us` and `= effective_from` via the `_at` wrapper.
- R-8 (F9, r2 N6) A payment at a pre-step price can complete at most ~32 min after its reserve (Stripe session life); the 15-min hold bounds capacity only. Late payment at the stored price is accepted (M-16, required). T2 names the `ticket-hold-sweep` scheduler or adds a pg_cron row.
Matrix rows M-1..M-19 (incl. M-8b) live in the design section 6 (one copy, not duplicated here).

## 1. Arc boundary
IN: organiser tier journeys on the Tickets screen; sequence opening (tier B opens when tier A sells out); buyer view of on-sale tiers; checkout refusal; door acceptance of tickets from paused/closed tiers.
OUT (owner): delete tier, edit price after sales, refunds, changing what existing buyers paid.
Unconfirmed: platform fee. `TICKET_BOOKING_FEE_PENCE` expected 0, NOT verified (no repo hit; secret values unreadable by MCP). `ticket_orders.booking_fee_pence` exists; check paid orders for the value.

## 2. Person types (rows)
| P | Who | Prod instances |
|---|---|---|
| P1 | Event owner, onboarding complete, Stripe connected | 1 connected Stripe account (earlier survey) |
| P2 | Event owner, Stripe NOT connected (paid tier cannot go on sale: `organiser_not_onboarded`) | 1 created, nothing submitted |
| P3 | Team member (manager/contributor): `_ticket_can_manage_organiser_v1` | not surveyed; seed |
| P4 | Interim seat / helper | 0 (table empty) |
| P5 | Buyer, signed in | seed |
| P6 | Buyer, anonymous (email only) | seed |
| P7 | Buyer holding the page open while a tier is paused or sells out | seed (race) |
| P8 | Existing buyer (paid ticket on a tier later paused) | 1 paused tier has 4 tickets |
| P9 | Door person (see door contract) | 0 door seats |
| P10 | Admin/support | n/a |

## 3. Production shape survey (read-only, prod stsdtacfauprzrdebmzg, 2026-11-09, counts only, no writes)
- Ticket types: 5 total. on_sale 3 (no tickets sold, all have a close time, none free, none per-date), paused 2 (one paid with 4 tickets, one free with a close time and 0 tickets). draft 0, sold_out 0, closed 0.
- Series with ticket types: 2; both have more than one type. Types with capacity 0: 0. Types with reserved_count > 0: 1. All 5 are whole-series (occurrence_id null): 0 per-date.
- Open sales windows: 0 with an open time; 4 with a close time.
- Orders by status: expired, paid, refunded only (3 earlier + expired rows). No other statuses.
- Note: the organiser contract surveyed "2 types, both paused" earlier today; 3 on_sale types now exist. Someone created them since. Re-survey at build time.
- NOT surveyable today (no data): sold-out types (0), sequence (no column), paused type with open reservation in flight (0 live).
Shapes needing SEEDED accounts: P3, P4, P5-P8, sold-out, per-date tiers, multi-date series with tiers, free-and-paid mix on one event, sequence chains of 2 and 3.

## 4. Verified facts
V-1 Status machine in `ticket_type_set_status_v1`: draft->on_sale|closed; on_sale->paused|sold_out|closed; paused->on_sale|closed; sold_out->on_sale|closed; closed terminal. Going on_sale requires onboarding complete, series live, not at capacity, and (if price>0) Stripe charges_enabled.
V-2 Setting sold_out manually sets `manual_sold_out=true`; reverse sets false.
V-3 `ticket_type_upsert_v1` auto-flips on_sale->sold_out when capacity falls to reserved_count, and sold_out->on_sale when not manual and room appears.
V-4 Price and occurrence cannot change when the type has any order (`has_orders`). Name, capacity, window can.
V-5 Public list `ticket_types_public_v1`: only on_sale/sold_out of LIVE series, ordered by price then name (NOT by sequence).
V-6 Refusal function covers: status not on_sale, outside sales window, over capacity.
V-7 (2026-11-10 NOTE: prod now has reserve v1-v4 after #1523; review r2 read the deployed edge v22: single body -> v3, `lines` body -> v4, v1/v2 no caller; the text below describes the pre-#1523 edge. See 0c R-1.) (REVIEW FINDING 1, RESOLVED by reading prod pg_proc bodies 2026-11-09, SELECT only). The edge fn (admin repo `supabase/functions/ticket-checkout/index.ts`, `_shared/ticketingHandlers.ts:229-244`) calls `ticket_checkout_reserve_v1` with no promo code and `_v2` with one. BOTH take `FOR UPDATE` on the ticket type row, and BOTH refuse a type that is not on_sale (reasons sold_out / not_on_sale), outside the sales window (outside_sales_window), or over capacity (sold_out + remaining). v1 does it INLINE with the same three checks, v2 via `_ticket_checkout_sale_refusal_v1`. So a stale-page buyer with no code IS stopped on prod today; there is NO paused-price-still-sellable gap and NO S0 money fix. Residual risk (hygiene, not blocking): the rules are written twice; a later change to one can drift from the other. Proposed S2 task: v1 calls the refusal fn too (careful lane, owner Approve because money surface), plus a parity test over every status x window x capacity cell.
   DECISION (round-2 finding 3): S2 does NOT retire v1 and v1 does NOT delegate to v2. v2 requires `p_email_hash` / `p_ip_hash` and runs a promo-refusal rate limiter that v1 has no path for, so delegation changes the edge function and rate-limit behaviour and is not trivial. S2 instead calls `_ticket_chain_open_next_v1` from BOTH reserves. Retiring v1 is OPEN-6.
V-8 Where the code lives: Website `src/modules/organiser/tickets/{ticketModel,ticketsApi}.ts`, `src/modules/tickets/{TicketsBlock,ticketCheckoutApi,ticketCheckoutModel}.ts`; DB functions above live in prod; migrations in admin repo `bachata-admin-11april/supabase/migrations`; edge function source is in the ADMIN repo (`supabase/functions/ticket-checkout/index.ts`, per the review).
V-11 Where a type becomes sold_out: INSIDE both reserve fns, in the same UPDATE that bumps `reserved_count` (`status = CASE WHEN reserved_count + qty >= capacity THEN 'sold_out'`). Reserves reserve capacity for PENDING orders too (before payment), so "sold out" means reserved, not paid. Capacity returns via `_ticket_release_capacity_v1` (no row lock of its own; flips sold_out -> on_sale unless `manual_sold_out`) and the unpaid-order sweep. "By capacity" therefore = status set by a reserve (or release), `manual_sold_out=false`; "manual" = `ticket_type_set_status_v1('sold_out')`, which sets `manual_sold_out=true`. The upsert auto-flip (V-3) is also "by capacity" (lowering capacity to reserved_count).
V-14 (round-2 finding 1) THREE writers set sold_out by capacity, not two: (a) both reserves, (b) the upsert auto-flip, (c) `_ticket_retake_capacity_v1` (prod body read): adds p_quantity to reserved_count and sets on_sale -> sold_out when reserved_count + qty >= capacity; it RETURNS true if reserved_count now EXCEEDS capacity (overshoot). Callers (VERIFIED by prod `prosrc` search 2026-11-09): retake is called ONLY by `ticket_order_mark_paid_v1` (late payment after the order was closed). Release is called by `ticket_order_close_unpaid_v1` (expiry), `_mark_refunded_v1`, `_charge_refunded_v1`, `_mark_disputed_v1` and `_dispute_closed_v1`. So a won dispute and a dispute opening both RELEASE capacity (not retake); the earlier reviewer note that a won dispute retakes is not what prod does. Journey J19 therefore covers late payment only; add dispute opened / dispute closed to J20 (release). All three call `_ticket_chain_open_next_v1`.
V-15 (round-2 finding 2) Capacity returns via `_ticket_release_capacity_v1` (sold_out -> on_sale unless `manual_sold_out`). Callers: `ticket_order_close_unpaid_v1` (expiry/cancel), `ticket_order_mark_refunded_v1`, `ticket_order_charge_refunded_v1`, `ticket_order_dispute_closed_v1`. Also the manual path `ticket_type_set_status_v1` sold_out -> on_sale. These can re-open a type whose successor is already open, so rule 3 must be ENFORCED by named S2 changes (section 5), not assumed.
V-12 Refusal copy: three separate reasons reach the buyer: `sold_out` (with `remaining`), `not_on_sale` (paused/draft/closed, with `status`), `outside_sales_window` (before open or after close). The buyer screen must say a different thing for each (see J9). Not verified what `ticketCheckoutModel.ts` says today.
V-13 Door: `_ticket_check_in_core_v1` filters only on ticket `valid`, not checked in, order `paid`, series and organiser match. It does NOT look at the ticket TYPE status, so tickets from a paused/closed/sold-out tier scan fine (J16 verified, also `ticket_door_list_v1` per review). A 'void' ticket or a non-paid order is `not_valid`.
V-9 Writes are gated by `scripts/onboarding-write-doors.json` guard-list; a new writer RPC means a guard-list edit.
V-10 Where capacity is released: `_ticket_release_capacity_v1` (no row lock in its body per my check; called by sweep/cancel paths). NOT verified how it interacts with sold_out status.

## 5. Sequence-opening design (decide now, build later)
Add to `ticket_types`: `opens_after_ticket_type_id uuid null references ticket_types(id)` (successor points at its predecessor), plus a rule that both are in the SAME event_series and occurrence scope, no cycles, chain depth <= 5, one successor per predecessor (a line, not a tree).
Behaviour (all inside the DB):
1. A successor is created as `draft` (never shown publicly; not in V-5 list).
2. When the predecessor reaches `sold_out` BY CAPACITY (V-11: set by a reserve, `manual_sold_out=false`, not paused/closed), the successor flips draft->on_sale. Mechanism (review finding 3): ONE new internal function `_ticket_chain_open_next_v1(p_type_id)` (SECURITY DEFINER, not callable by clients, no ACL to anon/authenticated), NOT a bypass inside `ticket_type_set_status_v1`. It must be called from BOTH `ticket_checkout_reserve_v1` and `_v2` (and the upsert auto-flip), in the same transaction as the UPDATE that sets sold_out, or v1 must first be retired by routing everything through v2 (v1 has no promo path; simplest is v1 delegating to v2 with a null code). The function takes the successor's row lock AFTER the predecessor's (lock order: predecessor, then successor; never the reverse) and re-checks the successor is still `draft`.
   Callers of the chain function (V-14): both reserves, `_ticket_retake_capacity_v1`, AND the `ticket_type_upsert_v1` auto-flip on_sale -> sold_out (round-2 finding 4: that path also bypasses `ticket_type_set_status_v1`, so it gets the same system-flip checks below).
   The system flip does NOT go through the user gates of `ticket_type_set_status_v1` (onboarding, Stripe, series live, capacity). It re-checks series live and, for a paid successor, Stripe `charges_enabled` at flip time; if that check fails the successor stays draft and the predecessor shows "sold out" with no error to the buyer (OPEN-5: tell the organiser by a to-do).
3. If capacity frees later (unpaid order expiry, refund, dispute won) the predecessor is NOT re-opened if its successor already opened. Buyers never see two sequential tiers both on sale unless the organiser chose that. ENFORCED BY NAMED S2 CHANGES (V-15): (i) `_ticket_release_capacity_v1` keeps the predecessor `sold_out` (does not flip to on_sale) when its successor is not `draft`; (ii) `ticket_type_set_status_v1` refuses sold_out -> on_sale on such a predecessor with reason `successor_open`; (iii) `ticket_type_upsert_v1` capacity-raise flip sold_out -> on_sale gets the same check. Fallback if the reviewer prefers: drop rule 3 and allow both on sale (OPEN-3). Overshoot from `_ticket_retake_capacity_v1` (returns true) must not flip anything backwards.
4. Pausing or closing the predecessor does NOT open the successor. Manual sold-out does NOT open it (open question OPEN-2).
5. Public order: chain order, then price. Organiser list shows the chain as 1 -> 2 -> 3 with "opens when previous sells out".
6. No chain edits once the predecessor has sold out (v1); changing a chain with open reservations is refused.
Alternatives rejected: a `sequence_rank` integer (cannot express "opens on sell-out" vs "ordered display"); a cron job (late by minutes, buyers hit sold out dead-end).

## 6. Acceptance matrix (R = required, N/A = not applicable). Status column: V = verified in code or prod today, NV = not verified.
Columns: P1 owner connected, P2 owner not connected, P3 team, P5/P6 buyer, P7 stale-page buyer, P8 existing buyer, P9 door.

| # | Journey | P1 | P2 | P3 | P5/6 | P7 | P8 | P9 | Status |
|---|---|---|---|---|---|---|---|---|---|
| J1 | Add first price (free) | R | R | R | N/A | N/A | N/A | N/A | V (upsert) / NV (phone walk) |
| J2 | Add first price (paid) | R | R: refused with a reason that says what to do (connect Stripe) | R | N/A | N/A | N/A | N/A | V rule / NV copy |
| J3 | Pause a price with no sales | R | R | R | N/A | N/A | N/A | N/A | V (set_status) / NV walk |
| J4 | Pause a price WITH sales | R | R | R | N/A | N/A | R: keeps ticket, same price | R: still scans | V rule / NV walk |
| J5 | Add replacement price after pause (change price route) | R | R | R | N/A | N/A | N/A | N/A | V rule; NV that the screen explains it |
| J6 | Try to edit price of a type with sales | R: refused, copy says "pause and add a new price" | R | R | N/A | N/A | N/A | N/A | V (`has_orders`) / NV copy |
| J7 | Re-open a paused price | R | R | R | N/A | N/A | N/A | N/A | V |
| J8 | Buyer sees only on-sale (and sold-out) prices | N/A | N/A | N/A | R | R | N/A | N/A | V (public fn) |
| J9 | Checkout refuses a price paused / sold out / outside window after the page loaded, WITH and WITHOUT a promo code (separate copy per reason, V-12) | N/A | N/A | N/A | R: friendly message and fresh list | R | N/A | N/A | V DB (v1 and v2 both refuse, V-7) / NV UI copy |
| J9b | Promo code on a tier: valid / unknown / expired / inactive / used up / no discount / below minimum, on an on-sale tier | N/A | N/A | R (creates codes) | R | R | N/A | N/A | V DB (reasons in v2) / NV UI |
| J9c | Promo code on a PAUSED, sold-out, or out-of-window tier (the status refusal wins over the code reasons) | N/A | N/A | N/A | R | R | N/A | N/A | V DB order (refusal runs before code, v2) / NV UI |
| J9d | Free tier + code; free B after paid A; paid B after free A; code on a chain tier (B draft: code resolves to not_on_sale; after B opens it works) | R | N/A | R | R | N/A | N/A | N/A | NV |
| J10 | Organiser sees paused prices in own list | R | R | R | N/A | N/A | N/A | N/A | V (organiser list reads all) / NV label |
| J11 | Create chain A -> B (sequence) | R | N/A | R | N/A | N/A | N/A | N/A | NEW |
| J12 | A sells out, B opens, buyer sees B | N/A | N/A | N/A | R | R | N/A | N/A | NEW |
| J13 | A pauses or closes: B does NOT open | R | N/A | R | R | N/A | N/A | N/A | NEW |
| J14 | Two buyers race for the last place of A | N/A | N/A | N/A | R: one wins, other sees B or sold-out | R | N/A | N/A | NEW (row lock proven for reserve_v2, NV for chain flip) |
| J15 | Capacity frees after B opened (expired order / refund) | R | N/A | N/A | N/A | N/A | N/A | N/A | NEW, rule 3 above |
| J16 | Door scans ticket from paused/closed/sold-out tier | N/A | N/A | N/A | N/A | N/A | R | R | V DB (V-13: `_ticket_check_in_core_v1` ignores type status; door list per review). Door RPCs: `ticket_check_in_by_id_v1`, `ticket_check_in_by_code_v1`, `ticket_check_in_v1` |
| J17 | Sales window: not yet open / closed by time (all 3 on_sale prod types have a close time) | R | N/A | R | R: "Sales open on ..." / "Sales have closed" | R | N/A | N/A | V DB (outside_sales_window) / NV copy and organiser display |
| J19 | Late payment or won dispute re-takes a place (`_ticket_retake_capacity_v1`) and fills A while B is draft or already open | N/A | N/A | N/A | R | R | R | N/A | NEW: B opens if still draft; no flip backwards if B is open; overshoot (reserved > capacity) shown honestly to the organiser |
| J20 | Capacity frees on A after B opened (expiry, refund, dispute won, manual sold_out -> on_sale attempt) | R | N/A | R | R | N/A | N/A | N/A | NEW: A stays sold_out; manual attempt refused `successor_open` (V-15) |
| J18 | Window x chain: A closes by time before it sells out; B has its own window; B window already past when it would open | R | N/A | R | R | N/A | N/A | N/A | NEW: B does not open on A's time close (rule 4); B opening outside its window stays on_sale but refuses as outside_sales_window |

Data-shape cells (every journey above is walked on each where it applies):
| Shape | Notes | Prod |
|---|---|---|
| 0 types / 1 / many on one event | empty state says what to do | 0 and many seen, 1 seed |
| free / paid / both on one event | | free paused 1, paid 4 |
| with sales / without | | 1 with, 4 without |
| paused with sales | J4 | 1 |
| sold-out | J12-J14 | 0, seed |
| per-date tier on a multi-date series | | 0, seed |
| series ended / cancelled / not live | ticket flips refused: `series_not_live`; public list hides all tiers of a non-live series (V-5) | NV prod count |
| sales window shapes: none / open only / close only / both / not yet open / closed | | close-only 4 of 5 (most common), open 0, both 0 |
| whole-series tier vs per-date tier on one series; per-date tier on a cancelled date | | whole-series 5, per-date 0 |
| free B after paid A, paid B after free A | | 0, seed |
| chain of 2, chain of 3, broken chain (predecessor closed) | | 0, seed |
| name length / price edge (0, 1000000) / capacity 0 | | 0 of capacity 0 |

NOTE (review finding 6): P3 team member and P4 interim seat rows have no prod instances, so every SCREEN cell for them is NV (not V) until walked on a seeded account. The DB permission `_ticket_can_manage_organiser_v1` is read from code but its exact role set for contributor/interim is NV.

## 7. Required checks (Definition of done)
- Table-driven test: every status x every journey x one shared mapping (`switchMove` / `NEXT` already exist; extend, do not copy).
- No copy pointing at a missing control: "pause and add a new price" copy must be next to a control that does it.
- Empty states say what the person can do. Disabled controls say why (e.g. at_capacity, organiser_not_onboarded).
- Walk at 390x844 on seeded accounts for P2, P3, P5-P8 and prod-shaped for P1.
- Stale-page buyer test: load public page, pause tier, press buy.
- DB: replay proof, read-before/show-after, independent review (money surface, careful lane). Guard-list `onboarding-write-doors.json` edit for any new writer.

## 8. Slices (proposed)
- S1 (small, maybe docs/walk only): walk the EXISTING pause + add on a phone with prod-shaped data. If the screen already explains "pause the old price, add a new one" and refuses price edits with that copy, S1 is just copy/empty-state fixes and a one-paragraph note for Anna. This could be done this week.
- S2: DB column + chain rules + system open-on-sell-out (careful lane, migration).
- S3: organiser chain UI (create, show 1 -> 2 -> 3).
- S4: buyer side ordering + sold-out hand-off message.

## 9. Open questions (product: owner)
OPEN-1 "By capacity" is defined in V-11. A sells out because the organiser LOWERS capacity (upsert auto-flip) is by capacity: should B open? Proposed: yes, same as a sell-out. Reserves count PENDING (unpaid) orders, so B can open while A has unpaid orders that later expire and free places (rule 3: A then stays closed to buyers; OPEN-3).
OPEN-6 CLOSED 2026-11-10 by section 0c R-1: reserve v1/v2 are retired in T1 (no caller); v3/v4 are retired in T2b only after the edge and the Website are proven on v5 (design s.3a). Not in S2.
OPEN-5 If the system flip fails (Stripe off, series not live), B stays draft: how does the organiser find out? Proposed: a Home to-do.
OPEN-2 Manual "Mark sold out" on A: open B or not? Proposed: not (organiser chose to stop).
OPEN-3 If A's tickets come back on sale after B opened (rule 3): proposed A stays closed to buyers.
OPEN-4 Should Anna's real event be the first test, and is Anna's event ticketed through Stripe at all (only 2 series have tiers; I have not identified hers)?

## 10. Not verified
Phone walk of any screen; client copy for the three refusal reasons (V-12); the exact role set of `_ticket_can_manage_organiser_v1` for contributor/interim; fee secret (the v2 comment says the owner's fee is 0 since 2026-10-29; the edge function passes the per-ticket fee, so check `ticket_orders.booking_fee_pence` on paid rows); Anna's event; the admin-repo copy of the function bodies on origin/main (I read PROD pg_proc only, not the admin migration files); seeded-account walks.
Verified in admin repo `origin/main` (fetched 3ec4cdda, 2026-11-09): migrations that define `_ticket_retake_capacity_v1`, `_ticket_release_capacity_v1`, `ticket_checkout_reserve_v1`/`_v2`, `_ticket_checkout_sale_refusal_v1`, `ticket_type_set_status_v1`: `20270302020000_ticketing_p1_schema_v1`, `20270304170000_ticketing_p2_hardening_v1`, `20270308190000_ticket_onboarding_gate_v1`, `20270314170000_ticket_promo_codes_v1`. Still NOT verified: that the LAST definition of each in main equals the prod body (md5 compare not done); the admin working copy at C:\dev\bachata-admin-11april is stale (Oct 12), so I used origin/main only. The earlier "no tier model in admin modules" search was on that stale copy and should be disregarded.
Verified by reading prod pg_proc (SELECT only): v1 and v2 reserve bodies, `_ticket_retake_capacity_v1`, `_ticket_release_capacity_v1`, `_ticket_check_in_core_v1`, `_ticket_checkout_sale_refusal_v1`, set_status, upsert, public list.


INVENTORY.md first, coverage count last (see the review brief).
