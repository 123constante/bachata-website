# Editor v2 slice 7b handover (When sheet + Classes and party sheet)

## Built
- `v2/WhenSheet.tsx` (new, ~150 lines): `WhenSheet`, `ProgSheet`, shared `SessionRows`, `rowLine`, type `OnSave`.
- `v2/NightCard.tsx`: new optional prop `onSave`; the When fact opens `WhenSheet` when it is passed.
- `v2/EditorV2.tsx`: one line, `onSave={saveNow}`.
- `v2/copy.ts`: `V2.whenSheet` block (+16).
- `__tests__/when.test.tsx` (17 tests). No css added.

## Unbuildable (exact)
- **Back to usual times: needs a night-programme reset writer.** `organiser_set_occurrence_programme_v1` takes a full sessions list; an untouched list is a no-op (`dateBuilt` returns null payload), and no existing command removes a night's own session overrides. The link is NOT rendered (tap 39 and SH-WHEN-08 not done). A test asserts it is absent. Owner to decide: new admin writer or reset flag.

## Tap table
| # | Button | Destination | prototype/OLD |
|---|---|---|---|
| 8 | When Change > | Sheet "When" | prototype (wired in NightCard) |
| 36 | Save the date | empty: "Add a date."; same: close; else move_date, toast "Saved", NO Undo (inverseOf has no move_date) | prototype, no Undo |
| 37 | session row | SessionSheetV2 for the row | prototype |
| 38 | Add a class or party | SessionSheetV2 empty | prototype |
| 39 | Back to the usual times | not built | NOT DONE (see above) |
| 21 | When Change > (Every card) | ProgSheet, component test only | prototype |
| 40 | session row (ProgSheet) | onOpenSession(row) | prototype |
| 41 | Add (ProgSheet) | onOpenSession(null) | prototype |
| 42 | Done (ProgSheet) | onClose, no toast | prototype |

Notes: ProgSheet does not mount SessionSheetV2 itself; slice 10 passes `onOpenSession`. Save failure text shows in the When sheet.

## Verified / Not verified
- Verified: vitest p3/v2: 13 files, 170 pass. check:mojibake clean. tsc -p tsconfig.app.json: 0 errors in my files (one pre-existing error in `__tests__/eventPage.proto.test.ts`). eslint: 0 errors in my files (pre-existing error in V2Sheet.tsx).
- Not verified: 390x844 walk, prod shape survey, pre-ship, /code-review, NightCard-level render test of tap 8 (WhenSheet tested directly). Flag OFF; no PR (per brief).
