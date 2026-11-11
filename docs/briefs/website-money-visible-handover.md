# Handover: website money_visible / not_allowed (dt_58d19716243c)

## Done
- `parseSummary` reads `money_visible`; false forces counts-only whatever `money` says; `SummaryResult.moneyVisible` (null = old server or refusal).
- `useSeriesOrders` money flag is now required (no fail-open default).
- GetPaid money block, Home tickets tile and Sales report hide pence when `moneyVisible === false`.
- Refund 403 `not_allowed`: new `moneyVisible.matrix.test.ts` (classifyEdge, refundOrder, NOT_OWNER_REFUND copy; 404 not_found); `not_allowed` added to the DEFINITE list in refund.partial.test.tsx (code already classified it).
- Manager order read: test that `fetchOrders({money:false})` selects ORDER_SELECT_COUNTS only (no pence).

## Left / next
- Open the PR (body labels per task prompt), per-job CI table, `npm run pre-ship`, `/code-review` by a different model.
- Browser walk 390x844 owner vs manager; read-only prod shape survey.

## Verified / Not verified
- Verified: vitest on src/modules/organiser/{tickets,p3/tickets}: 2356 pass; check:mojibake clean; tsc (tsconfig.app.json) shows no errors on lines I changed (148 total, pre-existing; baseline in pre-ship.mjs).
- Not verified: pre-ship, CI, phone walk, prod shape survey, code review.
