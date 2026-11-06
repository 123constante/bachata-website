# Brief: Sales report fix round 2 (review #1445)
Brief-version: 2
Branch: claude/ticket-sales-report-web
Lane: normal, Sonnet. Repo 123constante/bachata-website. One PR (existing #1445, head 5667d80f; push to the same branch).

## Goal
Fix the independent review findings on the sales report and guest list CSV: lost-dispute money, a raw BOM, thin CSV tests, and an early-return matrix test.

## What main lacks
- extends: the sales report disputed-order handling and Net line (PR #1445 open, not on main) -- #1445
- extends: the CSV BOM escape and leading newline neutralising in the report export (PR #1445) -- #1445
- extends: the report tests for lost dispute, leading zeros, unicode and 0-counted/notPaid-only shapes (PR #1445) -- #1445

## Files
- src/modules/organiser/p3/tickets/salesReportModel.ts (new)
- src/modules/organiser/p3/tickets/SalesReport.tsx (new)
- src/modules/organiser/p3/tickets/__tests__/salesReport.csv.test.ts (new)
- src/modules/organiser/p3/tickets/__tests__/salesReport.matrix.test.tsx (new)
- src/modules/organiser/p3/tickets/__tests__/salesReport.model.agree.test.ts (new)
(All exist only on the PR branch; check out claude/ticket-sales-report-web first.)

## What to build
Test-first: add the new rows and confirm they are RED against head 5667d80f before fixing.
0. INVENTORY.md already exists at docs/design/ticket-sales-report/INVENTORY.md on the branch: extend it with the disputed line (file:line) before building, and report the coverage count (items covered / total) at the end.
1. MAJOR money: salesReportModel.ts:58-63 and SalesReport.tsx:67,79. Disputed orders count in "sold" and gross, and Net = gross - refundedPence. A lost dispute (admin migration 20270304170000_ticketing_p2_hardening_v1.sql:421-427) sets status disputed, voids tickets and never sets refunded_pence, so a lost 12 pound order shows "1 sold, Taken 12.00, Refunded 0.00, Net 12.00" while the organiser keeps 0. Fix: show disputed orders as their own line (count and amount) and subtract them in Net. Say which approach in the PR body. Add a table-driven row for a lost-dispute order (expect Net 0.00).
2. MAJOR BOM: SalesReport.tsx:40 has a literal U+FEFF inside a template string. Use the \uFEFF escape. Add a test that no source file in the PR contains a raw U+FEFF.
3. MINOR CSV: csv.test.ts add leading-zeros rows (e.g. 007 phone/ref) and unicode rows. csvCell (salesReportModel.ts:102) must neutralise a leading \n and \r (as it does for = + - @); add rows.
4. MINOR matrix test: salesReport.matrix.test.tsx:41-42 returns early when the orders view is unreachable, so the 0-counted-orders label branch and the notPaid-only shape never render. Render them (fixture or mock) and assert the labels.
Not in scope: label wording dependency; note it in the PR body only.

## Do NOT touch
EventCalendar.tsx, calendar/CalendarGrid.tsx, calendar/CalendarListView.tsx, calendar/DayDetailModal.tsx, calendar/calendarUtils.ts, useCalendarEvents.tsx (density-exempt calendar files), src/components/ui/dialog.tsx, supabase/**, migrations, workflows, scripts/**, .env*, any file not listed under Files.

## Done when
One bot push; PR body keeps "## Verified on real data" (- Shapes surveyed: / - Checks run: / - NOT verified:) and "## Phone QA" (- Sizes checked: / - Walked: / - Not verified:); Not verified stays: 390x844 walk, CSV in Excel/Sheets, real data. Tests green; every CI job step that applies has been run and the per-job table is in the PR body; last commit subject ends with the [worker-done ...] marker.
