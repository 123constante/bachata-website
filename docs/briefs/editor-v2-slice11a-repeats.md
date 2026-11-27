# Brief: Editor v2 slice 11a, Repeats sheet + Change repeat? sheet on the Every tab

Branch: claude/editor-v2-s1c
Size: 4 files, 330 lines
Repo: 123constante/bachata-website. Flag `organiserEditorV2` stays OFF; zero migrations; no admin change.

The prototype file is NOT reachable from the cloud. Everything needed is embedded below; it is the spec, copy words exactly. Slices 1-10b are on the branch: read `docs/briefs/editor-v2-slice10b-music-organisers.handover.md` and `10a` first (`EveryBody.tsx` `Line`, `send`, `V2Sheet`, `V2.every`, `savedLabel`). DESIGN-REGISTRY rows 61-81 win over this brief.

## Scope
Wire the "Repeats" row in `EveryBody.tsx` (id `repeats`, rendered today with no `onOpen`) to a new sheet. When / Price / the status end-card taps stay pending: do not touch them.

## Files (touch only these)
- src/modules/organiser/p3/v2/RepeatSheetV2.tsx (new): both sheets (Repeats + Change repeat?)
- src/modules/organiser/p3/v2/EveryBody.tsx: `onOpen` for row `repeats`, mount the sheet (state value `'repeats'`), add `saveRepeat` next to `saveMusic`. Nothing else.
- src/modules/organiser/p3/v2/copy.ts: add the lines below (reuse existing keys where they exist).
- src/modules/organiser/p3/v2/__tests__/everyRepeats.test.tsx (new)
Do NOT edit editorModel.ts, NightCard, SaveBar, saveNow.ts, anything in `shared/`, `dates/`, `events/`. Files over 2 KB: `scripts/safe-edit.py` / `scripts/safe-write.py`. JSX entities only, explicit px for sizes.

## Prototype (copy exactly)
```
repeat: sheet('Repeats',
  field "Every": <select> of DAYS (seven FULL weekday names, selected = current day)
  field "Last date (leave empty for no end date)": <input type=date> value = end date
  + primary button "Done")
repeatDone: day=+f-day, end=f-end.
  if day===S.day && end===S.endDate -> closeSheet; return          (no change: close, no save)
  keep = dates the NEW pattern produces; lost = nights that have their OWN changes (override or cancelled) and are NOT in keep, sorted
  if none lost -> repeatDo()
  else sheet 'Change repeat?':
    <p class=txt>These dates have their own changes. They will be removed:</p>
    card: one row per lost date: <b>long date</b> + right value ('Cancelled' if cancelled else 'Changed')
    button danger SOLID 'Change repeat'  -> repeatDo
    button secondary 'Keep the current repeat' -> close
repeatDo: removes the lost nights' changes, sets day + end date, toast 'Saved' (with Undo)
```
After a weekday change EVERYTHING that names the day uses the new weekday: the tab label "Every <day>", the page title, the scope line, hints and toasts (SH-REPEAT-10). The editor reads these from `ws` after the save refetch, so verify the tab label / `savedLabel('usual', day)` come from the new rule; if `day` is held in a parent state that does not refresh, fix it only inside EveryBody's call chain (no other file) and note it in the handover.

## Real-rule mapping (the server is the authority)
- Rule today: `ws.series.recurrence_rule` (weekly, `weekdays:[n]`, `end:{kind:'none'|'until_date', date}`); `ws.endedOn` = the end date. Weekday names: `weekdayOfKey`, full names already in `copy.ts`/`dates` helpers; do not hard-code a second list if one exists.
- Command: ONE step `series.set_recurrence`. Build with `dayChangeCommand(rule, weekday)` (keeps interval/end) then set `end` = `{kind:'until_date', date}` or `{kind:'none'}` per the date field (see `weeklyUntilCommand`, `dayChangeCommand` in `events/eventModel.ts`; read, do not edit). Step shape: `{ part: E.repeats, target:'series', id: s.id, version: s.version, command, order: 1 }` via `saveNow([step], [{ recurrence_rule: s.recurrence_rule }], 'Saved')` (inverseOf already restores the old rule for `series.set_recurrence`; confirm in `editorModel.ts` inverseOf, do not edit). Toast text is exactly "Saved", with Undo (NOT the "Saved for every <day>" label).
- "Last date" must be a date on the chosen weekday: reuse `lastDateWeekday(weekday)` copy ("The last date must be a <weekday>.") as an inline error; Done is blocked while wrong. Also respect the date cap (`events/dateCap.ts` `endWithinCap`) with its existing message.
- Lost nights: from `ws.dates` (WorkspaceDate) take dates whose `dateTagOf(d, s.lifecycle_status)` is `'cancelled'` or `'changed'` AND which the new rule would not produce (different weekday, or after the end date; past dates are never lost). Row value: `DATE_TAG_WORD` ("Cancelled" / "Changed"). Long date = the same long-date formatter the Dates list uses (`fullDate` / helper already in EveryBody or `dates/`).

## Checklist (every item built; tick in handover)
- [ ] SH-REPEAT-01 title "Repeats"
- [ ] SH-REPEAT-02 field "Every": select of the seven full weekday names
- [ ] SH-REPEAT-03 field "Last date (leave empty for no end date)" (date input)
- [ ] SH-REPEAT-04 button "Done"; no night losing a change: saves, toast "Saved" with Undo; nothing changed: just closes, no save
- [ ] SH-REPEAT-05 nights would lose their own changes: sheet "Change repeat?" opens instead
- [ ] SH-REPEAT-06 text "These dates have their own changes. They will be removed:"
- [ ] SH-REPEAT-07 rows: long date with "Cancelled" or "Changed"
- [ ] SH-REPEAT-08 button "Change repeat" (danger solid); saves; toast "Saved"
- [ ] SH-REPEAT-09 button "Keep the current repeat" (secondary); closes the sheet, nothing saved
- [ ] SH-REPEAT-10 after a weekday change: tab label, title, scope line, hints, toasts use the new weekday
- [ ] Row "Repeats" opens the sheet; value line unchanged ("Every <day>" / "Every <day>, ends after <date>")

## Tap table (put in `docs/briefs/editor-v2-slice11a-repeats.handover.md`; columns button | destination | prototype/OLD; any OLD = not done)
| 26 | Repeats row | Every About group | Sheet "Repeats" |
| 78 | Done | sheet Repeats | No night loses a change: sheet closes, toast "Saved" + Undo. Else sheet "Change repeat?" |
| 79 | Change repeat | sheet Change repeat? | Sheet closes; listed changes removed; toast "Saved" |
| 80 | Keep the current repeat | sheet Change repeat? | Sheet closes |
Tests: render EveryBody with a mocked workspace (dates with a cancelled and a changed night) and mocked `saveNow`; assert: no-change Done closes with no save; day change with no lost nights sends exactly one `series.set_recurrence` step (weekdays:[new], end kept/updated), `before` = old rule, label "Saved"; day change with lost nights shows the sheet with the right rows + words and sends nothing until "Change repeat"; "Keep the current repeat" closes, no save; end-date wrong weekday blocks Done; empty end date sends `end:{kind:'none'}`.

## Handover
Write the handover file named above: built, filled tap table, deviations, not-buildable (exact), files + line counts, tests run (`npx vitest run src/modules/organiser/p3/v2`, tsc `-p tsconfig.app.json`, eslint on your files; pre-existing errors in eventPage.proto.test.ts tsc and V2Sheet.tsx eslint are not yours). Push to `claude/editor-v2-s1c` per the dispatch rules; open no PR.
