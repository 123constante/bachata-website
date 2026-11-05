# Brief: organiser "Money so far" shows what promo codes took off (HELD: do not dispatch until the lead opens P3 slices)

Repo 123constante/bachata-website. Branch claude/ticket-promo-sales-line. Lane normal (screen, no DB change). Model Sonnet. One push.
Owner decision 2026-11-05: queue this. Dispatch only when website-45-e / website-15 says P3 slices are open and claude/p3-status-real-reasons has merged.

## What main lacks -- grep: discounts_pence|discountsPence in src (0 hits)
Admin's sales summary RPC (migration 20270314170000_ticket_promo_codes_v1.sql lines ~791-825, the same one the P3 Tickets screens read) ALREADY returns per type `gross_pence` = sum(subtotal - discount) over paid orders (what was charged before the fee) and a new key `discounts_pence` = sum(discount) over paid orders. The Website never reads `discounts_pence`, so an organiser whose buyers used a promo code sees a lower Sales number with no explanation.

## Files
- src/modules/organiser/tickets/ticketModel.ts: `TypeSales` (line ~114) gains `discountsPence: number`; the parser that maps the RPC reply reads `discounts_pence` (missing/non-number = 0); `SalesTotals` / `totalsOf` (~187) add `discountsPence`.
- src/modules/organiser/p3/tickets/GetPaid.tsx: `MoneySoFar` (~39) note line gains "{formatPence(discountsPence)} off with promo codes" in the `extra` list ONLY when discountsPence > 0 (same style as "refunded" and "disputed"). The per-type line (~245-250) is NOT changed.
- Tests: table-driven, src/modules/organiser/p3/tickets/__tests__/getPaid.matrix.test.tsx (+ a parser test beside the model tests): discountsPence 0 / >0 / missing key / non-number x refunded 0 / >0 x disputed 0 / >0; assert the words appear only for the intended rows, the existing "Ticket money before Stripe's fees." sentence is unchanged, and no copy points at a control that is absent. RED FIRST against unfixed code.
- Do NOT touch p3/data/eventPage.ts, p3/screens/StatusSheet.tsx, the commandErrorMessage mapping or eventPage.matrix tests (another worker owns them until it merges).

## Live-rules read (prod counts only, read-only, no personal data)
Before building: SELECT counts of paid ticket_orders by (discount_pence = 0 vs > 0) and of orders with promo_code_id set; report in the PR body Shapes line. Confirm in the admin repo (git grep on origin/main) the RPC key exists: `discounts_pence` in 20270314170000_ticket_promo_codes_v1.sql.

## Done when
Consistency tests green incl. red-first proof; mutants checked by a sub-agent (drop the > 0 guard; swap gross and discounts; hide the line when refunded > 0); check:mojibake, tsc, lint for touched files; PR body per standing rules (Shapes surveyed label exactly; Phone QA with 390x844); 390x844 walk of You > Get paid on a prod-shaped account (an organiser with at least one discounted paid order) by the orchestrator before any pack.
