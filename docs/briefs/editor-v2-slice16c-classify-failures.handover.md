# Handover: Editor v2 slice 16c (classify the 50 failing tap-walk rows) PARTIAL

Branch claude/editor-v2-s1c. No PR (brief). Tests only: `tests/e2e/organiser-editor-v2.spec.ts`. `organiserFake.ts` untouched.

## Run result (390x844, 4 workers)
Before: 61 pass / 50 fail / 2 skip. After this push: **69 pass / 42 fail / 2 skip, 0 new fixme**. NOT green, NOT fully classified. Stopped at the context gate (owner rule), not because the work is done.

## BUILT UI DIFFERS
**None confirmed yet.** No row has been proven a real prototype-vs-built difference. Candidates still to check (do not treat as proven): X-08 one-off (spec now sets `format = 'one_off'`; re-check whether `ev2-tab-night` still shows); X-06 "ends after" text; row 83 End toast has no Undo (failure is `v2-toast-undo` count 0, looks real); row 50 venue toast text (`toContainText` mismatch, look at the real toast).

## Fixed in the spec this round (spec/setup was wrong)
1. `dlg(page)` with no title picked the first of two stacked dialogs (session sheet over When sheet): now the TOPMOST one. Cleared rows 37 and 47.
2. One-off state never set `format = 'one_off'`: the fake series stayed recurring. Now set in `open()`.
3. `ticket_types_manage_v1` mock returned `types` but the parser reads `ticket_types`: fixed (with base/effective price, has_orders).
4. Guest list row renders only with env `VITE_ENABLE_ORGANISER_GUEST_LIST_LIVE=true` AND an `organiser_guest_list_night_v1` answer: the spec now mocks the RPC. Cleared rows 17, 67. **The MANUAL run line in `scripts/check-e2e-spec-coverage.mjs` (line ~100) must gain `VITE_ENABLE_ORGANISER_GUEST_LIST_LIVE=true`; not edited here because the brief limits the files.**

## Still failing (42), with first-look cause
- Sheet-in-sheet taps `tap()` scopes to the open sheet, so "Back to the usual times/venue/description" (39, 52, 75) fail: the `changedVenue` state has NO changed night in the fake (setup line is `s.default_venue_id = s.default_venue_id`, a no-op). Needs a per-night override in `organiserFake.ts` (also unblocks X-02). Spec/fake setup, not a UI difference.
- Tickets screen rows (91-106, 88, 93-98, 100, X-09, X-11, X-12c/d): the screen still shows "Loading…" or lacks the control. Next step: log which request is unmocked/failing (`page.on('requestfailed')` plus `response` status >= 400 on `/rest/v1` and `/rpc`), likely `fetchSeriesTypes` needs `organiser_id` or a second read. Price sheet also stays on "Loading the prices…" (rows 53, 55, 56, 53.1, X-09): same cause.
- Classes-and-party sheet (21, 40, 41, 42): sheet shows "Loading the classes and party…" or never opens: same class of cause, find the unmocked read.
- 43 (Type chip "Party" click timeout), 48 (sheet still open after Remove this one), 50 (toast text), 51 (placeholder `Search for a venue` is a `searchbox`: use `getByRole('searchbox')`), 62 (video tile text), 83 (End toast has no Undo).
- X-02, X-06 (fake `recurrence_rule.until` may be the wrong field: check `Repeats` row text "no end date"), X-12, X-13.

## Known UNBUILT (listed, not fixed)
Row 36 move_date Undo; weekly per-night sold count; per-night ticket price write.

## Tap table `built` column
Unchanged from the 16b handover for rows that passed then (still pass). The rows above are the only ones not yet `prototype`. X-14 not defined by prototype (skipped).

## Next steps (in order)
1. Add the changed-venue night override to the fake (or via the dates-read mock).
2. Log failing/unmocked requests on the Tickets and Price sheet pages; fix mocks until they load; re-run rows 53-56, 88-106, 21, 40-42.
3. Fix locators for 43, 48, 50, 51, 62; classify 83, X-06, X-08.
4. Any row the built UI truly cannot satisfy: `test.fixme('row N: reason')` + entry under BUILT UI DIFFERS with file:line.

## Verified / Not verified
Verified: spec runs to completion at 390x844; counts above; dev server started with flags `SELF_SERVE P3 DASH EDITOR_V2 GUEST_LIST_LIVE`.
Not verified: green run; full classification; `npx tsc` (spec is outside tsconfig.app.json; not run); `npm run check:e2e-spec-coverage`; real-data shape survey (tests only, none).
