# Brief: Editor v2 slice 7b, When sheet (this night) + Classes-and-party sheet, wired to the night card

Branch: claude/editor-v2-s1c
Size: 5 files, 400 lines
Repo: 123constante/bachata-website. Flag `organiserEditorV2` stays OFF; zero migrations; no admin change.

The prototype file is NOT reachable from the cloud. Everything you need from it is embedded below; it is the spec, copy words exactly. Slices 1-7a are on the branch: read `docs/briefs/editor-v2-slice7a-session-sheet.handover.md` and `docs/briefs/editor-v2-slice6-guest-list.handover.md` first (`V2Sheet`, `V2` copy, `SessionSheetV2` props contract, `saveNow`). DESIGN-REGISTRY rows 61-81 win over this brief.

## Scope
- `WhenSheet` (this night; one-off adds the date field), wired into the night card's "When" fact (taps 8, 36-39).
- `ProgSheet` "Classes and party" (the usual night), built and tested as a CONTROLLED component but NOT mounted: its trigger is the Every card, which slice 10 builds (taps 21, 40-42 are proven by component tests here; say so in the handover).
- Both sheets mount `SessionSheetV2` (from 7a) for tap 37/38/40/41.

## Files (touch only these)
- src/modules/organiser/p3/v2/WhenSheet.tsx (new): `WhenSheet` and `ProgSheet` (both small; share a `SessionRows` list).
- src/modules/organiser/p3/v2/NightCard.tsx: the "When" `Fact` gets `onOpen` that opens WhenSheet; owns the save through `saveNow` (already a prop path: see how `onBack` reaches `saveNow` in EditorV2; add ONE new prop `onSave(steps, before, label)` if needed, then the single line in EditorV2.tsx is allowed, nothing else in it).
- src/modules/organiser/p3/v2/EditorV2.tsx: only the line passing the new prop.
- src/modules/organiser/p3/v2/copy.ts: add the lines below.
- src/modules/organiser/p3/v2/__tests__/when.test.tsx (new)
Do NOT edit NightV2, NightHub, SaveBar, saveNow.ts, editorModel.ts, SessionSheetV2.tsx, anything in `shared/`, `dates/`, `events/`. If css is missing, reuse existing `.grp .flab .card .row .hint .btn` classes; if you must add css, max 15 lines to `v2/v2.css` (then that is a 6th file: tell me in the handover instead and reuse). Files over 2 KB: `scripts/safe-edit.py` / `scripts/safe-write.py`. JSX entities only, explicit px for sizes.

## Data and writes (reuse, do not rewrite)
- Night sessions: `useDateProgramme(occurrenceId)`, `draftsOf`, `buildPayload`, `dateEdit`, `dateAdd`, `dateOff`, `nightSessionsOff(date, today, multiDay)` (disable the whole sheet body with that reason text when it returns one; NightV2's `NightSessionsCard` shows the pattern, do not edit it). Done in the session sheet gives a `DraftSession` row: replace/add it in the rows, build the complete payload, and save at once as ONE `WriteStep { target: 'programme', id: occurrenceId, version: prog.version, command: null, payload, order: 2, part: V2.nightSessions }` via the existing `saveNow(steps, before, label)`. `before` for Undo = the old payload (see `inverseOf` for target 'programme' in editorModel.ts). Remove = `onRemove(row)` (`removed: true` in the payload), same save. Toasts: `V2.session.savedNight(date)` ("Saved for Thursday 26 November only") with Undo.
- Row second line: `type label · names joined ' & ' · level labels joined ', '` (omit empty parts), value `start to end`; title = `title || type label`. Sorted by start. Removed rows are not shown.
- One-off date: `moveDateStep` / `occurrence.move_date` (see `events/eventModel.ts` line ~282 for how it is built; reuse the helper, do not edit that file). Empty field: error "Add a date." Same date: just close. Else save, toast "Saved" with Undo if `inverseOf` supports it, else `noUndo`.
- "Back to the usual times" (only when this night has its own sessions: `date.session_overrides_count > 0 || added_sessions_count > 0`): look at how the `back(...)` helper in NightCard / `backToUsualStep` in editorModel works for facts. If there is NO way to reset a night's sessions with the existing writers (check `organiser_set_occurrence_programme_v1` payload in `programmeModel.buildPayload` and what the admin writer does with an untouched list), DO NOT fake it: render the link, make it disabled-free but unwired is NOT allowed. Instead stop that one item, write in the handover "Back to usual times: needs <exact thing>" and keep everything else. I will ask the owner.
- ProgSheet (usual): takes `rows: DraftSession[]`, `oneOff: boolean`, `onOpenSession(row|null)`, `onClose`. No saving in 7b (slice 10 wires saving with the series programme writer `programmeSeriesModel` / `p3/data/sessions.ts`).

## Embedded prototype (spec)
```
when:   sheet 'When'
          weekly:  <p class="txt"><b>{long date, e.g. "Thursday 26 November"}</b></p>
          one-off: Date field (date input, id w-date, value = date), <p class="err" hidden>Add a date.</p>, <button class="btn sec">Save the date</button>
          <div class="grp"><div class="flab">Tap a class or the party to change its time</div>
            <div class="card">{row per session: title, second line, value "19:30 to 20:15", chevron}</div>
            <button class="btn sec">Add a class or party</button>
            <p class="hint">The night starts with the first one and ends with the last one.</p></div>
          back-to-usual link "Back to the usual times" (only when this night has its own times)
programme: sheet 'Classes and party'
          <p class="hint">{one-off ? 'Times come from here.' : 'The usual night. Teachers and DJs are set inside each one.'}</p>
          <div class="card">{same rows}</div>
          <button class="btn sec">Add a class or party</button>
          <button class="btn pri">Done</button>   (closes the sheet, no toast)
```
The session sheet opens ABOVE the When sheet; after Done or Remove it closes and the When sheet shows the new rows.

## Copy (add to `V2`, exact)
"When" (exists) / "Tap a class or the party to change its time" / "Add a class or party" / "The night starts with the first one and ends with the last one." / "Back to the usual times" / "Date" / "Add a date." / "Save the date" / "Saved" / "Classes and party" / "The usual night. Teachers and DJs are set inside each one." / "Times come from here." / "Done". Toast for back: `Back to usual for {date}`.

## Prototype checklist (every line built; one OLD = not done)
- [ ] SH-WHEN-01 Title "When"
- [ ] SH-WHEN-02 Weekly: long date bold at top, not editable
- [ ] SH-WHEN-03 One-off: field "Date", error "Add a date.", button "Save the date"; toast "Saved"
- [ ] SH-WHEN-04 Label "Tap a class or the party to change its time"
- [ ] SH-WHEN-05 One row per class or party: title, "Class · Carlos & Ana · Beginner", "19:30 to 20:15", chevron; opens the session sheet for this night
- [ ] SH-WHEN-06 Button "Add a class or party" (secondary); session sheet empty
- [ ] SH-WHEN-07 Hint "The night starts with the first one and ends with the last one."
- [ ] SH-WHEN-08 Link "Back to the usual times" only when this night has its own times; toast "Back to usual for <date>" (see the stop rule above)
- [ ] SH-PROG-01..05 as the programme block above
- [ ] E-07 the "When" fact "Change ›" on the night card opens WhenSheet (fact already renders; wire it)
- [ ] `nightSessionsOff` reasons shown in place of the body (multi-day, cancelled, past)

## Tap table (fill in `docs/briefs/editor-v2-slice7b-when-sheet.handover.md`; columns: button | destination | prototype/OLD; any OLD = not done)
| # | Button | Where | Result |
| 8 | When … Change › | This night card | Sheet "When" |
| 36 | Save the date | When (one-off) | Empty: error "Add a date." Else toast "Saved" + Undo |
| 37 | session row | When | Session sheet for this night, title = session title |
| 38 | Add a class or party | When | Session sheet "Add a class or party" |
| 39 | Back to the usual times | When | Sheet closes; toast "Back to usual for <date>" + Undo |
| 21 | When … Change › | Every card | Sheet "Classes and party" (component test only; Every card is slice 10) |
| 40 | session row | Classes and party | Session sheet, usual night |
| 41 | Add a class or party | Classes and party | Session sheet, empty |
| 42 | Done | Classes and party | Sheet closes; no toast |
Taps 8, 36-39 are tested by rendering NightCard with a mocked programme and `saveNow`; 21, 40-42 by rendering ProgSheet.

## Tests (when.test.tsx, vitest; mock `useDateProgramme`, `saveNow`)
Row second line and value format; sorted; removed rows hidden; session row tap opens SessionSheetV2 with that row; Add opens it empty; Done builds the full payload and calls `saveNow` once with one programme step and `savedNight` label; Remove sends `removed: true`; `nightSessionsOff` reason replaces the body; one-off date: empty error, same date closes, new date calls save; weekly shows the long date not the field; ProgSheet hint text weekly vs one-off, Done closes without toast; "Back to the usual times" visible only with own times.

## Handover
Write `docs/briefs/editor-v2-slice7b-when-sheet.handover.md`: built, filled tap table, anything unbuildable (exact), files and line counts. Push to `claude/editor-v2-s1c` as the dispatch rules say; open no PR.
