# Handover: Editor v2 slice 17f, Undo for "Save the date" (row 36.1)

Branch claude/editor-v2-s1c. Flag organiserEditorV2 stays OFF; zero migrations; no admin change. No PR.

## Tap table
| row | button | destination | built |
|---|---|---|---|
| 36 / 36.1 | Save the date (one-off When sheet) | move_date, sheet closes, toast "Saved" + Undo; Undo = move_date back, toast "Undone" | prototype |
| 83.1 | End the event, no date | series.end_run, toast "Event ended" | OLD: no Undo, BLOCKED (admin RPC missing, see UNBUILT) |

## Done
- `inverseOf` handles `occurrence.move_date` (editorModel.ts); null when `before.to_date` is absent.
- `WhenSheet.saveDate` sends before `[{ to_date: <old date> }]` and no `noUndo`.
- slice17f.test.tsx (new, 4 tests incl. useSaveNow round trip); when.test.tsx updated; e2e row 36.1 `fixme` removed.
- Row 83.1 untouched; slice17b.test.tsx:50 still green.

## UNBUILT
- 83.1 `series.end_run` "Event ended" Undo. Needs a new admin migration: an owner-callable undo of end_run (restore recurrence rule, upcoming dates, lifecycle). `series.restore_ended` and `series.set_lifecycle` from `ended` are admin-only. Needs an owner decision.

## Verified / Not verified
- Verified: `npx vitest run src/modules/organiser/p3/v2` 33 files, 382 tests pass; tsc -p tsconfig.app.json: 0 errors in p3/v2 files.
- Not verified: 390x844 browser walk; e2e row 36.1 (not run, spec cannot run here).
