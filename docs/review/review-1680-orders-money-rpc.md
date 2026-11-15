# Review carried to PR #1680 (bot re-push of #1677, same commit 0bf9bef00)

Verbatim copy of the independent review docs/review/review-1677-orders-money-rpc.md (branch claude/review-1677). PR #1680 head is the identical commit, so the verdict applies unchanged.

---

# Review: Website PR #1677 — orders money read via `ticket_orders_for_organiser_v1`

## Hard-tier: PASS

- PR: #1677, branch `claude/ticket-orders-money-rpc-fast`
- Head SHA reviewed: `0bf9bef00068c51a41a79a748cdb562fcd207721` (2 commits over `main` 82bf2a4: 4865f76, 0bf9bef)
- Admin function read at: `123constante/bachata-admin` branch `claude/ticket-owner-only-money-partb` @ `ac3052e`,
  `supabase/migrations/20261113144455_ticket_orders_owner_only_columns_v1.sql`
- Brief: `brief/review-1677:docs/briefs/review-1677.md`
- Reviewer: independent cloud worker, review-only (no PR code changed, nothing merged, prod SELECT only).

No must-fix remains. Findings 1–5 answer the brief's five checks; 6–9 are should-fix / notes, none blocking.

## Findings

1. **Callers — OK.** `fetchOrders` has exactly one production caller: `useSeriesOrders`
   (`src/modules/organiser/p3/tickets/data.ts:87`), now `fetchOrders(typeIds, { money, organiserId })`. `money` is
   always a boolean from `TicketsEntry.tsx:171`: `showMoney = canRefund(org.role) && summary.data?.moneyVisible === true`
   (`canRefund = isOwner`). A manager (or a failed/loading summary) gets `money: false`, and `money !== false` is the
   RPC gate, so a manager can never reach the RPC. An owner with `moneyVisible` always does (`organiserId` is `org.id`,
   always set). Even if a client bug sent a manager down the RPC path, the server refuses (`_ticket_can_handle_money_v1`
   = platform admin or owner seat) and the Website throws (finding 2) — fail closed. Platform-admin-without-owner-seat
   falls under `canRefund(org.role)` exactly as before this PR (no regression; not in scope).

2. **Error handling — OK.** Success only when `!error && res.ok === true && Array.isArray(res.orders)`. Fallback only
   when `error.code` is `PGRST202` or `42883`. Everything else throws: `{ok:false, reason}` throws `reason`; any other
   PostgREST error throws the error; `ok:true` without an array throws `orders_not_allowed`. No path returns partial
   data silently. Contact fields: the Website maps rows through `parseOrderRow`, which keeps exactly the old
   `ORDER_SELECT_MONEY` set (id, ticket_type_id, buyer_name, quantity, subtotal/booking_fee/total/refunded pence,
   status, paid_at); the React Query cache holds only parsed `Order`s. See note 6 on the wire payload.

3. **Admin function shape — matches.** The function returns `{ok:true, orders: jsonb_agg(to_jsonb(o) ORDER BY
   o.created_at DESC, o.id)}` or `{ok:false, reason:'not_allowed'}`. `to_jsonb(o)` carries every column under its
   column name, so `ticket_type_id`, `buyer_name`, the pence keys, `status`, `paid_at` parse as the table read did,
   and the sort order equals the old `.order('created_at', desc).order('id')`. `coalesce(..., '[]')` means an
   organiser with no orders gets `orders: []` (array, not null) → empty list, not an error. Arg name `p_organiser_id`
   matches. Deploy order: the migration creates the function and revokes the columns in one transaction, so there is
   no committed state "columns revoked, function missing". Prod today (read 2026-11-15): function absent,
   `authenticated` still has table SELECT → the PR runs the fallback, same as `main`.

4. **Unit test — meaningful, passes.** `npx vitest run src/modules/organiser/tickets/__tests__/fetchOrders.rpc.test.ts`
   at the head: **4/4 passed**. Mutants run locally against it:
   | Mutant | Caught? |
   |---|---|
   | M1 remove the ticket-type filter | yes |
   | M2 remove the fallback (never "missing") | yes |
   | M6 drop `42883` from the missing codes | yes |
   | M3 drop the `opts.organiserId` guard (RPC called with `undefined`) | **no** |
   | M4 `money !== false` → `money === true` (undefined no longer takes the money path) | **no** |
   | M5 drop `res.ok === true` (relies on `Array.isArray` alone) | **no** |
   Also uncaught: the counts-only test does not assert the table select is `ORDER_SELECT_COUNTS`
   (other matrix tests — `ticketsMoney.matrix`, `moneyVisible.matrix` — cover the select choice), and no test asserts
   the parsed pence values from the RPC rows. M3–M5 are harmless with today's single caller (always passes a boolean
   and an id; the server never sends `ok:false` with an array), so they are **should-add** cases, not must-fix:
   `{money:true}` without `organiserId` → table read, no RPC; `{ok:false, orders:[…]}` → throws.

5. **Pagination — no regression risk today; watch item.** The RPC returns every order of the organiser in one jsonb
   (no 100-row PostgREST cap applies to a function's scalar jsonb return), then filters client-side. Prod counts
   (read-only, no personal data): 6 orders total, 2 organisers, max 4 per organiser, max 3 per ticket type, 0 rows
   whose `organiser_id` differs from its ticket type's `organiser_id`, 0 nulls (both columns NOT NULL). So the
   RPC's `WHERE organiser_id = …` returns the same rows the old `.in('ticket_type_id', …)` read did, and nothing is
   lost to paging. Risk at scale: payload grows with the organiser's **all-series** order count, not the series'
   (an organiser with thousands of orders downloads all of them per Tickets sheet). Not a correctness bug; a
   `p_ticket_type_ids` / `p_series_id` filter (or limit/offset) on the admin side is the eventual fix.

6. **Note (admin-side, not this PR): the wire payload over-shares.** `to_jsonb(o)` sends the full row —
   `buyer_email`, `unit_price_pence`, `discount_pence`, Stripe account / checkout / payment-intent ids, `buyer_user_id`
   — to the owner's browser, for every series. This is within MONEY-RULES (owner/admin only, server-enforced), and the
   Website drops it at parse, but it is wider than the old `ORDER_SELECT_MONEY` on the network. Recommend admin #1384
   project an explicit `jsonb_build_object(...)` of the needed keys. Flag to the admin reviewer; not a Website must-fix.

7. **Note: transient window after apply.** If PostgREST's schema cache has not reloaded when the migration lands, the
   RPC answers `PGRST202` while the columns are already revoked → fallback table read with money columns → `42501`
   → thrown error (owner sees the orders error state until the cache reloads, normally seconds). Fails closed; no
   leak. Acceptable.

8. **Note: thrown value is a PostgREST error object, not an `Error`.** `throw error` matches the existing table-read
   pattern in this file; consistent, no change asked.

9. **Note: `orders_not_allowed` is used for "ok:true but orders not an array"** — a malformed-reply case labelled as a
   refusal. Cosmetic; fail-closed either way.

## Verified

- Diff read in full at `0bf9bef` (3 files: `ticketsApi.ts`, `p3/tickets/data.ts`, new test).
- Every `fetchOrders(` call site (`git grep` at head): one, `data.ts:87`; `money` derivation traced to
  `TicketsEntry.tsx:171`.
- Admin migration read in full; return keys, sort order, refusal shape and transaction ordering compared.
- Unit test run at head: 4/4 pass; 6 mutants run (3 caught, 3 not — listed in finding 4).
- Prod `stsdtacfauprzrdebmzg`, SELECT only, counts/catalogue only: totals above; function absent; table SELECT
  still granted to `authenticated`.

## Not verified

- No browser walk (review-only; no UI change in the PR, and the RPC does not exist on prod so the new path cannot be
  exercised live).
- PR #1677's CI check results (no GitHub API used per run rules).
- The RPC path against a real database (function not applied anywhere this worker can reach).
- `_ticket_can_handle_money_v1` body (#1464) not re-read; taken as described in the #1384 header.
