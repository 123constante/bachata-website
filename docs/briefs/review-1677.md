# Brief: independent hard-tier review of Website PR #1677

Repo: 123constante/bachata-website. Review-only worker; do not change PR code, do not merge, no prod writes (Supabase read-only SELECT).

PR #1677 (branch claude/ticket-orders-money-rpc-fast): the organiser orders list money path (`fetchOrders` in src/modules/organiser/tickets/ticketsApi.ts) now reads RPC `ticket_orders_for_organiser_v1(p_organiser_id)` and filters to the series' ticket types; if the function is missing (PGRST202/42883) it falls back to the table read so the Website can deploy BEFORE admin #1384 revokes the money columns. Counts-only path (managers) must not call the RPC. Rule (MONEY-RULES, owner 2026-11-13): money/contact visible only to organiser owner and platform admin, enforced server-side.

Check at the PR head SHA:
1. Callers: who passes `money` and `organiserId` (src/modules/organiser/p3/tickets/data.ts and any other); a manager can never reach the RPC path; owner/admin always can.
2. Error handling: refusal or non-missing error throws; only PGRST202/42883 falls back; no silent success with partial data; no leak of buyer contact fields beyond what the old ORDER_SELECT_MONEY showed (id, ticket_type_id, buyer_name, quantity, pence, status, paid_at).
3. Admin function shape: read the admin migration for ticket_orders_for_organiser_v1 (admin PR #1384, branch claude/ticket-owner-only-money-partb, supabase/migrations/*ticket_orders_owner_only_columns_v1.sql): the return keys the Website parses (ok, orders[], ticket_type_id, ...) match it.
4. Unit test src/modules/organiser/tickets/__tests__/fetchOrders.rpc.test.ts: meaningful (would fail if the fallback or the type filter were removed). Name any mutant it would not catch.
5. Pagination: the RPC returns all rows; note if the old path's 100-row paging has a regression risk for big series (read-only counts of ticket_orders per organiser on prod stsdtacfauprzrdebmzg, no personal data).

Output: docs/review/review-1677-orders-money-rpc.md on branch claude/review-1677 with a first-level line `## Hard-tier: PASS` or `## Hard-tier: FAIL`, the head SHA reviewed (must equal the PR head), and numbered findings. PASS only if no must-fix remains. Push the branch, stop.
