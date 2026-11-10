# REVIEW r1: ticketing for organisers, price steps (row 310)

Reviewer: independent session (different model from the author), 2026-11-10. Docs only, read-only.
Inputs: `docs/briefs/design-ticketing-organisers.md` (DRAFT 1), `docs/briefs/contract-ticket-tiers.md`
(DRAFT 3), both from branch `brief/review-ticketing-organisers` (2df713c).
Checked against: Website `origin/main` f0f3b29; prod `stsdtacfauprzrdebmzg` pg_proc / pg_class /
pg_default_acl / counts (SELECT only, no personal data, never a write).
Inventory first: [`ticketing-organisers-r1.INVENTORY.md`](ticketing-organisers-r1.INVENTORY.md) (I-1..I-48, G-1..G-4).

## Verdict: HOLD

The design's idea is sound (one schedule of steps, price frozen per order line at reserve,
buyer confirms a changed price). But it was written against a picture of prod that is now
out of date: S1a/S1b HAVE landed (#1523), prod has FOUR reserve functions, not two, and an
effective-price seam already exists and is used by only one of them. As written, T1/T2 would
create a second price function and leave three reserve paths, two promo previews and both
public lists on the base price: a buyer CAN pay a price the page did not show. Revise the
design (F1-F4 at least) before the T1/T2 briefs are written. Nothing is built, so nothing on
prod is at risk today.

## Findings (most severe first)

### F1 HIGH: four reserves, one seam; the design names two reserves and a new seam
- Where: design s.2 (`_ticket_effective_price_v1`), s.3 ("both reserve paths ... v1 and v2"), s.3b ("NOT landed"); prod I-2, I-5..I-8.
- Fact: prod has `ticket_checkout_reserve_v1`, `_v2`, `_v3`, `_v4`, all EXECUTE service_role. Only v4 prices through the existing `_ticket_effective_unit_price_v1(p_type, p_occurrence_id)` (today `SELECT p_type.price_pence`). v1, v2, v3 read `v_type.price_pence` directly. No prod order was written by v4 yet (I-9: every order has `hold_expires_at NULL`), and the edge source is a GAP (G-1), so which version prod calls is unknown.
- Failing scenario: steps ship, v4 and public_v2 read the steps, the edge still calls v3 (or a rollback re-points it). Type base 1500, step to 2000 at 18:00. At 18:05 the page shows 20.00; v3 writes `unit_price_pence = 1500`. Reverse case (step DOWN, early-bird ending into a lower "last-minute" price) charges the higher base. Either way the buyer pays a price the page did not show, and `price_changed` never fires because v3 has no expected-price check.
- Fix: put the step lookup INSIDE the existing `_ticket_effective_unit_price_v1` (it already takes the night, see F5); do not add `_ticket_effective_price_v1`. Before any step can be written, v1-v3 must either call the seam AND do the expected-price check, or lose EXECUTE (`REVOKE ... FROM service_role`) once the edge is proven on v4. Make the step writer refuse (`reserve_not_ready`) while any older reserve is still executable, or ship T1 and the retirement in one migration.
- Test / mutant: DB test that enumerates `pg_proc WHERE proname LIKE 'ticket_checkout_reserve_v%' AND has_function_privilege('service_role', oid, 'EXECUTE')` and, for each, reserves a stepped type and asserts `order.unit_price_pence = _ticket_effective_unit_price_v1(type, night)`. Mutant: restore `v_type.price_pence` in v3 -> red. Cheap static guard: no function that INSERTs into `ticket_orders` / `ticket_order_lines` may contain `v_type.price_pence` (prosrc search in a contract check).

### F2 HIGH: promo preview and public lists read the base price directly
- Where: I-13 (`ticket_promo_preview_v1/_v2`: `v_unit := v_type.price_pence`), I-15/I-16 (`ticket_types_public_v1/_v2` return and ORDER BY `price_pence`), I-17 (sales summaries), Website I-34 (`TicketsBlock.tsx:207` pay total = preview `appliedTotalPence` + fee).
- Design gap: s.2 lists "public list, both reserves, organiser list, buyer confirm" as seam callers; the promo preview is not listed; the public list is described as "new columns or a v2" (v2 already exists).
- Failing scenario: step 1500 -> 2000 live, public_v2 updated, preview_v2 not. Buyer applies a 10% code: the page shows "you pay 13.50" (preview on base); reserve charges 18.00. If the expected-price check compares the UNIT (2000, which the page also shows) it passes, so the buyer is charged 18.00 after seeing 13.50.
- Fix: every reader of a price calls the seam: public_v1 (or revoke it, the Website no longer calls it, `ticketCheckoutApi.ts:48`), public_v2 (price AND sort key), preview_v1/_v2, sales_summary (current price column). Add `next_price_pence`, `next_price_at` to public_v2 only through the same function.
- Test / mutant: parity test over a stepped type at t-1s, t, t+1s: `public_v2.price_pence = preview_v2.unit = reserve_v4 line unit` and `preview_v2 total = reserve_v4 order total` for code / no code. Mutant: preview keeps `v_type.price_pence` -> red.

### F3 HIGH: `price_changed` contract is under-specified where money leaks
- Where: design s.3 / s.3b; prod I-8; Website I-32, I-33.
- Gaps: (a) what a MISSING expected price means. v4 takes `p_lines jsonb`, so the natural place is a per-line key `expected_unit_price_pence`, which is optional by construction; a defaulted parameter on v1-v3 is the same. If "missing = no check", any caller that omits it (old edge build, a rollback, the Website's `CheckoutBody` today has no such field) skips the check. (b) unit vs total: the buyer sees a TOTAL (unit x qty - discount + fee). (c) the reply shape: per line (`line`, `ticket_type_id`, `new_unit_price_pence`) as v4's other refusals; must be refused BEFORE capacity is taken and BEFORE promo-refusal rows are written (a `price_changed` must not count toward the promo limiter).
- Failing scenario: edge sends `p_lines` without the new key; step passed while the page was open (`staleTime` 30 s, page left open for hours); the buyer is charged the new price on Stripe without having seen it. Violates owner Q5.
- Fix: missing expected = refuse with `price_changed` (or `expected_price_required`) on every line, always (not only on stepped types, or the rule silently stops applying when a step is added later). Compare unit per line AND an `expected_total_pence` for the order (covers discount and fee drift too). Specify the reply exactly and add `price_changed` to `REASON_COPY` with the confirm state (I-33).
- Test / mutant: (1) omitted key on a stepped and an unstepped type -> refused, no order, no `ticket_night_counts` / `reserved_count` change, no `ticket_promo_checkout_refusals` row; (2) basket of two lines, only line 2 stale -> reply names line 2. Mutants: treat null expected as match; compare only line 1; check after the capacity UPDATE -> each red.

### F4 MEDIUM: price-changed vs fee and rounding
- Rounding: steps are integer pence and `_ticket_promo_unit_discount_v1` floors the percent discount (I-11), shared by preview and reserve, so given the SAME unit price both agree. No rounding defect from steps themselves; the risk is only F2 (different unit). A fixed code larger than a lowered step price clamps to the unit (`least(value, unit)`) and can make the line free; with other lines paid, `below_minimum` (30p, I-12) can appear after a step DOWN for a buyer whose preview passed. Covered if F2+F3 land; add the row to the matrix (design OPEN-D1).
- Fee: the page fee is a Website constant (I-36) and the server fee an env secret; a mismatch is a second "price not shown" path. `expected_total_pence` (F3) catches it at no extra cost.

### F5 MEDIUM: wall-clock steps on per-night types (every prod type)
- Where: design s.2 ("effective price at time t"); prod I-1, I-3 (all 17 types are series-wide per-night types sold for many nights); the seam already takes `p_occurrence_id`.
- Failing scenario: organiser of a weekly social sets "early-bird ends Fri 18:00" thinking of this Saturday. A buyer on Sunday buying for a night two months away pays the risen price; the "early bird" never comes back for later nights. Equally, a step meant as "last week before the night" cannot be expressed.
- This is a product question for the owner (not a defect to fix silently): absolute date (design as written) vs relative to each night ("N days before the night"). Course types (kind=course, 0 on prod) fit the absolute model naturally.
- Test: matrix row "per-night type, step at T, buy at T+1h for night N1 (before T+7d) and N2 (T+60d)" with the expected price written down per answer.

### F6 MEDIUM: base price can still change (incl. to 0) before the first order
- Where: I-18 (`ticket_type_upsert_v1` blocks price change only when `has_orders`), design s.2 ("free ticket: no steps", "a step may not make price 0").
- Failing scenario: paid type 1500 with a step 2000 and no orders; organiser edits the base to 0. Now base free, step paid: a free -> paid step (violates Q6), the Stripe gate (I-19, I-39 `moveBlock`) reads `price_pence > 0` = false, the type can go on_sale without Stripe, and at the step it starts charging through an organiser who may have no charge account (v4 then refuses `organiser_not_onboarded`, so the ticket silently becomes unbuyable).
- Fix: upsert refuses `price_pence = 0` while steps exist (`has_price_steps`), and the step writer refuses on a free base (`not_paid_ticket`, already designed). The base-equals-step case is harmless but should be refused for clarity (`same_price`).
- Test / mutant: upsert price 0 on a type with a step -> refused; mutant drops the check -> red. Website: the price field on a type with steps says why it cannot go to 0 (I-38).

### F7 MEDIUM: ACL on a Supabase default-privilege schema
- Where: design s.5 T1 ("explicit GRANT/REVOKE incl. service_role"); prod I-24..I-26.
- Fact: in `public`, a NEW table gets `arwdDxtm` for anon AND authenticated, and a NEW function gets EXECUTE for anon and authenticated, by default (I-24). RLS-on with no policy blocks rows, but table privileges still let PostgREST expose it, and a SECURITY DEFINER writer created without REVOKE is anon-callable.
- Required list (spell it in T1, verify after apply):
  - `ticket_price_steps`: `ENABLE ROW LEVEL SECURITY`; `REVOKE ALL ON ... FROM PUBLIC, anon, authenticated`; `GRANT SELECT ON ... TO service_role` (match `ticket_order_lines`, I-25); organiser reads go through an RPC (or a member-read policy mirroring `ticket_types_member_read` if a direct select is wanted, then `GRANT SELECT TO authenticated` only). No INSERT/UPDATE/DELETE grant to anyone but the owner role.
  - `_ticket_effective_unit_price_v1` (the existing seam, F1): keep EXECUTE postgres only; it is STABLE, NOT security definer, so it runs with the caller's rights: every caller is a definer function owned by postgres, which can read the steps table. A future NON-definer caller would fail closed (permission denied), which is the right direction; note it in the function comment.
  - `ticket_price_step_set_v1` / `_remove_v1`: `SECURITY DEFINER SET search_path = pg_catalog, public` (house style, every ticket function I-5..I-26 has it); `REVOKE EXECUTE ... FROM PUBLIC, anon`; `GRANT EXECUTE ... TO authenticated`; inside: `SELECT ... FROM ticket_types WHERE id = $1 FOR UPDATE` FIRST (the same row lock the reserves take, so a step edit and a reserve serialize), then `_ticket_can_manage_organiser_v1`, onboarding gate, `effective_from > now()` for both the old and the new time on a move, count <= 3, strictly increasing, price > 0, base > 0.
  - Guard list: `scripts/onboarding-write-doors.json` gets both writers (design says so; keep).
- Test: post-apply SELECT asserting `has_table_privilege('anon','public.ticket_price_steps','SELECT') = false`, same for authenticated INSERT/UPDATE/DELETE, `has_function_privilege('anon', 'ticket_price_step_set_v1(...)', 'EXECUTE') = false`, `proconfig` contains the pinned search_path. Mutant: drop the REVOKE -> red.

### F8 MEDIUM: time edges (time zone, DST, boundary)
- DB `TimeZone` is UTC (I-27): any SQL that turns a step into a DATE (e.g. "rises on <date>" text built in SQL) would use the UTC date; build the text on the client in Europe/London from the timestamptz.
- DST: the obvious helper `londonInputToIso` (I-40) does NOT refuse a non-existent time: `2027-03-28T01:30` becomes `01:30Z` = 02:30 BST and reads back as `02:30`. Design OPEN-D4 ("editor refuses non-existent local times") therefore needs a new check: refuse when `isoToLondonInput(londonInputToIso(v)) !== v`. The ambiguous `2026-10-25T01:30` resolves to the later (GMT) instant; state it in copy or refuse it too.
- Boundary: design rule "effective when `effective_from <= t`" and editor rule "move/remove only while `effective_from > now()`" agree at the instant (at exactly t the step is live and frozen). `now()` is transaction start; a reserve that starts at 17:59:59.9 and commits after 18:00 charges the old price, which matches the page the buyer saw, acceptable. The client must never decide the step (server `now()` only, OPEN-D3 correct).
- Test: table test of the five values above for the editor; DB test at `effective_from - 1us`, `= effective_from` (use a fixed transaction timestamp via a wrapper that takes `at`, e.g. `_ticket_effective_unit_price_at_v1(p_type, p_night, p_at)` called by the seam with `now()`).

### F9 LOW: OPEN-D5 bounds are stale; late payment path
- v4 sets `hold_expires_at = now() + 15 min` and there is a hold-release path (I-23); the 32/37-min numbers in OPEN-D5 apply to pre-v4 orders. Re-derive the bound for v4 orders before closing D5.
- `ticket_order_mark_paid_v1` (I-20) re-opens an expired order on late payment at its stored line price. With steps this lets a late payer keep the early price after the rise: consistent with Q5/Q9 (they confirmed that price) and Stripe charged exactly `total_pence` (amount check). Accept; write it into the contract as a known row.

### F10 LOW: organiser and list ordering show the base price
- I-37: the organiser list is a direct `ticket_types` select, so after a step it still shows the base (e.g. 15.00 while buyers pay 20.00). I-15/I-16 sort by base price, so after a step the public order can disagree with the prices shown. T3 must read current + next step from one RPC that uses the seam; public_v2 must sort by the effective price.

### F11 LOW (dependency, no defect today): free-ness checks read the base
- I-5 (v1 free gate), I-19 (`set_status` Stripe gate), I-35 (`ticketSymbol`, `buyLabel`), I-39 (`moveBlock`), `TicketsBlock.tsx:126` (`promoOn`) all decide "free" from the base price. They stay right ONLY while "base > 0 iff every step > 0", which F6 must enforce. Note the invariant in the T1 migration comment.

### Checked, no finding
- Webhook / refund paths and `unit_price_pence` (brief item 3): refunds and disputes never read `price_pence` / `unit_price_pence` (I-21); `mark_paid` checks Stripe `amount_total = total_pence` (I-20); lines trigger keeps lines summing to the order (I-22); `ticket_sales_summary_v2` reads line unit prices. Stored per-line prices mean steps need no change on these paths. Holds.
- Reserve signature backward compatibility (brief item 3): putting the expected price in v4's `p_lines` elements needs NO signature change and no new overload, which is the compatible route; adding a defaulted parameter to v1-v3 creates a new identity / overload and leaves the old one callable unless dropped. Recommendation: do not extend v1-v3; retire them (F1).
- Lock order (design s.3b): v4 locks types by id, then night counts, then the promo code row; the seam reads steps without locking. Step writers must take the type row lock (F7) and nothing else, so no new deadlock cycle.
- Courses (brief item 1): 0 course types on prod; `_ticket_effective_close_v1` treats course separately; absolute-date steps fit courses. No finding beyond F5's question.
- Night-aware tickets (#1523): steps do not interact with per-night capacity (`ticket_night_counts`) or `_ticket_night_refusal_v1`; refusal order in v4 (night, status, window, capacity) runs before pricing, so `price_changed` must be placed after those and before capacity is taken (F3).

## Coverage
Inventory items judged: 48 / 48 (I-1..I-48). Mapping: F1 I-2, I-5..I-9, I-28, I-41, I-42, I-43; F2 I-13..I-17, I-29, I-30, I-34; F3 I-8, I-32, I-33, I-42; F4 I-11, I-12, I-14, I-31, I-36; F5 I-1, I-3, I-48; F6 I-18, I-38, I-47; F7 I-4, I-24, I-25, I-26, I-45; F8 I-27, I-40, I-46; F9 I-20, I-23, I-44; F10 I-37; F11 I-19, I-35, I-39; no-finding checks I-10, I-21, I-22.
GAPs not judged: 4 (G-1 edge source, G-2 admin UI, G-3 migration-vs-prod md5, G-4 phone walk).
Findings: 3 HIGH, 5 MEDIUM, 3 LOW.

## Verified
- Prod pg_proc (SELECT only, 2026-11-10): signatures, SECURITY DEFINER, search_path, EXECUTE roles of every `ticket*` / `_ticket*` function; full bodies of `ticket_checkout_reserve_v4`, `_ticket_effective_unit_price_v1`, `ticket_types_public_v2`, `_ticket_checkout_sale_refusal_v2`, `_ticket_promo_unit_discount_v1`, `_ticket_order_lines_check_v1`, `_ticket_order_line_fill_v1`, `_ticket_order_lines_v1`, `ticket_order_mark_paid_v1`, `ticket_orders_sweep_v1`, `ticket_orders_hold_due_v1`, `_ticket_type_per_night_v1`, `_ticket_effective_close_v1`; every line mentioning `price_pence` in every public function (v1-v3, previews, public lists, upsert, set_status, summaries).
- Prod counts: 17 types (15 on_sale, 2 paused, all per-night series-wide, 1 free), 3 series, 5 orders (none via v4), 1 promo code; `ticket_price_steps` absent; default ACLs; RLS/grants on `ticket_types`, `ticket_order_lines`; DB TimeZone UTC.
- Website origin/main f0f3b29: file:line in the inventory; `londonInputToIso` DST behaviour by a throwaway vitest probe (not committed).

## Not verified
- Which reserve version the prod edge function calls, and the edge's Stripe line-item code (admin repo not in this session; design's s.3 claim about `buildCheckoutSessionParams` taken on trust).
- Admin `origin/main` migration bodies equal prod bodies (no md5 compare).
- Bodies of reserve v1-v3 and preview v1/v2 beyond their `price_pence` lines; `ticket_order_hold_release_v1` body.
- Any admin-app organiser UI for tickets; any phone walk (nothing to walk: nothing is built).
- No mutant was actually run: the tests above are specified, not written (docs-only review).

## Handover
Done: inventory + review, verdict HOLD (PR #1528, branch `claude/review-ticketing-organisers`). tsc run on the review commit: 0 errors (no TS files touched). Left: the design author revises s.2/s.3/s.3b/s.5 for F1-F3 (must), F5 goes to the owner as a product question, F6-F8 go into the T1 brief. Next: r2 review of the revised design, with the admin repo attached so G-1/G-3 can be closed.
