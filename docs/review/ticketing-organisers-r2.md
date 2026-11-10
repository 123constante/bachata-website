# REVIEW r2: ticketing for organisers, price steps (row 310 follow-up)

Reviewer: independent r2 session (not the r1 reviewer, not the author), 2026-11-10. Docs only, read-only.
Reviewed: `docs/briefs/design-ticketing-organisers.md` DRAFT 2, `docs/briefs/contract-ticket-tiers.md` s.0c,
`docs/review/ticketing-design-fixes-r1.md`, all at `claude/revise-ticketing-design` aa28318. Prior review:
`docs/review/ticketing-organisers-r1.md` (branch `claude/review-ticketing-organisers`).
Inventory first: [`ticketing-organisers-r2.INVENTORY.md`](ticketing-organisers-r2.INVENTORY.md) (J-1..J-49, G-1..G-4).

## Verdict: HOLD

The revision fixes most of r1 well: one seam, fail-closed expected price, the paid invariant, London time
(probed, correct). But G-1 is now answered and the answer breaks the rollout. **Every live Website purchase
goes through reserve v3, not v4** (J-26, J-27, J-35, J-36). The design retires v3 in T1 and says "T1 may land
first". Followed as written, T1 would stop every ticket sale on the site. T2's edge refusal of bodies with no
expected price would do the same. T2 also has no privilege list for the new public functions (v5,
`ticket_types_public_v3`). The default ACL would make v5 anon-callable, and the caller sets the fee and
the buyer id (J-21). Three small doc edits fix this (N1-N3). No money is at risk today: nothing is built
and `ticket_price_steps` does not exist (J-3).

## 1. r1 findings against DRAFT 2
| r1 | Status | Closing section | Why |
|---|---|---|---|
| F1 HIGH | **PARTLY** | design s.2a, s.3a; contract R-1 | Seam part CLOSED: no second price function, `_at` wrapper, owner-only EXECUTE (matches prod J-6). Retirement part OPEN: s.3a puts the v3 revoke in T1, but v3 is the live reserve (N1). The G-1 method step (3) "has lines in `ticket_order_lines`" does not tell v4 from older reserves: all 5 prod orders have lines (J-5). Only `hold_expires_at IS NOT NULL` tells them apart. |
| F2 HIGH | CLOSED | s.2a reader list, s.3c | The list matches prod exactly (J-10, J-12..J-17): preview v1/v2, public v1/v2, summaries. Preview v1 can be decided now: no Website caller (J-38), so revoke it. |
| F3 HIGH | **PARTLY** | s.3b; R-3 | CLOSED: fail-closed on a missing value (absent/null/non-integer, every type), the reply shape, and v5's no-default parameter. OPEN: (a) the order-total check cannot run "before any promo-refusal row" because the total needs the discount and fee (N2). (b) "Per line" assumes a `lines` body, but the Website sends the single shape (J-35). T4 must move the Website to the basket wire, and the design does not say so (N1). |
| F4 MED | CLOSED | s.3d | Shared floor discount; the expected total catches fee drift. Add the net-0 fee row (N5). |
| F5 MED | CLOSED (decision) | s.1 F5 DECIDED; R-4; M-10 | Absolute steps per type, with editor copy. Owner-DELEGATED. No owner click seen. |
| F6 MED | CLOSED | s.2b; M-11, M-12 | Upsert `has_price_steps`, writer `not_paid_ticket` / `same_price`, Website copy. |
| F7 MED | **PARTLY** | s.5 T1 | T1 list is complete for the step table, seam, `_at` and writers, and correct against the default ACL (J-21). Missing: post-apply assertions for `ticket_types_manage_v1`, and ANY list for T2 objects (N3). |
| F8 MED | CLOSED | s.2c; OPEN-D4; M-1, M-13, M-14 | Verified by probe (J-48): the round trip refuses `2027-03-28T01:30` (gives back `02:30`). The ambiguous `2026-10-25T01:30` gives `01:30Z` (the later instant, GMT). M-14 expected strings are right ("31 Dec", "1 Jul"). |
| F9 LOW | **PARTLY** | OPEN-D5 | Still "re-derive before T2". Data for it: hold 15 min, Stripe session 32 min (J-32), and release only through the `ticket-hold-sweep` edge, which has NO pg_cron row (J-22). Late payment after a released hold is therefore a NORMAL path, not an edge case. M-16 is required, not optional (N6). |
| F10 LOW | **PARTLY** | s.3c | Organiser list CLOSED by `ticket_types_manage_v1`. Sales summary "if shown, uses the seam" only restates the finding. `ticket_sales_summary_v1` is still authenticated-callable and reads `t.price_pence` (J-16). Say whether it is revoked or patched. |
| F11 LOW | CLOSED | s.2b invariant | |

## 2. G-1 and G-3 (task item 2)
- **Which reserve does the deployed edge call?** Edge `ticket-checkout` v22 (`get_edge_function`, read-only):
  - A body WITHOUT `lines` goes to `ticket_checkout_reserve_v3` (`_shared/ticketingHandlers.ts:249-268`).
  - A body WITH `lines` goes to `ticket_checkout_reserve_v4` (`:460`), selected at `:200-202`.
  - The Website's `CheckoutBody` (`ticketCheckoutModel.ts:235-246`) has no `lines`, so **every Website purchase calls v3**. v4 is reachable but has no client.
  - This matches the database: all 5 orders have `hold_expires_at NULL` (J-4).
  - v1 and v2 have no caller in the deployed edge (no other `ticket_checkout_reserve_v*` string in the deployed files).
- **Do v1-v3 exist on prod?** Yes. All four reserves are SECURITY DEFINER with EXECUTE for service_role only (J-7..J-10). v1-v3 price from `v_type.price_pence`; only v4 calls the seam. No DB function calls any reserve (prosrc reference scan).
- **G-3:** prod md5 of every price function is recorded (J-6..J-18). `supabase_migrations.statements` is NULL for every recent ticket migration (J-23), so source-vs-prod needs the admin repo, which this sandbox cannot reach. The edge source compare that G-1 needed is done: the deployed source was read directly.
- **Does T2 route and retire them correctly?** No (N1).

## 3. New findings
### N1 HIGH: the retirement order would stop every live sale
- Where: design s.3a ("Retirement step, in the SAME migration as the step table (T1) ... T1 may land first"), s.3b ("Edge refuses a request without them with `expected_price_required` before calling the DB"), s.5 T1/T2/T4; contract R-1.
- Failing scenario 1: T1 applies with `REVOKE EXECUTE ON ticket_checkout_reserve_v3 FROM service_role`. The next Website purchase posts the single body. The edge calls v3, gets permission denied, and answers `internal_error` 500. Every ticket sale on the site stops until the edge or Website ships.
- Failing scenario 2: T2's edge refuses bodies without expected fields, but the Website (T4) has not shipped. Same outage.
- Fix (doc only):
  1. T1 revokes only what has no caller: reserve v1, v2, public v1, preview v1 (J-38). The `reserve_not_ready` gate keeps steps unwritable while v3/v4 stay executable, so T1 is still inert.
  2. T2 adds v5 and a v5 path in the edge, and KEEPS the old single and `lines` paths working.
  3. T4 moves the Website to the basket wire with `expected_unit_price_pence` per line and `expected_total_pence`. This includes free tickets: expected 0 on every type.
  4. A final T2b/T6 ships the edge that refuses missing expected values, removes the v3/v4 paths, and REVOKEs v3 and v4. Only after that can the gate open.
  - The G-1 proof uses `hold_expires_at` (or a v5-only marker) instead of "has lines".
- Test: in the T2b PR, a pasted grep of the DEPLOYED edge (`get_edge_function`) showing only `ticket_checkout_reserve_v5`. Plus the post-revoke assertion `has_function_privilege('service_role', oid, 'EXECUTE') = false` for v1-v4, run AFTER that deploy (order checked by timestamps).

### N2 MEDIUM: the expected-total check cannot sit before the promo-refusal row
- Where: design s.3b "Placement in v5"; M-7. Prod v4 order (J-11): seam unit at 116, then the promo limiter (123-131), the code lock (145), the discount (168), the refusal-row INSERT (186), and the fee (210), all before capacity (215/220).
- Problem: the order total needs the discount and the fee, which only exist after line 186 can write a refusal row.
- Fix: TWO checkpoints.
  - (a) The per-line unit check goes right after the seam (after 116, before 123). A stale unit refuses `price_changed` before the limiter, before the code lock, and before any refusal row. This is what M-7 tests.
  - (b) The total check goes after the fee (after 210) and before the capacity write (215). A refused code wins over a fee-only drift, which is correct because the code really is refused.
  - State both points and split M-7 / M-8 to match.

### N3 HIGH: no privilege list for T2 objects; the default ACL makes them anon-callable
- Where: design s.5 T2 (no ACL lines); prod J-21: a NEW function in `public` gets EXECUTE for anon and authenticated by default.
- Failing scenario: v5 is created like v4 but the REVOKE is forgotten. Anyone with the publishable key can then call v5 directly through PostgREST:
  - pass `p_booking_fee_per_ticket_pence = 0` and skip the fee;
  - set `p_buyer_user_id` to another person's account;
  - get past the edge rate limit (`ticket_checkout_rate_check_v1` lives in the edge);
  - and with matching expected prices, `price_changed` never fires.
- Fix: write the T2 list the way T1 has one.
  - `ticket_checkout_reserve_v5`: `REVOKE EXECUTE FROM PUBLIC, anon, authenticated; GRANT EXECUTE TO service_role`.
  - `ticket_types_public_v3`: `GRANT EXECUTE TO anon, authenticated`, search_path pinned.
  - Patched preview/public v2 via `CREATE OR REPLACE`: the ACL is kept (say so).
  - Retired functions: the REVOKEs listed in N1.
  - Post-apply assertions for each of these.
  - Also add `ticket_types_manage_v1` (anon false, authenticated true) to the T1 assertions.
- Test / mutant: post-apply SELECT `has_function_privilege('anon', 'public.ticket_checkout_reserve_v5(<args>)', 'EXECUTE') = false`. Mutant: drop the REVOKE, and the assertion goes red.

### N4 LOW: the static guard's "outside a call to the seam" cannot be written as a regex
- s.2a guard. The seam takes the ROW (`p_type`), never `price_pence`, so the guard can be simpler and strict: no `\.price_pence\b` token at all in any EXECUTE-able `ticket_checkout_reserve_v*`, `ticket_promo_preview_v*`, or `ticket_types_public_v*`. Public v3 must not carry `t.price_pence` into its CTE (v2 does today, J-15).
- Test: run the guard against prod today. It must go RED on v1-v3, preview v1/v2 and public v1/v2 (J-7..J-15). That is the canary.

### N5 LOW: fee on a zero net
- The server charges no fee when net = 0 (v3/v4, J-9, J-11 line 210). The Website adds `sum.feePence` to the preview total (`TicketsBlock.tsx:207`).
- With a non-zero fee, a 100% code shows page total = fee but server total = 0. That gives a `price_changed` on every first attempt.
- Today the fee is 0 (J-29, J-44), so nothing breaks yet. Add the row to M-8 and make the Website's fee rule match the server's.

### N6 LOW: hold release has no scheduler visible in the DB
- J-22: the only cron row is `ticket_orders_sweep_v1`. The `ticket-hold-sweep` edge has no pg_cron job, so it is either scheduled outside the DB or not at all.
- Not a price-step defect, because a held line keeps its stored price. But OPEN-D5's bound depends on it.
- Name the scheduler in the T2 brief and keep M-16.

## 4. Money invariants re-tested (task item 3)
| Invariant | Holds in DRAFT 2? | Basis |
|---|---|---|
| Buyer never pays a price the page did not show | YES once N1-N3 land. As written it holds on money, but only because the gate never opens; the rollout breaks sales (N1) | s.2a, s.3a gate, s.3b; J-30/J-31: Stripe line items come from the order lines, never from the type (s.3e re-verified on the deployed v22 for both paths) |
| `price_changed` fails closed on a missing expected-price key | YES (absent/null/non-integer, every type; v5 no default; PostgREST fails when an argument is missing) | s.3b. Test it with a JSON string `"1500"` and a float `1500.5` as well: a bare `::int` cast throws, so that would be a 500, not `expected_price_required` |
| London-time step boundaries incl. DST gap and overlap | YES | s.2c; probe J-48; `_at` boundary M-1. Whole 01:00-01:59 gap refused (the round trip differs); 02:00 accepted |
| Price 0 vs steps | YES | s.2b invariant + three refusals; the free prod type is paused (J-1) |
| Promo preview and public lists use the seam | YES (s.2a, s.3c); preview v1 revoke can be decided now (J-38) | |
| Explicit GRANT/REVOKE list complete | NO: T1 complete except the manage RPC assertions; T2 missing (N3) | |

## 5. Tests and mutants the build must include (task item 4)
- **F1**
  - M-3: enumerate `pg_proc WHERE proname ~ '^ticket_checkout_reserve_v' AND has_function_privilege('service_role', oid, 'EXECUTE')`. For each, reserve a stepped type at `_at` T+1s and assert `line.unit_price_pence = _ticket_effective_unit_price_at_v1(type, night, T+1s)`.
  - Mutant: put `v_type.price_pence` back in v5, and the test goes red.
  - Gate test M-15 with v3 still executable gives `reserve_not_ready`. Mutant: gate regex `v[124]`, and it goes red.
  - The N4 static guard with its canary RED on today's prod.
  - N1 deploy-order check.
- **F2**
  - M-2 parity at T-1s / T / T+1s × {no code, 10%, fixed}: `public_v3.price = public_v2.price = preview_v2.unit = v5 line unit`, and `preview_v2.total + fee(net) = v5.total_pence`.
  - Mutants: preview keeps `v_type.price_pence`, public v2 sorts by `t.price_pence`. Each goes red (M-4 catches the sort).
- **F3**
  - M-5: omit the key on stepped and unstepped types; null; `"1500"`; `1500.5`; omit `p_expected_total_pence` (call error) and pass null. Each gives no order and no change to `ticket_night_counts`, `reserved_count`, or `ticket_promo_checkout_refusals`.
  - M-6: line 2 stale only, and the reply lists line 2 only.
  - M-7 per N2: stale unit plus a code over its limit gives `price_changed` and no limiter row.
  - M-8 per N2/N5: fee drift plus a valid code gives `price_changed` at the total check, after the code lock, still before capacity.
  - Mutants, each red: null treated as match; only line 1 compared; unit check moved after the refusal INSERT; total check moved after the capacity UPDATE.

## Coverage
Inventory items judged: 49 / 49.
- N1: J-4, J-5, J-7..J-10, J-26..J-28, J-34..J-36
- N2: J-11
- N3: J-21, J-25
- N4: J-12..J-15
- N5: J-9, J-29, J-40, J-44
- N6: J-19, J-22, J-32, J-33
- Invariants: J-1..J-3, J-6, J-24, J-30, J-31, J-37..J-39, J-41..J-43, J-48, J-49
- F10: J-16, J-17, J-45
- F6: J-18, J-46, J-47
- G-3: J-20, J-23

r1 findings: 11 / 11 judged (6 CLOSED, 5 PARTLY, 0 OPEN). New: 2 HIGH, 1 MEDIUM, 3 LOW.

## Verified
- Deployed edge `ticket-checkout` v22 source read with `get_edge_function` (read-only): the reserve dispatch, the single path on v3, the basket path on v4, and the Stripe line-item builders for both paths.
- Prod `stsdtacfauprzrdebmzg`, read-only SELECTs only, 2026-11-10:
  - signature, definer, search_path, EXECUTE per role, md5 and price-read tokens of every reserve/preview/public/summary/upsert/seam function;
  - full bodies of `ticket_types_public_v2` and `ticket_order_hold_release_v1`;
  - price lines of v3 and preview v2; the v4 statement order;
  - the reference scan for reserve/seam callers; `pg_default_acl`; `cron.job` sweep rows (secrets redacted in the query);
  - migration names; order and type counts by shape (no personal data); TimeZone. No write of any kind.
- Website `origin/main` f0f3b29: `CheckoutBody` shape, preview/public callers, pay total, fee constant.
- London helpers: DST behaviour checked with a throwaway vitest probe (deleted, not committed).

## Not verified
- Admin repo source (`supabase/functions`, `supabase/migrations`): not reachable from this sandbox. G-3 source-vs-prod md5 is still open; the deployed edge was read directly instead.
- Full bodies of reserve v1/v2 and preview v1 beyond their price-read tokens.
- How `ticket-hold-sweep` is scheduled (N6).
- Whether `totals().feePence` is non-zero on a zero net (N5 is conditional).
- Admin organiser UI (G-2). No phone walk (nothing built). No test or mutant was run; the tests above are specified, not written (docs-only review).

## Handover
- Done: inventory, this review, verdict HOLD.
- Left: the design author edits s.3a/s.3b/s.5:
  - N1: phased retirement; T4 moves to the `lines` wire; G-1 proof by `hold_expires_at`.
  - N2: two checkpoints.
  - N3: T2 privilege list and the manage-RPC assertions.
  - N4-N6 as notes.
  - Then the F10 summary-v1 decision and the F9 bound.
- Next: an r3 check limited to N1-N3 (small), then the T1 brief.
