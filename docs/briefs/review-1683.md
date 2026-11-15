# Independent review: Website PR #1683 at head 1c85fbbc32729626ecf5a69a5bbc3ac3ba8d71a6 (branch claude/ticket-orders-counts-rpc)

Read-only review. Do NOT edit the PR branch. Push ONLY one new file, on branch `claude/review-1683`: `docs/review/review-1683-counts-rpc.md`. No PR is needed for the review branch.

## What the PR does
3 files, +76 / -7: `src/modules/organiser/tickets/ticketsApi.ts` (fetchOrders counts path), `src/modules/organiser/tickets/__tests__/fetchOrders.rpc.test.ts`, `docs/handover/ticket-orders-counts-rpc.md`.
The counts path of `fetchOrders` now reads the RPC `ticket_order_statuses_for_organiser_v1(p_organiser_id uuid)` and falls back to the old `ticket_orders` table read only when the RPC does not exist yet (PostgREST PGRST202 or Postgres 42883). Reason: admin PR 123constante/bachata-admin #1384 revokes the money and contact columns of `ticket_orders` from `authenticated`, so the old table read would fail for every organiser seat after that migration is applied. This PR must be live on production BEFORE that migration is applied, and must also work TODAY while the RPC does not exist on production.

Read the diff: `git fetch origin main claude/ticket-orders-counts-rpc` then `git diff origin/main...origin/claude/ticket-orders-counts-rpc`.

## Check, with file:line evidence
1. Before the migration (RPC absent): the fallback fires on exactly the "function not found" errors (PGRST202, 42883) and the result is the same as on main today. Any OTHER RPC error is surfaced, not silently swallowed into the table read.
2. After the migration (RPC present; table columns revoked): no code path reached from `fetchOrders` (counts path AND the list path) still selects a revoked `ticket_orders` column directly. The revoked set is everything EXCEPT: id, ticket_type_id, organiser_id, buyer_user_id, quantity, currency, email_status, created_at, paid_at, dispute_status, disputed_at, email_attempts, promo_code_id, promo_use_released, occurrence_id, line_count, hold_expires_at, reserve_version. Name any other caller in `src/` that selects a revoked column from `ticket_orders` or `tickets` (grep `from('ticket_orders')` and `from("ticket_orders")`); a caller that would break after the migration is a must-fix unless it already has its own RPC path.
3. The reply shape the code expects from `ticket_order_statuses_for_organiser_v1` matches the function in the admin repo migration `supabase/migrations/20261113144455_ticket_orders_owner_only_columns_v1.sql` on branch `claude/ticket-owner-only-money-partb` of https://github.com/123constante/bachata-admin (clone read-only if you can reach it; if you cannot, say so under Not verified and judge from the PR's handover doc and test).
4. The counts shown to a manager seat carry no amounts, and nothing in the mapping throws on an unknown or missing status value.
5. The new test exercises both the RPC path and the fallback path and would fail if the fallback condition were widened to every error. Run it: `npm ci --ignore-scripts` then `npx vitest run src/modules/organiser/tickets/__tests__/fetchOrders.rpc.test.ts`. Report the result.

## The review file
First lines, exactly this shape (the merge gate parses it):

```
# Review of PR #1683 at head 1c85fbbc32729626ecf5a69a5bbc3ac3ba8d71a6

## Verdict: PASS
```

Use `## Verdict: PASS`, `## Verdict: PASS WITH NITS` or `## Verdict: BLOCK`. BLOCK only for a must-fix: a real break before or after the migration, or money data reaching a non-owner seat. Then: must-fix items (file:line), nits, Verified, Not verified. Keep it under 80 lines.

If `origin/claude/ticket-orders-counts-rpc` is no longer at 1c85fbbc, review the head you find and write THAT full sha in the first line.
