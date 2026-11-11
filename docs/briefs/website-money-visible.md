# Brief: Website money_visible / not_allowed (Tickets, slice 2 Part B Website half)
Lane: careful (money-adjacent; visibility and copy only, no price/refund/payout logic change). Zero migrations here.
Branch: claude/website-money-visible. Reviewer must be a different model from the builder.

## Contract (admin PR #1464, branch claude/organiser-slice2-part-b-impl)
- `ticket_sales_summary_v1/v2` returns top-level boolean `money_visible`. Owner seat or platform admin: true. Manager: false and every `*_pence` is absent/null.
- `ticket-refund` edge: non-owner gets HTTP 403 `{ok:false, reason:'not_allowed'}`; no access gets 404 `not_found`.

## Change (all in src/modules/organiser/tickets + p3/tickets)
1. `parseSummary` (ticketsApi.ts): read `money_visible`. If it is `false`, force counts-only (strip `*_pence`) whatever the caller's `money` option says. Return it on `SummaryResult` (`moneyVisible: boolean | null`, null when the server omits it = old server).
2. Fail-closed: `data.ts` `useSummary` money=true default must not fail open; callers that cannot prove owner/admin pass money=false. Screens hide every pence figure when `moneyVisible === false`.
3. Refund 403: edge reply 403 `{reason:'not_allowed'}` -> `refundOrder` `{kind:'failed', reason:'not_allowed'}` -> NOT_OWNER_REFUND copy ("Ask the owner to refund this order."). Add the missing test row end to end (invokeEdge/classifyEdge -> refundReasonMessage -> sheet text). Classify `not_allowed` as a DEFINITE refund failure (new key on retry), add to DEFINITE list in refund.partial.test.tsx.
4. No direct `ticket_orders` buyer_name/pence reads for managers: keep ORDER_SELECT_COUNTS for non-money; confirm by grep and a test that the manager path never selects `*_pence`.

## Tests (table-driven, red first, screen x shape)
Shapes: owner money_visible true; manager false; field missing (old server); admin; empty types; type with zero sold; refunded orders. No copy pointing at a missing control; empty states say what to do.

## Done
`npm run pre-ship`; PR body with per-job CI table and "Verified on real data" (read-only prod shape counts, project stsdtacfauprzrdebmzg, no personal data, no writes; 5 ticket_orders, 21 owner/43 manager/0 contributor); screenshots at 390x844 for owner vs manager. Source files over 2 KB: scripts/safe-edit.py or safe-write.py. JSX entities, no raw Unicode punctuation.
