# Handover: ticket-sales-report-walk

Carries the 390x844 walk for the sales report that merged in #1445. Tests and the auto-walk manifest only; no src/ change. Text moved from the stranded handover section on claude/ticket-sales-report-web (85e0de805). Note: the walk round below was written before the CI pictures were read; the pictures named were taken in the worker sandbox and are retaken by CI Auto-walk pictures on this PR.

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
