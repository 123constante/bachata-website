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

## Round 2 (review #1445, brief sales-report-fix2)

Done: disputed orders get their own line (count and amount) and are subtracted in Net (approach: separate line, not folded into Refunded; amount = totalPence - refundedPence); raw U+FEFF replaced by the `﻿` escape plus a test that no sales-report source has one; `csvCell` neutralises a leading LF; CSV rows for leading zeros and unicode; matrix test now renders `SalesReport` directly for the 0-counted, notPaid-only and lost-dispute shapes. Tests were RED (7 failures) on 5667d80f before the fix.
Left: nothing in scope. Label wording dependency not touched.
Not verified: 390x844 walk, CSV in Excel/Sheets, real data. tsc: 0 errors in p3/tickets files.

## Walk round (brief sales-report-walk, dispatch dt_b11f7bbf2bc9)

Done: `tests/e2e/walk-ticket-sales-report.spec.ts` (new, route-mocked, skips unless the P3 and ticketing flags are on) and the `ticket-sales-report` WALKS entry plus a narrow MAP row (SalesReport / salesReportModel / TicketsEntry) in `scripts/auto-walk-manifest.mjs`. No src/ change; the walk found no defect.

Pictures (390x844, written to `SALES_SHOTS`, default `test-results/ticket-sales-report/`; produced locally on the commit that carries this section, and CI "Auto-walk pictures" retakes them):
- `a-prod-shape.png`: 2 paid (one with a 100p fee), 3 refunded with fee, 3 expired (2 free). Standard: 3 sold, 3 refunded, 57 left of 60, Taken 64.00, Refunded 33.00, Net 31.00; "3 orders not paid, left out."
- `b-forty-paid.png`: 40 paid orders, two types, Standard sold out (0 left of 30). Taken 550.00, Net 550.00.
- `c-part-refunded.png`: paid order part refunded: Taken 40.00, Refunded 5.00, Net 35.00.
- `fixture-dispute.png`: FIXTURE ONLY. One disputed 12 pound order: Disputed line shows, Net 0.00.
- `e-nothing-paid.png`: pending and expired only: empty state, Download disabled with its reason.
- `f-contributor.png`: contributor role: report shows, no Refund control anywhere on the page.
- `guest-list.csv`: from scenario a; 5 rows plus header, placeholder names.

Reaching the shapes: the report mounts only after See all (needs 3+ shown orders). Scenarios d and e therefore open with 3 paid orders, then the mocked read changes, the frozen clock moves 120 s past the 60 s staleTime and a `visibilitychange` on `window` refetches. Scenario d is one 12 pound disputed order, as briefed.

Verified: fixture-fed render at 390x844 for all six scenarios with the visible numbers asserted against the fixture; geometry (no sideways scroll; every control on the card at least 44 px tall and inside 0..390); CSV bytes (BOM EF BB BF, CRLF, header, 5 rows, no `@`, no `pi_`/`cs_`/`ch_`, file name `guests-friday-bachata-2026-10-08.csv`). Red first: changing the refunded amount in fixture a from 1100 to 1000 failed the spec (Refunded 33.00 expected, 30.00 received); reverted. 6 of 6 pass locally; `tests/autoWalkManifest.test.ts` 40 pass, `auto-walk-manifest.mjs --self-test` OK; vitest p3/tickets 325 pass; check:mojibake clean.
Not verified: the CSV opened in real Excel or Sheets; a real disputed order (fixture only); the signed-in screen on prod data (prod has 8 orders, none visible to the walk account); the CI-taken pictures (not read yet).
tsc: `npm run typecheck` has existing errors in app/ files only; 0 errors in the files this round touched.
