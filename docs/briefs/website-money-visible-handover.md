# Handover: website money_visible / not_allowed (dt_4d3d118cffa1, round 2 on PR #1541)

## Done (review BLOCK at b8f369f fixed)
1. `ORDER_SELECT_COUNTS` no longer selects `buyer_name`; a counts-only reader's order title is `Order CODE` (`orderTitleFor`), line is quantity/day, tag is status. Test: counts select has no pence and no buyer_name (exact column list).
2. `moneyVisible.screens.test.tsx`: owner + money_visible false vs true control for GetPaid MoneySoFar, TicketsSoldTile, SalesReport + orders view. Mutation-proved: removing each of the three gates turns exactly the matching test red.
3. Orders `money` flag and `orderLineFor` role gate on `showMoney = canRefund(role) && summary.moneyVisible !== false` (fail closed).
4. `moneyVisible.matrix.test.ts` oracle is the explicit last column, not derived from the row name.
- Harness `countsOnlyOrder` mirrors the real select (no buyer_name); roles/managerReal tests updated to `Order CODE` for non-owners.

## Verified
- vitest src/modules/organiser: all pass after fixes (3 earlier failures were the buyer-name tests, fixed). check:mojibake clean.
- tsc -p tsconfig.app.json: 0 errors in files touched this round (4 pre-existing errors in untouched/pre-existing lines of p3/tickets).

## Not verified
- `npm run pre-ship` exits 1 in the sandbox: live-DB contract tests (eventViewCompat, occurrenceProgram, publicEventPageLineup: no network) and tests/integrityCouldNotRun.test.ts (environment). None touch this diff.
- Browser walk 390x844, read-only prod shape survey (no Supabase read run by this worker), CI per job.
