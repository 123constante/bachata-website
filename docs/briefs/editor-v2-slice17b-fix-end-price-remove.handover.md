# Slice 17b handover (End Undo, night Price "Pay at the door", row 48 Remove)

Branch claude/editor-v2-s1c. Flag organiserEditorV2 stays OFF. No migrations, no PR (per brief).
`plans/editor-v2/frozen/tap-table.md` is not in this clone; rows taken from the brief.

## Tap table (button | destination | prototype/OLD)
| row | button | destination | built |
|---|---|---|---|
| 48 | Remove this one (night When sheet) | session sheet and When sheet close to the tab; toast + Undo (from onSave); disabled when only one session | prototype |
| 48 | Remove this one (Every "Classes and party") | session sheet and Classes sheet close to the tab; toast + Undo; disabled at one | prototype |
| 83.1 | End, no date / one-off End | series.end_run, toast "Event ended", no Undo | OLD (UNBUILT, below) |
| X-09 | night Price fact | "£10 / Pay at the door" when no link and a door price | prototype |

## UNBUILT
- End Undo (83.1, no-date End and one-off End): no safe inverse. `inverseOf` (editorModel.ts:262) has no `series.end_run` case; the `before` snapshot is only `{ to: <lifecycle> }` (EveryBody.tsx ~206, OneOffBody.tsx ~67), and set_lifecycle back would not restore the coming nights end_run drops. Left as is: toast without Undo. Test pins `undoPlan` = null.

## How built
- WhenSheet.tsx `save` returns ok; `onRemove` calls `onClose()` after a successful save. EveryBody.tsx `saveProg` returns ok; `progRemove` closes the sheet after success. A failed save keeps the sheets open with the error.
- NightCard.tsx passes `doorPrice` (from `doorPriceOf(passes override ?? series passes)`) when the night has no ticket link. Note the Every card does not pass doorPrice today (it shows "Add a ticket" for the same shape); not changed (outside file list).

## Verified / Not verified
Verified: `npx vitest run src/modules/organiser/p3/v2` all pass; new slice17b tests fail on the unfixed code (price, Remove close) and pass now; tsc and mojibake results in the commit report.
Not verified: 390x844 browser walk; real-data shape survey; CI jobs; Every card Price fact for door nights.
