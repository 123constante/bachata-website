# Brief: Editor v2 slice 7a, Session sheet (add / change / remove one class or party)

Branch: claude/editor-v2-s1c
Size: 5 files, 380 lines
Repo: 123constante/bachata-website. Flag `organiserEditorV2` stays OFF; zero migrations; no admin change.

The prototype file is NOT reachable from the cloud. Everything you need from it is embedded below; it is the spec, copy words exactly. Slices 1-6 are on the branch: read `docs/briefs/editor-v2-slice6-guest-list.handover.md` first (`V2Sheet`, `V2` copy, tokens in `v2/v2.css`). DESIGN-REGISTRY rows 61-81 win over this brief.

## Scope
7a builds the session sheet as a CONTROLLED component with tests. It is opened from the Classes-and-party sheet and the This-night screen, which slice 7b builds and wires. So in 7a taps 43-48 are proven by component tests (render the sheet, tap, assert), not by a screen walk; do not wire it into EditorV2 / NightV2 / ProgrammeSheet. Say so in the handover.

## Files (touch only these)
- src/modules/organiser/p3/v2/SessionSheetV2.tsx (new): `SessionSheetV2` plus exported pure helpers `groupsFor`, `lostOnTypeChange`, `timesProblem`.
- src/modules/organiser/p3/v2/PeopleGroup.tsx (new): one people group (label, chips with x, "None yet", picker + Add, or read-only).
- src/modules/organiser/p3/v2/copy.ts: add the lines below (a `session` block inside `V2`).
- src/modules/organiser/p3/v2/v2.css: append max 40 lines for `.tchip`, `.pchip`, `.grp`, `.chipsw`, `.two`, `.err`, `.warn`, `.btn.dan` ONLY IF not already present (grep first); keep tokens, explicit px.
- src/modules/organiser/p3/v2/__tests__/session.test.tsx (new)
Do NOT edit EditorV2, NightV2, NightHub, SaveBar, saveNow.ts, editorModel.ts, anything in `shared/`, `dates/`, `events/`. Files over 2 KB: `scripts/safe-edit.py` / `scripts/safe-write.py`. JSX entities only (`&times;` `&mdash;`), explicit px for sizes (phone html font is ~13.5px).

## Data (reuse, do not rewrite)
- Edit one `DraftSession` (`../../shared/programmeModel`: `key, original, type, title, start, end, levels, removed, people?: DraftPerson[]`). Types are lowercase keys `class | masterclass | party | performance`; show them as "Class" "Masterclass" "Party" "Performance" (`TYPE_LABEL` / `typeLabel`). Levels are `LEVEL_KEYS` lowercase; show "Beginner" "Improver" "Intermediate" "Advanced" (4 chips; a stored `open_level` stays on the session untouched and is just not offered as a chip).
- Type change, add person, remove person: reuse `setSessionType`, `pickPerson`, `onSessionIds`, `addRoleFor` from `../../dates/dateModel` and `removePerson`/`undoRemovePerson` from `programmeModel` if exported (read them first). A stored session keeps its stored type rules from those helpers; do not weaken them.
- Picker: `searchPickerRows(term, role)` from `../../dates/peoplePicker` (min 2 characters, `PEOPLE_SEARCH_MIN`), via `useQuery` with `pickerQueryKey`. Role from `addRoleFor(type)`: Class/Masterclass = teaching ("Teachers"), Party = djing ("DJs").
- Props: `{ row: DraftSession | null (null = new), count: number (sessions on this screen), ctx: 'night' | 'usual', dayLabel: string (e.g. "Thursday 26 November" for night, "Thursday" for usual), onDone(row), onRemove(row), onClose }`. No saving here: `onDone`/`onRemove` hand the finished row to the parent (7b), which owns the toast and Undo. The sheet only returns the row; toast wording goes in `copy.ts` as functions so 7b can use them.

## Embedded prototype (spec)
```
title:  d.isNew ? 'Add a class or party' : (d.title || d.type)
fields: Title (placeholder "For example Beginners class")
        Type: chips Class / Masterclass / Party / Performance (one picked = black, aria-pressed)
        two columns, 12px gap: Starts (time input) | Ends (time input)
        error (after Done): <p class="err">Ends before it starts. Check the end time.</p>
        Level (only Class and Masterclass): chips Beginner / Improver / Intermediate / Advanced, toggle each, several may be picked
        people groups: Class,Masterclass -> 'Teachers'; Party -> 'DJs'; Performance -> 'Dancers'
        warning: <p class="warn">{names} will be removed.</p>
        <button class="btn pri">Done</button>
        existing session only: <button class="btn dan" [disabled when count<=1]>Remove this one</button>
                               + when count<=1: <p class="hint">An event needs at least one class or party.</p>
people group markup:
  <div class="grp"><div class="flab">{label}</div><div class="chipsw">
    each: <span class="pchip">{name}<button aria-label="Remove {name}">&times;</button></span>
    none: <span class="hint">None yet</span></div>
    picker row (grid 1fr auto, gap 8px): picker + <button>Add</button></div>
groupsFor: Class,Masterclass=[Teachers]; Party=[DJs]; Performance=[Dancers]; Party that already has dancers (oldDancers) also gets ['Dancers', no picker, no Add]
Party with old dancers: group "Dancers" lists them with x, NO picker, NO Add, hint "A party has DJs only. To add dancers, add a Performance."
sType (change type): lost = people in groups the new type no longer has, plus "<levels joined by ', '> level" when the new type is not Class/Masterclass and levels were picked;
        warn = lost.length ? lost.join(', ') + ' will be removed.' : ''   (the sheet redraws; nothing is removed until Done)
sDone: if start empty, end empty, start===end, or (end<start and end>='06:00') -> show the error, stay open.
        (end<start and end<'06:00' is a night that runs past midnight: allowed)
        else drop people the type no longer has and levels when not Class/Masterclass, title = title || type label, hand the row to onDone
```
Owner decision 2026-11-22 (click): on a **Performance** the "Dancers" group is SHOW ONLY. The database lets an organiser add only teachers and DJs; performers are set by the platform team. So for Performance: label "Dancers", chips of people already on it (read-only: NO x, because the writer refuses removing them), "None yet" when empty, then `<p class="hint">The team adds performers.</p>`. No picker, no Add. Record this deviation from the prototype in the handover. Teachers and DJs keep x and Add as in the prototype; any stored person whose role is not teaching/djing (`isEditableRole` false) shows as a read-only chip with no x.

Copy exactly (add to `V2.session`): "Add a class or party" / "Title" / "For example Beginners class" / "Type" / "Starts" / "Ends" / "Ends before it starts. Check the end time." / "Level" / "Teachers" / "DJs" / "Dancers" / "None yet" / "Add" / "Remove {name}" (aria) / "A party has DJs only. To add dancers, add a Performance." / "The team adds performers." / "{names} will be removed." / "Done" / "Remove this one" / "An event needs at least one class or party." And toast builders for 7b: `savedNight(date)` = "Saved for {date} only", `savedEvery(day)` = "Saved for every {day}", `savedOneOff` = "Saved".

## Prototype checklist (every line is built; a tap that leaves the prototype = not done)
- [ ] SH-SES-01 Title is the session's title; new one "Add a class or party"
- [ ] SH-SES-02 Field "Title", placeholder "For example Beginners class"
- [ ] SH-SES-03 Label "Type" with chips "Class" "Masterclass" "Party" "Performance"; one picked (black)
- [ ] SH-SES-04 Two fields side by side (12px gap): "Starts" and "Ends" (time inputs)
- [ ] SH-SES-05 Error "Ends before it starts. Check the end time."
- [ ] SH-SES-06 Label "Level" with chips "Beginner" "Improver" "Intermediate" "Advanced": Class and Masterclass only
- [ ] SH-SES-07 People group "Teachers" for Class and Masterclass
- [ ] SH-SES-08 People group "DJs" for Party (DJs only)
- [ ] SH-SES-09 People group "Dancers" for Performance (show only, owner click, see above)
- [ ] SH-SES-10 People group: person chips with "x" (aria-label "Remove <name>"); empty "None yet"; picker and "Add" in a row (1fr auto, 8px gap)
- [ ] SH-SES-11 Party that already has dancers: "Dancers" shows them with x, no picker, no Add, hint "A party has DJs only. To add dancers, add a Performance."
- [ ] SH-SES-12 Changing the type so people no longer fit: warning box "<names> will be removed."
- [ ] SH-SES-13 Button "Done" (primary)
- [ ] SH-SES-14/15 Toast wording functions `savedNight`, `savedEvery`, `savedOneOff` exist in copy (7b shows them with Undo)
- [ ] SH-SES-16 Button "Remove this one" (danger) hands the row to `onRemove`
- [ ] SH-SES-17 "Remove this one" disabled when `count<=1`, with the hint "An event needs at least one class or party."

## Tap table (fill in the handover `docs/briefs/editor-v2-slice7a-session-sheet.handover.md`; columns: button | destination | prototype/OLD; any OLD = not done)
| # | Button | Where | Result |
| 43 | Class / Masterclass / Party / Performance | session sheet, Type | Same sheet redrawn: Level for Class and Masterclass; group Teachers / DJs / Dancers; warning "<names> will be removed." when people no longer fit |
| 44 | Beginner / Improver / Intermediate / Advanced | session sheet, Level | Same sheet; chip picked / unpicked |
| 45 | Add | people group | Same sheet; the picked person is a chip |
| 46 | x (Remove <name>) | person chip | Same sheet; chip gone |
| 47 | Done | session sheet | Ends before start: error, sheet stays. Else `onDone(row)` |
| 48 | Remove this one | session sheet | `onRemove(row)`. Disabled when count<=1 |
Proven by component tests in 7a; the screen walk happens in 7b once the sheet is wired (say so).

## Tests (session.test.tsx, vitest; mock `searchPickerRows`)
Title for new and existing; type chips and aria-pressed; level chips only for Class/Masterclass, multi-pick; group label per type; Performance dancers show-only (no x, no Add, hint); chip x calls remove; "None yet"; Add disabled until a person is picked, picked person becomes a chip and is not offered twice; Party with old dancers (hint, x, no Add); `lostOnTypeChange` warning text for people and levels, nothing removed until Done; Done: error for equal times / end before start, allowed for end before 06:00 (past midnight), title defaults to the type label, people and levels dropped on Done; Remove disabled at count 1 with hint; new session has no Remove button; toast builders return the exact words.

## Handover
Write `docs/briefs/editor-v2-slice7a-session-sheet.handover.md`: built, filled tap table, the Performance deviation, assumptions (open_level, helper reuse), files and line counts, the props contract for 7b. Open no PR; push to `claude/editor-v2-s1c` as the dispatch rules say.
