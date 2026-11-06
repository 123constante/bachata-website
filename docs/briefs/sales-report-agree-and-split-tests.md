# Sales report: server totals agreement and CSV test split

Brief-version: 2
Lane: normal (Opus). Continue ON existing branch `claude/ticket-sales-report-web` (PR #1445). Never recreate it. Bot push, one final push, never merge or approve.

## Finding (prod `ticket_sales_summary_v1`, read-only, 2026-11-06; admin 20270314170000_ticket_promo_codes_v1.sql)
Server `gross_pence` = sum(subtotal_pence - discount_pence) over status = 'paid' ONLY (excludes booking fee, refunded and disputed orders). `refunded_pence` = sum(refunded_pence) over ALL statuses. `discounts_pence`/`booking_fees_pence` paid only. The report's gross = sum(totalPence) (includes the booking fee) over paid + refunded + disputed. So the report gross CANNOT equal the server gross on any fixture with a fee, a refunded or a disputed order; refunded can agree. Decision: do not copy the server arithmetic; LABEL the card.

## What main lacks
- A test tying report totals to the server summary shape -- grep: totalsOf in src/modules/organiser/p3/tickets/__tests__/ (none; verify with `git show origin/claude/ticket-sales-report-web:src/modules/organiser/p3/tickets/__tests__/salesReport.matrix.test.tsx`)
- Card wording that says the figures come from the orders list, not the server total -- grep: from the orders below in src/modules/organiser/p3/tickets/SalesReport.tsx (absent on PR head)
- One CSV test per escaping rule -- src/modules/organiser/p3/tickets/__tests__/salesReport.csv.test.ts line 35 has one combined test `escapes injection and quoting` (#1445)

## Files
- src/modules/organiser/p3/tickets/__tests__/salesReport.csv.test.ts
- src/modules/organiser/p3/tickets/__tests__/salesReport.model.agree.test.ts (new)
- src/modules/organiser/p3/tickets/SalesReport.tsx (label text only)
- src/modules/organiser/p3/tickets/salesReportModel.ts (only if a shared helper is needed; no second copy of server maths)

## Deliverables
1. Agreement test on ONE fixture (paid, part-refunded, fully refunded, disputed, free, pending, expired; one order with a booking fee and one with a discount). Build a `TypeSales` row per ticket type from the same fixture following the server rules above, then assert: report refundedPence === totalsOf(rows).refundedPence (must agree); report grossPence === totalsOf(rows).grossPence + booking fees of paid orders + total of refunded and disputed orders (the documented difference), netPence === grossPence - refundedPence. Add the label on the card: "From the orders below. Includes booking fees and refunded or disputed orders; the Money so far figure counts paid orders only." (British English, wording yours if shorter). No flag changes.
2. Split `escapes injection and quoting` into one test per rule: formula neutraliser (one `it.each` row each for =, +, -, @, tab, CR), quote doubling, comma quoting, CR/LF quoting, and the buyer-name formula through guestListCsv. For each, red-first by mutating the matching line in `csvCell` (revert after) and recording that exactly that test fails.
3. PR body update: labels per CLAUDE.md; add the server-gross finding above; Not verified stays honest (390x844 walk not done; CSV not opened in Excel). Both check-pr scripts exit 0 before the final push.

## Limits
Tests and model/label only. Run the affected vitest files plus lint chain steps that apply; per-job table in PR body.
