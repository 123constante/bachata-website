# Slice 17a handover (editor v2: Classes and party, Back to usual times, End Undo)

Branch claude/editor-v2-s1c. Flag organiserEditorV2 stays OFF. No migrations. No PR (brief says none).

## Tap table (button | destination | prototype/OLD)
| row | button | destination | built |
|---|---|---|---|
| 21 | Every card When "Change" | sheet "Classes and party" (ProgSheet) | prototype |
| 40 | session row | SessionSheetV2 for that usual session (ctx usual) | prototype |
| 41 | Add a class or party | SessionSheetV2 new (ctx usual) | prototype |
| 42 | Done | closes, no save, no toast | prototype |
| 39 | Back to the usual times (night When sheet) | occurrence.set_time {reset:true}, closes, toast "Back to usual for <date>" + Undo | prototype (see note) |
| 83 | End the event, later last date | series.set_recurrence until_date, toast "Ends after <date>" + Undo | prototype (inverse exists, unit-tested) |
| 83 | End the event, no date | series.end_run, toast "Event ended" | OLD: no Undo (UNBUILT) |

The frozen `plans/editor-v2/frozen/tap-table.md` is not in this repo clone; rows copied from the brief.

## How built
- Usual sessions write ONE `series.set_program` (whole programme, via programmeSeriesModel addSession/updateItem/removeSession/programCommand, same as the v1 every-date path), Undo = old `days`. `SessionSheetV2` ignores `ctx`; the caller decides, so the usual path is in EveryBody.
- Row 39: writer exists (`resetTimeCommand`, flows/change/Time.tsx). "Own time" uses `hasOwnTime(date, usualStart)` (override_keys never carries times). The usual start is read from the workspace in the query cache (no extra read, no NightCard edit); no cached workspace = no button. Undo restores the night's own start only; its end is not on `WorkspaceDate`, so the inverse sends `new_local_end: null` (server keeps length).
- Stale assertion fixed in every.test.tsx (When no longer a pending row).

## UNBUILT
- Row 83 no-date End Undo: `inverseOf` in `editorModel.ts` has no case for `series.end_run` (returns null, so saveNow shows no Undo). Outside this slice's file list. Needs an owner decision on how to reverse end_run (set_lifecycle back would not restore dropped nights). Test `slice17a.test.tsx` pins the null.
- OneOffBody End Undo: same cause (end_run), nothing to change in OneOffBody.tsx.

## Verified / Not verified
Verified: `npx vitest run src/modules/organiser/p3/v2` 29 files, 359 pass; tsc (tsconfig.app.json): 0 errors in files I touched (1 pre-existing in eventPage.proto.test.ts); check:mojibake clean.
Not verified: 390x844 browser walk; real-data shape survey; pre-ship / CI jobs; people (line-up) edits on the usual sheet beyond the shared code path; e2e spec rows (slice 16e un-fixmes).
