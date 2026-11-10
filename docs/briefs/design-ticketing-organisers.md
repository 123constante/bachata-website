# DESIGN: ticketing for organisers (scheduled price rise, whole-course sale, early-bird, promo codes)

Written 2026-11-09 by website-72. Status: DRAFT 2 (2026-11-10, review r1 fixes F1-F11 applied by the revise worker; see `docs/review/ticketing-design-fixes-r1.md`). Docs only, NOTHING dispatched or claimed on PROGRAM.md. Needs review r2 before any T-brief is written.
Inputs: CONTRACT-ticket-tiers.md (section 0b = owner answers Q1-Q10), website-a2's buyer-screen arc: S1a/S1b HAVE LANDED (#1523): prod has `ticket_checkout_reserve_v1..v4`, `ticket_types_public_v2`, `ticket_promo_preview_v2`, `ticket_order_lines` and the seam `_ticket_effective_unit_price_v1(p_type, p_occurrence_id)`.
Source of the "ownership" and priority: a peer message from the lead (website-8e), relaying an owner click. Treat ownership as the lead's statement until the owner confirms.

## 1. Owner decisions this design obeys (do not reopen)
Course = WHOLE COURSE ONLY, one ticket, scans once per night (a2). Rise = date+time UK, removable/movable until it happens, public text "price rises on <date>", stale page = show new price and ask to confirm, paid-to-paid only (up or down), max 3 steps, early buyers keep what they paid, group prices NOT in v1, course refunds case by case via the existing refund screen. Early-bird = the same thing as a price step (no separate feature).
F5 DECIDED (owner-delegated, 2026-11-10): a step is an ABSOLUTE date and time (Europe/London) per ticket TYPE. On a per-night type (every prod type today) one step applies to every night sold from that type at once: after the step every night costs the new price. The editor says so in plain words: "This new price applies to every night of this ticket from <date, time>." Relative-to-each-night steps ("N days before the night") are PARKED (not in v1; a later `ticket_price_steps.relative_days` column could add them without changing the seam signature).

## 2. Design: one concept, "price steps"
A ticket type keeps `price_pence` as its BASE price. Add a schedule of later steps:
`ticket_price_steps(id, ticket_type_id, effective_from timestamptz, price_pence int, created_by, created_at)`, at most 3 rows per type, `price_pence > 0`, unique (ticket_type_id, effective_from), `effective_from > now()` when written. EFFECTIVE price at instant t = the price of the latest step with `effective_from <= t`, else the base price. Early-bird, "last-minute" and a rise are all just steps. (Alternative rejected: editing `price_pence` by cron: late, not auditable, races with reserves.)
Orders store `unit_price_pence` per order LINE (`ticket_order_lines`, S1b), so buyers keep what they paid (Q9). The rule that blocks editing the base once orders exist stays; steps are the sanctioned way to change price after sales.

### 2a. ONE seam (F1, F2)
- NO new `_ticket_effective_price_v1`. The step lookup goes INSIDE the existing `_ticket_effective_unit_price_v1(p_type ticket_types, p_occurrence_id uuid)` (signature unchanged), which becomes `RETURN _ticket_effective_unit_price_at_v1(p_type, p_occurrence_id, now())`.
- `_ticket_effective_unit_price_at_v1(p_type, p_occurrence_id, p_at timestamptz) returns int`: STABLE, not definer, `SET search_path = pg_catalog, public`: `coalesce((SELECT s.price_pence FROM ticket_price_steps s WHERE s.ticket_type_id = p_type.id AND s.effective_from <= p_at ORDER BY s.effective_from DESC LIMIT 1), p_type.price_pence)`. `p_occurrence_id` is accepted and ignored in v1 (absolute steps, F5). The `_at` form exists ONLY so tests can pin the instant (F8); no production caller passes anything but `now()`.
- Every price reader calls the seam. Exhaustive list (prod probe 2026-11-10): reserve v4 (already does); promo preview v1 and v2 (`v_unit := _ticket_effective_unit_price_v1(v_type, p_occurrence_id)`; v1 passes NULL); public v2 (returned price AND the ORDER BY key); sales summary v2 "current price" column if it shows one; the new organiser read RPC (s.3c). Reserve v1-v3 and public v1 are RETIRED, not patched (s.3a).
- Static guard (T1, a new `scripts/check-*.mjs` contract check, read-only prod `prosrc` search): no function that INSERTs into `ticket_orders` or `ticket_order_lines`, and no `ticket_promo_preview_v*` / `ticket_types_public_v*` that is EXECUTE-able by service_role, anon or authenticated, may contain `v_type.price_pence` or `t.price_pence` outside a call to the seam. (Function bodies live in the admin repo, so this guard belongs there; a website mirror only if the six script conventions in `docs/ci-guard-notes.md` allow a prod read.)

### 2b. Base price, free tickets and the paid invariant (F6, F11)
INVARIANT (write it in the T1 migration comment): for every type, `price_pence > 0` OR no step exists; and every step `price_pence > 0`. So "base > 0 iff every effective price > 0". Every free-ness check that reads the base (v1 free gate, `set_status` Stripe gate, `ticketSymbol`, `buyLabel`, `moveBlock`, `TicketsBlock` `promoOn`) stays right only while this holds; they are NOT changed.
Enforced by:
- `ticket_type_upsert_v1` (T1 edits it, same version, same signature): refuses `price_pence = 0` while any step exists, reason `has_price_steps`. Base edits while steps exist and no orders: allowed when > 0.
- Step writer refuses a free base: `not_paid_ticket`. Refuses a step price equal to the base or to the step immediately before it (same effective price, nothing changes): `same_price`.
- Website (T3): the price field on a type with steps says why 0 is not allowed ("Remove the price changes first; a ticket with price changes cannot be free.").

### 2c. Time (F8)
- Storage `timestamptz`; DB `TimeZone` is UTC, so NO SQL ever turns a step into a date or text. The server returns `next_price_at` as timestamptz; "price rises on <date>" is built ON THE CLIENT with `Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', ... })`. A drop says "price changes on <date>" (OPEN-D6).
- Editor input is London wall-clock (`datetime-local`), converted with the existing `londonInputToIso` (`ticketModel.ts:360-369`). That helper does NOT refuse a non-existent time (`2027-03-28T01:30` -> 02:30 BST). New rule, client AND reason copy: refuse when `isoToLondonInput(londonInputToIso(v)) !== v`, reason `time_does_not_exist` ("This time does not exist in the UK, the clocks go forward. Pick another time."). AMBIGUOUS time (`2026-10-25T01:30` occurs twice): accepted and resolved to the LATER instant (GMT, `01:30Z`); the editor shows "01:30 GMT (after the clocks go back)" under the field. The server still checks only `effective_from > now()` on the instant.
- Server time only: every comparison uses `now()` (transaction start) in the writer and the reserve; the client never decides whether a step is live (OPEN-D3).
- Boundary: live when `effective_from <= now()`; movable/removable when `effective_from > now()`. At the exact instant the step is live AND frozen; no gap, no overlap. A reserve whose transaction started before the instant charges the old price, which is the price the buyer saw.

### 2d. Organiser actions
Add step (date+time picker in UK time, price), move step, remove step, only while `effective_from > now()` (for a move: the OLD and the NEW time); at most 3; each later than the previous. Reasons: `step_in_past`, `too_many_steps`, `not_paid_ticket`, `out_of_order`, `same_price`, `time_does_not_exist` (client), `reserve_not_ready` (s.3a).

## 3. Checkout behaviour (shared with a2)
### 3a. Retiring reserve v1-v3 and public v1 (F1, G-1)
Prod has FOUR service_role reserves; only v4 uses the seam. v1-v3 are not patched; they lose EXECUTE.
- T2 PRE-CONDITION (G-1, must be shown in the T2 PR, not assumed): the deployed `ticket-checkout` edge function calls `ticket_checkout_reserve_v4` and nothing older. Verified by ALL of: (1) admin repo `origin/main` `supabase/functions/ticket-checkout/` and `_shared/` contain no `ticket_checkout_reserve_v1|v2|v3` string (grep output pasted); (2) the deployed version equals that source (Supabase `get_edge_function` body or deploy SHA matches the admin commit); (3) after one test purchase on a seeded series, the new order row has `hold_expires_at IS NOT NULL` (only v4 sets it) and has lines in `ticket_order_lines`. `pg_stat_user_functions` cannot be used: function tracking is off on prod (probe 2026-11-10, every count 0).
- Retirement step, in the SAME migration as the step table (T1), or the step writer refuses: `REVOKE EXECUTE ON FUNCTION ticket_checkout_reserve_v1(...), _v2(...), _v3(...) FROM service_role, PUBLIC, anon, authenticated` (full identity args, as probed). Independently of that, `ticket_price_step_set_v1` refuses with `reserve_not_ready` while `EXISTS (SELECT 1 FROM pg_proc WHERE proname ~ '^ticket_checkout_reserve_v[1-4]$' AND has_function_privilege('service_role', oid, 'EXECUTE'))`: v4 prices through the seam but has no expected-price check (F3), so NO step can be written until v5 (T2) is the only executable reserve. T1 may land first; it is inert until T2. Rollback of the edge to an older reserve then FAILS (permission denied) instead of charging the base.
- `ticket_types_public_v1` (Website no longer calls it, `ticketCheckoutApi.ts:48`): revoke EXECUTE from anon/authenticated in the same migration, or make it call the seam. Recommended: revoke.
- Contract OPEN-6 is CLOSED by this step (retire, not delegate).

### 3b. `price_changed` (F3)
- Request: each `p_lines` element gains `expected_unit_price_pence` (int). The order-level expected total cannot ride in `p_lines` without inventing a fake element, so DECISION: `ticket_checkout_reserve_v5(<v4 args>, p_expected_total_pence int)` with NO default (a missing argument is a call error, not a silent skip). v4 is revoked from service_role once the edge is proven on v5 (same G-1 method as s.3a). Until then v4 must not be reachable with steps live: the `reserve_not_ready` gate (s.3a) counts v4 too once v5 exists.
- Missing expected price FAILS CLOSED: if any line lacks `expected_unit_price_pence` (absent, null, non-integer), or `p_expected_total_pence` is null, the reserve refuses `expected_price_required` and creates nothing, on EVERY type (stepped or not), so the rule cannot silently stop applying when a step is added later.
- Compare: per line, `expected_unit_price_pence = seam(type, night)`; for the order, `p_expected_total_pence = sum(unit x qty) - discount + fee` as v5 computes it (covers promo, rounding and fee drift, F4).
- Placement in v5: AFTER the existing refusals (night, status, window, capacity check) and BEFORE the capacity UPDATE, before any `ticket_promo_checkout_refusals` row is written, and before the order insert. So a `price_changed` takes no place, writes no row and does not count toward the promo limiter.
- Reply (same shape as v4's other refusals): `{ok:false, reason:'price_changed', lines:[{line:<index>, ticket_type_id, new_unit_price_pence}], new_total_pence}`; only stale lines are listed; `new_total_pence` is always present. `expected_price_required` has no extra fields.
- Edge contract (admin repo, T2): pass `expected_unit_price_pence` per line and `p_expected_total_pence` from the request body; reply `price_changed` to the client unchanged. Edge refuses a request without them with `expected_price_required` before calling the DB.
- Client contract (Website T4): `CheckoutBody` gains `expected_unit_price_pence` per line and `expected_total_pence` (the total the pay button shows). `REASON_COPY` gains `price_changed` ("The price changed while this page was open. New total: <total>. Check and pay again.") which re-renders the basket with the new prices and a confirm button; confirming resends with the NEW expected values. `expected_price_required` copy: "Please reload the page and try again." No grace period (Q5).

### 3c. Every public and organiser price read (F2, F10)
- `ticket_types_public_v2`: `price_pence` = seam(type, p_occurrence_id); adds `next_price_pence`, `next_price_at` (the first step with `effective_from > now()`), both NULL when none; ORDER BY the effective price (then name). Same function version if the return type change is additive is NOT possible in Postgres (RETURNS TABLE change = drop/create), so this is `ticket_types_public_v3`; v2 then calls the seam for its price and sort too, until the Website moves to v3 and v2 is revoked.
- Promo preview v1/v2: unit from the seam (s.2a). Preview v1 is anon-callable today; revoke it if the Website does not call it (to check in T2 by grep), else patch.
- Organiser list: a new `ticket_types_manage_v1(p_event_series_id)` RPC (can-manage check) returns base, current effective price, the steps, `has_orders`, `has_price_steps`; T3 reads it instead of the direct `ticket_types` select (`ticketsApi.ts:113-119`).
- Sales summary: the existing per-line prices stay (paid amounts); a "current price" column, if shown, uses the seam.

### 3d. Promo codes, rounding, fee (F4)
Discount is computed on the effective unit by the shared `_ticket_promo_unit_discount_v1` (floor), in preview and reserve alike, so equal unit means equal discount. A fixed code larger than a lowered step clamps to the unit and can make a line free; `below_minimum` (30p) can then appear after a step DOWN for a buyer whose preview passed; that buyer gets `price_changed` first (total differs), then sees the refusal on confirm. Fee: page fee is a Website constant, server fee an env secret; a mismatch now fails as `price_changed` via `expected_total_pence` instead of charging an unseen amount. OPEN-D1 proposal stands (code applies as written to whatever price is effective).

### 3e. Stripe
Edge `buildCheckoutSessionParams` builds Checkout line items from the order lines' `unit_price_pence` / `discount_pence`, never from the ticket type (taken from the 2026-11-09 read for the single-type order; RE-VERIFY against the v4/v5 per-line edge code as part of the T2 G-1 proof). So steps need no Stripe change as long as the reserve writes the effective price into each line.

### 3f. Locks
v4/v5 lock types by id, then night counts, then the promo code row. The seam reads steps without locking. Step writers take ONLY the type row lock (`SELECT ... FROM ticket_types WHERE id = $1 FOR UPDATE`) first, so a step edit and a reserve on the same type serialize and no new deadlock cycle appears.

## 4. Whole-course sale
Decided in a2's arc (`ticket_types.kind=course`, `valid_from/valid_to`, `ticket_night_check_ins`). This design adds only: a course ticket is a normal type with `kind=course` and can have price steps (absolute steps fit courses naturally); organiser create flow asks "one night or a whole course"; public page shows the course dates. Refunds: existing screen, organiser decides (Q10).

## 5. Slices (each its own branch/PR; careful lane because money; owner Approve for T1, T2)
- T1 DB (admin repo): `ticket_price_steps`, the `_at` seam and the seam body change, `ticket_price_step_set_v1` / `_remove_v1`, upsert `has_price_steps` refusal, retirement of reserve v1-v3 and public v1, the `reserve_not_ready` gate (v1-v4), guard-list edit `scripts/onboarding-write-doors.json`, static `price_pence` guard. EXACT privilege list (F7), all in the migration:
  - `ALTER TABLE public.ticket_price_steps ENABLE ROW LEVEL SECURITY;` no policy.
  - `REVOKE ALL ON TABLE public.ticket_price_steps FROM PUBLIC, anon, authenticated;` `GRANT SELECT ON TABLE public.ticket_price_steps TO service_role;` (matches `ticket_order_lines`). No INSERT/UPDATE/DELETE to any role but the owner. Organisers read through `ticket_types_manage_v1`.
  - `_ticket_effective_unit_price_v1`, `_ticket_effective_unit_price_at_v1`: `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated, service_role;` (owner only; every caller is a postgres-owned definer). Function COMMENT: "not security definer on purpose: a non-definer caller fails closed (permission denied on ticket_price_steps)". `SET search_path = pg_catalog, public`.
  - `ticket_price_step_set_v1(p_ticket_type_id uuid, p_step_id uuid, p_effective_from timestamptz, p_price_pence int)`, `ticket_price_step_remove_v1(p_step_id uuid)`, `ticket_types_manage_v1(uuid)`: `SECURITY DEFINER SET search_path = pg_catalog, public`; `REVOKE EXECUTE ... FROM PUBLIC, anon;` `GRANT EXECUTE ... TO authenticated;`. Body order: type row `FOR UPDATE` first, then `_ticket_can_manage_organiser_v1`, onboarding gate, `reserve_not_ready` gate, old and new `effective_from > now()`, count <= 3, strictly increasing, price > 0, base > 0, `same_price`.
  - Reserve v1-v3 (and v4 once v5 is live): `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated, service_role`.
  - POST-APPLY ASSERTIONS (run as a SELECT in the PR, all must be false/true as shown): `has_table_privilege('anon','public.ticket_price_steps','SELECT')` = false; same for authenticated SELECT/INSERT/UPDATE/DELETE = false; `has_table_privilege('service_role','public.ticket_price_steps','INSERT')` = false; `relrowsecurity` = true; `has_function_privilege('anon', 'public.ticket_price_step_set_v1(uuid,uuid,timestamptz,integer)', 'EXECUTE')` = false and `('authenticated', ...)` = true; same pair for `_remove_v1`; `has_function_privilege(r, '_ticket_effective_unit_price_at_v1(...)', 'EXECUTE')` = false for anon, authenticated, service_role; `has_function_privilege('service_role', oid, 'EXECUTE')` = false for every `ticket_checkout_reserve_v[1-3]`; `proconfig` of each new function contains `search_path=pg_catalog, public`.
- T2 DB + edge (admin repo): v5 with `price_changed` / `expected_price_required` (s.3b), `ticket_types_public_v3`, preview patch, G-1 proof (s.3a) as a pre-condition. Owner Approve (money).
- T3 Website organiser: price-steps editor (add/move/remove, London time with the DST rules of s.2c, 3 max, copy "This new price applies to every night of this ticket from <date, time>", empty state says what to do, disabled controls say why), reads `ticket_types_manage_v1`. Normal lane after T1.
- T4 Website buyer: "price rises on <date>" built on the client in Europe/London, `CheckoutBody` expected fields, `price_changed` confirm state. a2 owns the screens; contract rows below.
- T5 Course create flow + early-bird presets.
- S1 (unchanged, first): phone walk + copy for existing pause + add.
Each slice: shape survey (counts), table-driven test, walk at 390x844 on seeded accounts, Verified / Not verified block.

## 6. Contract rows (matrix additions; each a table-driven DB or vitest row)
| # | Row | Expected |
|---|---|---|
| M-1 | Stepped type 1500 -> 2000 at T; at T-1us, T, T+1us via `_at` (DB) | 1500, 2000, 2000 |
| M-2 | Parity at T-1s, T, T+1s, no code / 10% code / fixed code | `public_v3.price = preview_v2.unit = v5 line unit`; `preview total + fee = v5 order total` |
| M-3 | Every `ticket_checkout_reserve_v%` with service_role EXECUTE reserves a stepped type | `line.unit_price_pence = seam(type, night)`; after T1 only v4/v5 remain executable |
| M-4 | Public v3 sort after a step | ordered by effective price |
| M-5 | v5 with `expected_unit_price_pence` omitted, stepped and unstepped type | `expected_price_required`; no order, no `reserved_count` / `ticket_night_counts` change, no promo refusal row |
| M-6 | Two lines, only line 2 stale | `price_changed`, `lines` names line 2 only |
| M-7 | Stale page with a code that is also over its limit | `price_changed` wins, no limiter row |
| M-8 | Fee constant on page differs from server fee | `price_changed` via total |
| M-9 | Step DOWN with a fixed code larger than the new unit | `price_changed`, then `below_minimum` or a free line on confirm |
| M-10 | Per-night type, step at T, buy at T+1h for night N1 (T+7d) and N2 (T+60d) | both the new price (F5 decided) |
| M-11 | Upsert price 0 on a type with a step | `has_price_steps` |
| M-12 | Step on a free base / step equal to base or previous | `not_paid_ticket` / `same_price` |
| M-13 | Editor inputs: `2027-03-28T01:30`, `2026-10-25T01:30`, `2026-11-10T18:00`, a past time, a 4th step | `time_does_not_exist`; accepted as 01:30Z with GMT note; accepted; `step_in_past`; `too_many_steps` |
| M-14 | "rises on" text for 2026-12-31T23:30Z and 2027-06-30T23:30Z | "31 Dec" and "1 Jul" (London) |
| M-15 | Step writer while any of reserve v1-v4 is still executable by service_role | `reserve_not_ready`; mutant: gate regex `v[123]` -> red with v4 executable |
| M-16 | Late payment after a rise (`mark_paid_v1` reopens at stored line price) | paid at the confirmed early price (Q5/Q9), Stripe amount = `total_pence` |
Plus the W1 journeys x P1-P8: add, move, remove step, step passes while page open, step during checkout, step x promo, step x sold-out x chain, step on free ticket refused, step in past refused, 4th step refused.

## 7. Open design decisions (none is a product question for the owner unless marked)
OPEN-D1 Fixed-amount promo codes across steps: discount applies as written to whatever price is effective. (Owner only if he wants codes tied to a step.)
OPEN-D2 Chain x steps: independent; steps are per type.
OPEN-D3 Time source: `now()` in the transaction, never the client clock (s.2c).
OPEN-D4 CLOSED by s.2c (non-existent time refused by round-trip check; ambiguous time = later instant, stated).
OPEN-D5 (REOPENED, F9) A step during a pending order: the order keeps the price confirmed at reserve. The 32/37-min bounds are pre-v4. v4 sets `hold_expires_at = now() + 15 min` and has a hold-release path; re-derive the bound for v4/v5 orders from `ticket_order_hold_release_v1` and the sweep before T2 (body not read yet). Late payment: `ticket_order_mark_paid_v1` reopens an expired order at its stored line price, so a late payer keeps the early price after a rise: ACCEPTED (they confirmed it; Stripe charged exactly `total_pence`); matrix row M-16.
OPEN-D6 Next price LOWER than current: show it ("price changes on <date>").
OPEN-D7 (PARKED, F5) Steps relative to each night.

## 8. Not verified
Which reserve the prod edge calls (G-1; method in s.3a). The edge's per-line Stripe code since S1b. Reserve v1-v3 and preview v1/v2 bodies beyond the `price_pence` probe; `ticket_order_hold_release_v1` body. Admin migrations vs prod md5. Whether the Website calls preview v1. Whether a `RETURNS TABLE` change forces `public_v3` (assumed yes). Whether `ticket_sales_summary_v2` shows a current price. Any phone walk. No migration, code or dispatch exists for this design.
