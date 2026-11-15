# Review of PR #1683 at head 1c85fbbc32729626ecf5a69a5bbc3ac3ba8d71a6

## Verdict: PASS WITH NITS

No must-fix. Two nits, neither blocks deploy ahead of admin #1384.

## Must-fix
None.

## Checks (ticketsApi.ts line numbers are at the PR head)
1. **Before the migration (RPC absent): OK.** `ticketsApi.ts:173-186` calls the RPC whenever `organiserId` is set. `missing` is true only for `error.code === 'PGRST202' || '42883'`. Then control falls to the table read at `:187-199`, which is the same select (`ORDER_SELECT_COUNTS`, no pence or buyer columns) that `main` runs today. Any other error, or `ok !== true`, hits `throw error ?? new Error(reason)` and is never swallowed into the table read.
2. **After the migration (RPC present): OK.** Every `fetchOrders` path with an `organiserId` returns from the RPC or throws, so the table read is only reached when the function is missing (before the migration) or when no `organiserId` is passed. `grep` of `src/` for `from('ticket_orders')`, `from("ticket_orders")` and `from('tickets')` finds only `ticketsApi.ts:188`. The only `fetchOrders` caller is `useSeriesOrders` (`p3/tickets/data.ts:83-87`), and it always passes `org.id` (`TicketsEntry.tsx:173`). No other caller selects a revoked column. `ORDER_SELECT_COUNTS` includes `status`, which is not in the kept list, but that select only runs while the migration is unapplied. The table path would break after the migration for a caller that omits `organiserId`. None exists today (see nit 1).
3. **Reply shape: judged from the handover and the test, not the migration.** The code needs `{ ok: true, orders: [...] }`, with each row carrying `id`, `ticket_type_id`, `quantity`, `status`, `paid_at`. The test fixture `countsRow` matches that, and `ok:false` plus `reason` is handled. I could not clone `bachata-admin` (see Not verified).
4. **No amounts, no throw on odd status: OK.** The counts reader sends no money keys, and `parseOrderRow` (`:151-162`) turns missing pence into 0 through `num()` and `buyer_name` into null. `status` is `String(r.status ?? '')`, so an unknown or missing value never throws. The test asserts pence 0 and `buyerName` null.
5. **Test: OK.** It covers the RPC path (the filter to the given type ids, and the table not touched), both fallback codes, the refusal, and a 42501 error that throws with `from` never called. If the fallback were widened to every error, the 42501 and `not_authorised` cases would fail (`from` would be called, and the throw would be missing). It also covers the no-`organiserId` table path, and `money: true` not calling the counts reader.

## Nits
1. `fetchOrders` with `organiserId` omitted still hits the table and silently stops working after the migration. It is safe today because there is one caller. Consider requiring `organiserId`, or a comment at `ticketsApi.ts:170`.
2. 42883 is also raised by a bad operator or function call inside a function body. A broken RPC body would silently fall back to the table. The risk is small and self-healing. Do not narrow it, since the brief names 42883.

## Verified
- `npx vitest run src/modules/organiser/tickets/__tests__/fetchOrders.rpc.test.ts` on the PR head: 1 file, 9 tests, all passed.
- The head of `origin/claude/ticket-orders-counts-rpc` is 1c85fbbc32729626ecf5a69a5bbc3ac3ba8d71a6.
- A grep of `src/`, `app/` and `scripts/` for direct `ticket_orders` reads.

## Not verified
- The admin migration `20261113144455_ticket_orders_owner_only_columns_v1.sql` on `claude/ticket-owner-only-money-partb`: no read access to `bachata-admin` from this sandbox. The reply shape (check 3) and the revoked-column set were taken from the brief.
- No browser walk or live data check. The RPC does not exist on production yet.
- `tsc` and the full CI chain were not run.
