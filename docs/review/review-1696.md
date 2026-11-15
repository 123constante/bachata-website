# Review: PR #1696 (Website) — ticket reserved_count off the client

PR #1696, branch claude/reserved-count-off-types, head c1fe43d40fd65ad7d098452b456f5b636f09aa7a
Reviewer: independent, review only, no product code edited. Checked out the head in a worktree.

## Findings

1. **No remaining client read of `ticket_types.reserved_count` — PASS.**
   Grepped src, supabase, scripts, api, app, tests. Only two client reads of the table exist:
   `ticketsApi.ts:155` `.from('ticket_types').select(TYPE_COLS)` (list now has no `reserved_count`, and `TYPE_COLS`
   is exported and asserted by test) and `ticketsApi.ts:270` `select('kind, valid_from, valid_to')`.
   No `select('*')`, no `ticket_types(...)` embed, no realtime channel on the table, no edge function mention.
   `ticketsApi.ts:95` reads `r.reserved_count` but from the `ticket_sales_summary_v1` RPC JSON (not the table), which is the intended source.
   Remaining `reserved_count` hits are test fixtures/mocks and generated `types.ts` (type only). No BLOCK.
2. **Unknown-count paths fail closed — PASS.**
   `parseTypeRow` starts `reserved:0, reservedKnown:false`. `withReserved` leaves unknown when the summary is undefined, `ok:false`, or lacks the type.
   `useSeriesTypes` (data.ts:69) holds `data` undefined and `isPending` true until the summary settles; on summary error the types load with all unknown.
   `moveBlock` refuses on_sale when `reservedKnown === false`; `TypeSheet` disables Save and `submit` returns early for a saved type with unknown count (capacity cut below sold impossible); new tickets are not blocked.
   Pausing and other moves stay possible (tested).
3. **Money vs non-money seat — PASS (RPC body not verifiable here).**
   Client is a pure pass-through of the RPC's `reserved_count`; owner numbers unchanged, non-money seats get the server-compensated value.
   This repo has no migrations, so the "raw + refunded_qty" body could not be confirmed here — verify in the admin repo. The summary is requested with the seat's own `money` flag, so no extra pence leakage (parseSummary still strips `_pence` for non-money).
4. **Public / door / checkout untouched — PASS.** Diff touches only organiser tickets module, tests, handover doc. Public checkout uses `ticket_types_public_v2/v3` RPCs; unaffected.
5. **Tests — PASS.** At head: 42 files / 2580 tests pass. With the five product files reverted to main and the new tests kept: 17 of 20 new tests fail (select string, withReserved matrix, useSeriesTypes pending/error/shared query, TypeSheet save-disabled, selling switch). They do bite on revert.
6. **Walk-spec mock edits — PASS WITH NIT.** Five specs now return the types in the `ticket_sales_summary_v1` mock so `reservedKnown` becomes true; shape (`id`, `reserved_count`, ...) matches what `parseSummary` reads. Not run in a browser here.

## Nits (non-blocking)

- `leftOf` / `salesReportModel.remaining` / `hasOrdersOf` (`t.reserved > 0`) still read `reserved` and show "N left" = full capacity while a type is unknown (summary failed or type missing). Display only; decisions are guarded, and `hasOrdersOf` also uses summary order counts. Consider hiding the count when `reservedKnown` is false.
- Walk mocks still include `reserved_count` in the `ticket_types` table mock, so e2e would not catch a re-added table read; the unit test on `TYPE_COLS` does.
- Not verified: e2e walk specs, tsc, RPC SQL body.

## Verdict: PASS WITH NITS
## Hard-tier: PASS
