# Handover: tickets layout (Option A)

Done: Tickets is inline on the event page (stats row, notes, get-paid banner, types, Add a ticket, promo, orders preview). The only sheet left is the orders view (`tix-orders-sheet`, See all). The inline section carries `tix-tall` so older tests find it; `tix-row` is now a heading, not a button. Stats: sold of capacity, plus takings after refunds (`showMoney`) or order count. No checked-in number: the summary carries none.
Tests: `tickets.layout.matrix.test.tsx` added; `stack.draft` and `typeSheet.connectInline` adjusted for the removed base sheet. 1027+45 organiser ticket tests green.
Left: 390x844 browser walk with flags on; prod shape survey; `check:bundle-budget` main vs branch; e2e specs that click `tix-row` or look for `tix-tall` as a sheet (walk-p3-promo-codes, p3-toast-geometry) were not run; `npm run pre-ship`.
tsc run on the branch head: 0 errors in branch files. Coverage: 15 of 17 inventory rows placed.

## Continuation worker (dt_25fbf453d04e)
Done: step 1 (tsc: 0 errors; `test:unit`: 15 failures, all live-DB contract tests `eventViewCompat`, `occurrenceProgram`, `publicEventPageLineup` plus `integrityCouldNotRun`, none in files this branch touches); step 2 (matrix: added owner with `moneyVisible` false x every shape, 57 tests green; `showMoney` untouched); step 3 partly (removed the now-pointless `tix-row` clicks in 6 e2e specs).
E2E run locally with both flags on (never committed): 9 passed, 16 failed. Same specs on `origin/main`: promo "list" test and sales-report "f: contributor" ALSO fail there, so they are not this branch.
Branch-only failures to fix next:
- `walk-p3-promo-codes` "a locked code": Save changes bottom is 909 > 844 (edit sheet no longer fits the 390x844 viewport; passes on main).
- `walk-ticket-sales-report` a-e: `tix-report-money` / `tix-report-total-money` not found. The spec's `ticket_sales_summary_v1` mock returns `{ ok: true, ticket_types: [] }` with no `moneyVisible`, so `showMoney` is false. Probably the fixture, not the gate: update the mock to return `moneyVisible: true`; do NOT loosen `showMoney`.
- `p3-gate-overlays` (2 tests) and promo row count (6 vs 4: the `^promo-row-` regex now also matches child testids): not checked against main.
Left: steps 4 (bundle budget), 5 (prod shape survey), 6 (walk), 7 (INVENTORY file:line + 6 rows), 8 (`pre-ship`), 9 (PR body).
