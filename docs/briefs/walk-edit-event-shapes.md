# Brief: walk B -- a claimed organiser edits an existing event in P3 across five shapes (REPORT ONLY), Sonnet

Brief-version: 2

Lane normal, model Sonnet, branch `claude/walk-edit-event-shapes`. REPORT ONLY: no product code, no feature PR, no `.github/**`. Supabase read-only (prod `stsdtacfauprzrdebmzg`, counts only, no personal data). Under 40% context. Push ONCE; last commit subject ends `[worker-done <ticket>]`.

## Why
Owner goal: 10 real organisers update an event themselves. The 2026-10-08 organiser rebuild failed on real shapes (ended series shown as Draft, "One date" on a 13-date series). This walk checks the P3 edit path against those shapes and ranks where an organiser would give up.

## What main lacks
- a shape-by-screen dead-end report for P3 edit (Details, Prices, one date vs all dates, Save) with file:line and a rank -- docs/handover/walk-edit-event-shapes.md
- (optional) one phone spec that opens the editor on each shape on fake Supabase and saves 390x844 pictures -- tests/e2e-phone/walk-edit-event-shapes.spec.ts

## Files
- docs/handover/walk-edit-event-shapes.md
- tests/e2e-phone/walk-edit-event-shapes.spec.ts (only if no existing spec reaches the shape)

## Do
1. Shapes: one-off; weekly series with 13 dates; ended series; draft; festival. First survey prod counts per shape (status x format x date-count, past/cancelled, series over 100 rows), counts only.
2. Read `src/modules/organiser/p3/screens/`: `EventPage.tsx`, `DetailsScreen.tsx`, `PricesScreen.tsx`, `AllDatesScreen.tsx`, `DateSheet.tsx`, `ScopeSheet.tsx`, `EditTray.tsx`, and `p3/model/saveModel.ts`, `saveWords.ts`, `scopeAsk.ts`, `status.ts`. For each shape x screen: what is shown, is there a one-date / all-dates ask when needed, does an untouched Save send nothing, does any copy point at a missing control, is every disabled control explained.
3. Run the existing evidence: vitest `p3/screens/__tests__/` (eventPage, editorStates, datesFix, keptEdit, archivedEvent, allDates100, editScreens.send) and `p3/model/__tests__/realShapes.test.ts`. List which of the 5 shapes x 4 screens have NO test; that gap list is the core output.
4. Festival and Course: P3 create shows "Coming soon" for some kinds; say what edit does for them, citing `docs/review/audit-create-parity.md` if it exists on main, do not guess.
5. Rank dead ends worst first (max 10) by "would an organiser give up here"; coverage count at the end (N cells, N tested, N code-read only, N unknown).

## Not verified (write this block honestly)
Real sign-in, a real save against prod, a real phone, any real account. Fake Supabase and code reading only; no write to prod.

## Hard rules
Do not edit `src/**`. Do not touch ticketing, door or `claude/w3c-1-repeat`. Handover line `DONE [worker-done <ticket>]`.
