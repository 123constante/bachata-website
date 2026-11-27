# Brief: Editor v2 slice 8, Where sheet + Description sheet, wired to the night card

Branch: claude/editor-v2-s1c
Size: 5 files, 380 lines
Repo: 123constante/bachata-website. Flag `organiserEditorV2` stays OFF; zero migrations; no admin change.

The prototype file is NOT reachable from the cloud. Everything you need from it is embedded below; it is the spec, copy words exactly. Slices 1-7b are on the branch: read `docs/briefs/editor-v2-slice7b-when-sheet.handover.md` and `docs/briefs/editor-v2-slice7a-session-sheet.handover.md` first (`V2Sheet`, `V2` copy, `OnSave` type, `saveNow`, how WhenSheet is mounted from NightCard). DESIGN-REGISTRY rows 61-81 win over this brief.

## Scope
- `WhereSheet` and `AboutSheet`, opened from the night card's "Where" (tap 9) and "Description" (tap 11) facts. They save as a NIGHT override (`occurrence.set_override`).
- Both sheets are built as CONTROLLED components (props: current value, `mode: 'night' | 'usual' | 'oneOff'`, `dateWords`, `changed`, `onSave`, `onBack`, `onClose`) so slice 10 mounts the same sheets on the Every card (taps 9 Every / 24) and slice 11 on the one-off event page. The USUAL write (series default_venue_id / default_description) is NOT built here: say so in the handover (component tests prove the sheets in `usual` mode call `onSave` with the picked value).

## Files (touch only these)
- src/modules/organiser/p3/v2/WhereSheet.tsx (new): `WhereSheet`.
- src/modules/organiser/p3/v2/AboutSheet.tsx (new): `AboutSheet`.
- src/modules/organiser/p3/v2/NightCard.tsx: the "where" and "about" `Fact`s get `onOpen` that open the sheets; the night save goes through the existing `onSave` prop (`OnSave`, 7b). Back to usual already exists on these facts (`back('where', ...)`, `back('about', ...)` via `backToUsualStep`): reuse it, do not rewrite. Show the sheet's own "Back to the usual ..." link only when `own.where` / `own.about`; it calls the same `back(...)` and closes the sheet.
- src/modules/organiser/p3/v2/copy.ts: add the lines below.
- src/modules/organiser/p3/v2/__tests__/whereAbout.test.tsx (new)
Do NOT edit EditorV2.tsx, NightV2, NightHub, SaveBar, saveNow.ts, editorModel.ts, anything in `shared/`, `dates/`, `events/`. If css is missing reuse `.grp .flab .card .row .hint .btn .fld`; max 15 lines to `v2/v2.css` only if unavoidable (then tell me in the handover, 6th file). Files over 2 KB: `scripts/safe-edit.py` / `scripts/safe-write.py`. JSX entities only, explicit px for sizes.

## Data and writes (reuse, do not rewrite)
- Venues: `useVenueOptions()` (shared/publicVenues.ts) returns `VenueOption {id, name, neighbourhood, city_name, ...}`. Row title = name, second line = `neighbourhood ?? city_name`. Filter on name + second line, case-insensitive, as you type (no debounce needed; list is client side). Current venue row shows "Now" on the right. The real list REPLACES the prototype's sample list; the prototype hint "Sample search..." is NOT built.
- Night venue write: a `WriteStep { target: 'occurrence', id: date.id, version: date.version, command: { kind: 'occurrence.set_override', payload: { venue_id, city_id? } }, order: 1, part: V2.venue }` through `onSave(steps, before, label)`. The override keys the Where fact owns are `venue_id` and `city_id` (`FACT_KEYS.where`): look at `buildOverridePatch` / how the old editor sets a night venue (`p3/` search `venue_id` in the dates module) and send exactly the keys it sends. `before` for Undo = `{ venue_id: dt.venueOverride, city_id: ... }` as `backToUsualStep`'s BEFORE_OF does; if an existing `inverseOf` case covers it, use that.
- Picking the venue already shown (`venue.id === current`) just closes, no save.
- Description: textarea, value = current night text (override or usual). Done: unchanged text closes without a save; text equal to the usual description clears the night key (`description: null`); else `description: text` (max `NIGHT_ABOUT_MAX` from editorModel). Same step shape, `part: V2.nightAbout`, `before` = `{ description: dt.descriptionOverride }`.
- Toasts (label passed to `onSave`): `night` mode `Saved for {dateWords} only`; `usual` mode `Saved for every {Weekday}`; `oneOff` mode `Saved`. All with Undo. (`dateWords` = `fullDate(date.occurrence_date, today)` as NightCard already builds it.)
- Typed unknown venue: see "Not buildable" below.

## Not buildable (do NOT fake; stop that item, report in the handover)
Prototype rows SH-WHERE-04 (`Use "<typed>"` / "A venue we do not know yet") and SH-WHERE-06 (typed venue saved with area "New venue") need a way to create a venue from a typed name. I found no writer for it in this repo and there are no more DB slices. Build everything else; do NOT render the "Use ..." row. In the handover write "Typed new venue: needs <exact thing you checked>" and list what you searched. I will ask the owner.

## Embedded prototype (spec)
```
where: sheet 'Where'
  <label class="fld"><span>Search for a venue</span><input type="search" placeholder="Type a name" autocomplete="off"></label>
  <div class="card">{row per matching venue: <b>name</b> / second line area / right value "Now" on the current one / chevron}
     [typed-unknown row: NOT BUILT, see above]</div>
  [hint "Sample search..." NOT BUILT]
  link "Back to the usual venue"   (btn sec; only on This night and only when the night has its own venue)
  picking a row: saves at once, closes the sheet, toast with Undo.
about: sheet 'Description'
  <label class="fld"><span>{night ? "What dancers read on <long date> only" : "What dancers read"}</span>
     <textarea placeholder="What happens, who it is for">{current}</textarea></label>
  <button class="btn pri">Done</button>
  link "Back to the usual description"   (btn sec; only on This night and only when the night has its own description)
```
Long date in the label: `Thursday 26 November` (same helper the night card uses for `long`).

## Copy (add to `V2`, exact)
"Where" (exists) / "Search for a venue" / "Type a name" / "Now" / "Back to the usual venue" / "Description" (exists) / "What dancers read on {date} only" / "What dancers read" / "What happens, who it is for" / "Done" / "Back to the usual description". Toasts as above. Reuse any that already exist in `V2`.

## Prototype checklist (every line built; one OLD = not done)
- [ ] E-08 the "Where" fact "Change ›" opens WhereSheet (fact already renders; wire it)
- [ ] SH-WHERE-01 Title "Where"
- [ ] SH-WHERE-02 Field "Search for a venue", placeholder "Type a name"; list filters as you type
- [ ] SH-WHERE-03 Venue rows: name, area second line; current one shows "Now" on the right
- [ ] SH-WHERE-04 NOT BUILT (see above)
- [ ] SH-WHERE-05 Picking a row saves at once and closes; toast "Saved for <date> only" / "Saved for every <day>" / "Saved", with Undo
- [ ] SH-WHERE-06 NOT BUILT (see above)
- [ ] SH-WHERE-07 Link "Back to the usual venue" (This night, only when changed)
- [ ] SH-WHERE-08 hint "Sample search..." NOT built (stub note, correct to omit)
- [ ] SH-ABOUT-01 Title "Description"
- [ ] SH-ABOUT-02 Label "What dancers read on <date> only" (night) / "What dancers read" (usual, one-off)
- [ ] SH-ABOUT-03 Text box, placeholder "What happens, who it is for"
- [ ] SH-ABOUT-04 Button "Done"; toast "Saved for <date> only" / "Saved for every <day>" / "Saved", with Undo
- [ ] SH-ABOUT-05 Link "Back to the usual description" (This night, only when changed)

## Tap table (fill in `docs/briefs/editor-v2-slice8-where-about.handover.md`; columns: button | destination | prototype/OLD; any OLD = not done)
| # | Button | Where | Result |
| 9 | Where … Change › | This night card | Sheet "Where" |
| 11 | Description … Change › | This night card | Sheet "Description" (label "What dancers read on <date> only") |
| 24 | Description | Every card / one-off page | Sheet "Description" (label "What dancers read"); component test only (slices 10/11 mount) |
| 49 | typing in "Search for a venue" | Where | Real venue list filters as you type |
| 50 | venue row | Where | Sheet closes; venue saved; toast + Undo |
| 51 | Use "<typed>" | Where | NOT BUILT: needs a venue-create writer (owner question) |
| 52 | Back to the usual venue | Where | Sheet closes; toast "Back to usual for <date>" + Undo |
| 74 | Done | Description | Sheet closes; toast + Undo |
| 75 | Back to the usual description | Description | Sheet closes; toast "Back to usual for <date>" + Undo |
Taps 9, 11, 49, 50, 52, 74, 75 are tested by rendering NightCard with mocked `useVenueOptions`, detail query and `onSave`; 24 by rendering AboutSheet in `usual` mode; 9-Every by WhereSheet in `usual` mode.

## Tests (whereAbout.test.tsx, vitest)
Filter as you type; current venue shows Now; pick other venue calls `onSave` once with the occurrence.set_override step and the night toast; pick current closes without save; no "Use ..." row when typing an unknown name; Back to usual link only when `changed`, calls back and closes; Description: label night vs usual; unchanged Done closes without save; text equal to usual sends `description: null`; changed text sends it; over `NIGHT_ABOUT_MAX` blocked with a short message; toast strings per mode.

## Handover
Write `docs/briefs/editor-v2-slice8-where-about.handover.md`: built, filled tap table, not-buildable (exact), files and line counts, tests run (`npx vitest run src/modules/organiser/p3/v2`, tsc, eslint on your files). Push to `claude/editor-v2-s1c` as the dispatch rules say; open no PR.
