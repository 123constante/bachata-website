# Brief: sales report 390x844 walk (route-mocked Playwright spec + auto-walk entry), continuation on Website PR 1445

Brief-version: 1
Branch: claude/ticket-sales-report-web
Lane: normal, Sonnet, CONTINUATION on the same branch and the same PR (Website PR 1445). bachata-website; tests, scripts/auto-walk-manifest.mjs and docs only, NO src/ change (if the walk exposes a real defect in src/, stop and write it in the handover; do not fix it). Money-adjacent: you never approve or merge. ONE push at the end.
Serves: the organiser who opens Tickets > See all and reads the sales report on a phone; and the reviewer who needs 390x844 pictures of it.

## Why
The report card mounts only in the Tickets sheet orders view (see TicketsEntry.tsx: view === 'orders', reached by the tix-see-all button when there are more than 2 orders). Prod has 8 ticket orders in total (paid 2, refunded 3, expired 3, 0 disputed), none visible to the walk test account, and creating orders is a prod write. So the walk is route-mocked, the way tests/e2e/ticket-door-scanner.spec.ts is. No phone picture of the card exists yet; the PR body says "390x844 walk: not run".

## Files
tests/e2e/walk-ticket-sales-report.spec.ts (new)
scripts/auto-walk-manifest.mjs (exists: add one WALKS entry and one MAP row)
tests/e2e/helpers/organiserFake.ts (exists: read only; import OrganiserFake, FRIDAY, PHONE, json, expectNoHorizontalScroll; do not edit unless a read you need is unmocked, then add the smallest mock and say so)
src/modules/organiser/p3/tickets/TicketsEntry.tsx, SalesReport.tsx, salesReportModel.ts (read only: the reads, labels and test ids)
docs/handover/ticket-sales-report-web.md (exists: add a "Walk round" section)

## What to build
1. The spec, modelled on ticket-door-scanner.spec.ts: viewport 390x844, NOW from the fake, pictures to `process.env.SALES_SHOTS ?? 'test-results/ticket-sales-report'`. Flags: skip itself unless VITE_ENABLE_ORGANISER_P3 and VITE_ENABLE_ORGANISER_TICKETING are 'true'. Open the Tickets sheet for the FRIDAY series, route-mock the ticket types read and the orders read in their LIVE shapes (read the hooks that TicketsEntry uses and copy the shapes from the code, not from memory), click tix-see-all, wait for the report card.
2. Scenarios, one picture each, with a plain assertion of the visible numbers against the fixture (so a wrong sum fails the test):
   a. prod shape today: 2 paid (one with a booking fee), 3 fully refunded with a fee, 3 expired (2 free). Counted = paid + refunded.
   b. all paid, 40 orders, two ticket types, one sold out (the over-the-cap list shape; scroll to the card).
   c. part-refunded paid order.
   d. lost dispute (fixture only, label the picture name `fixture-dispute`): the Disputed line shows and Net is 0.00 for a 12 pound order.
   e. notPaid-only (pending and expired, nothing counted): the empty state and a disabled download that says why.
   f. contributor (not a manager): the report shows, no refund control on the card.
3. Geometry on every scenario: no horizontal scroll, every visible control on the card at least 44 px tall and inside 0..390 wide (copy the door spec's `geometry` helper pattern, scoped to the card).
4. CSV: in scenario a, click the download, capture the download in Playwright, and assert it starts with the BOM, uses CRLF, has no email column and no Stripe id (search the file for `@` and `pi_`/`cs_`/`ch_`). Save it to the pictures folder as `guest-list.csv` (placeholder names only; the fixture holds no real person).
5. Manifest: add `'ticket-sales-report': smoke('walk-ticket-sales-report', { env: { ...P3, VITE_ENABLE_ORGANISER_TICKETING: 'true' }, shotsEnv: 'SALES_SHOTS' })` to WALKS and a MAP row (narrow, above any broad p3 row) sending `^src/modules/organiser/p3/tickets/(SalesReport|salesReportModel)\.` and `TicketsEntry.tsx` to ['ticket-sales-report']. Run whatever test pins the manifest (grep tests for auto-walk-manifest) and keep it green.
6. Run the spec locally only if free RAM allows (check first); otherwise let CI "Auto-walk pictures" run it and read its uploaded pictures. In the handover list every picture file and what it shows.

## Tests / red first
The assertions in step 2 must be able to fail: mutate one fixture total once (change a refunded amount in the fixture, not in src) and record that the spec goes red, then revert. Run tests/e2e spec via the flag command in the door spec header, the manifest test, `npm run typecheck`, `npm run check:mojibake`, and the p3/tickets vitest folder.

## Done when
Spec and manifest entry in; pictures a to f plus guest-list.csv exist (from CI or local) and are listed in the handover with the commit they came from; "Walk round" section in docs/handover/ticket-sales-report-web.md with Verified (fixture-fed render at 390x844, geometry, CSV bytes) and Not verified (real Excel/Sheets open, a real disputed order, the signed-in screen on prod data); last commit subject ends with your worker-done marker; one push. Do not edit the PR body.
