# Handover: ticket-sales-report-web
Done: salesReportModel.ts, SalesReport.tsx (lazy), wiring in TicketsEntry orders view, csv + matrix tests, INVENTORY, design record.
Left: phone walk pictures (no browser or prod data in this run); bundle-budget before/after; small-list entry point; admin migration read. Merged origin/main (one import conflict in TicketsEntry.tsx), p3/tickets 287 tests pass, tsc 0 errors in p3/tickets.
tsc run: 0 errors in p3/tickets files. check:mojibake clean. vitest p3/tickets: 158 pass.

---

## 2026-11-06 — server-totals agreement and CSV test split (dispatch dt_b3adb6ad13ba)

Brief: `brief/ticket-sales-report-web:docs/briefs/sales-report-agree-and-split-tests.md` (v2).

### Done
- `__tests__/salesReport.model.agree.test.ts` (new): one fixture (paid with fee, part refunded, fully refunded, discounted, disputed, free, pending, expired). `serverRow` copies the `ticket_sales_summary_v1` rules, for this test only. Refunded agrees with `totalsOf`. Gross = server gross + paid booking fees + totals of refunded and disputed orders. Net = gross - refunded.
- Card label `REPORT_SOURCE_TEXT` (in `salesReportModel.ts`, shown only when there are orders): "From the orders above. Includes booking fees and refunded or disputed orders; Money so far on Get paid counts paid orders only." Changes from the brief's wording: "above", because the orders card renders above the report; "Money so far on Get paid", because that card is not on this screen.
- Row and total money now read "Taken" instead of "Paid" (the gross includes refunded and disputed orders).
- CSV: `escapes injection and quoting` split into one test per rule: it.each for = + - @ tab CR, plain cell, quote doubling, comma, CR/LF, and the buyer name through guestListCsv.
- Red-first (each mutation reverted afterwards): dropping a character from the neutraliser fails only its own row ('=' also fails the buyer-name test, because that name starts with '='). With no quote doubling, the quote test fails, plus the buyer-name test (the name holds quotes). With no comma quoting, only the comma test fails. With no CR/LF quoting, only the CR/LF test fails. When guestListCsv skips csvCell for the buyer name, only the buyer-name test fails.

### Left / next
- `serverRow` is a hand copy of the SQL, so it cannot catch drift in the admin repo. A contract test against live `ticket_sales_summary_v1` would.
- A cell that starts with LF is not neutralised (the regex covers tab and CR only). Nothing proves whether that is intended.
- The matrix never reaches the orders view with 0 counted orders (it needs more than 2 orders), so "label hidden when empty" is never exercised.
- 390x844 walk not done; CSV not opened in Excel.
- typecheck run on 3f20e10 (npm run typecheck, tsconfig.app.json): 0 errors in branch files (119 total, the same with and without this diff).
