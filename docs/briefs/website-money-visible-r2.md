# Brief: continuation on claude/ticket-money-visible (PR #1541), fix review BLOCK at b8f369f9e
Lane careful. Same branch, same PR. Visibility/copy only; no migrations, no money logic.
Independent review (opus) = BLOCK on item 1; fix 1-4, then finish the hand-off the first worker left open.
1. HIGH: ticketsApi.ts:163 ORDER_SELECT_COUNTS selects buyer_name for managers (fetchOrders money:false, TicketsEntry.tsx:159, shown via buyerFirstAndCode ~:294). Contract: managers make NO direct ticket_orders buyer_name/pence read. Drop buyer_name from the counts select; the manager order line shows order code/ticket type/quantity/status only (no empty-looking gap, no copy pointing at a missing name). Add a test that the counts select contains neither pence nor buyer_name.
2. MEDIUM: component tests rendering owner role + money_visible:false for GetPaid MoneySoFar (GetPaid.tsx:196), TicketsSoldTile (:278) and SalesReport (TicketsEntry.tsx:474): counts shown, no pound amounts. Must go red if a gate is removed (prove by mutation locally).
3. LOW: gate the orders `money` flag also on summary.data?.moneyVisible !== false (TicketsEntry.tsx:159 and orderLineFor), fail closed.
4. LOW: moneyVisible.matrix.test.ts:43 oracle must be an explicit expected column, not derived from the test name.
5. Fill the PR body in place: Verified on real data (read-only prod shapes: 5 ticket_orders, 21 owner/43 manager seats; no personal data), checks run, NOT verified; Phone QA with 390x844 walk owner vs manager (or say not walked). Per-job CI table. Run npm run pre-ship. Push once.
Worker never merges/approves.
