# Editor v2 slice 10b handover (Music + Organisers sheets, Every tab)

## Built
- `v2/MusicSheet.tsx` (new): five chips (Bachata, Sensual, Dominican, Salsa, Kizomba), `aria-pressed`, `.tchip`/`.on`. Done: same set closes with no save; else one `series.upsert` (`name` + `default_music_styles` in chip order, then stored extras kept), toast `savedLabel('usual', day)` + Undo (`before` = `{name, default_music_styles: old}`).
- `v2/OrgSheet.tsx` (new): group "Who runs it" via `PeopleGroup` (`role={null}`), `<select aria-label="Organiser page">` of `addablePages(myPages, ids)` + Add, `ADD_NONE_LEFT` when none, last chip has no x + `LAST_ORGANISER_REASON`, read-only via `organisersOff` (chips no x, no add, reason as hint, Done closes). Done: `organisersCommand(stored, ids)`; null closes with no save; else one `series.set_organisers` step through `saveNow(steps, [{organiser_ids: old}], label)`.
- `EveryBody.tsx`: `onOpen` for music + organisers, mounts both, `saveMusic` / `saveOrgs`. `copy.ts`: `V2.every` music/org lines.
- `__tests__/everyMusicOrg.test.tsx` (new, 7 tests). `every.test.tsx`: the "pending rows" test no longer lists Music / Organisers.

## Checklist
- [x] SH-MUSIC-01, -02, -03  - [x] SH-ORG-01, -02, -03  - [x] Music and Organisers rows open the sheets; Repeats / When / Price still pending.

## Tap table
| # | Button | Destination | prototype/OLD |
|---|---|---|---|
| 25 | Music row | Sheet "Music" | prototype |
| 28 | Organisers row | Sheet "Organisers" | prototype |
| 45 | Add | same sheet; picked page added as a chip | prototype |
| 46 | x (Remove <name>) | same sheet; chip gone | prototype |
| 76 | Bachata/Sensual/Dominican/Salsa/Kizomba | same sheet; chip on/off | prototype |
| 77 | Done (Music) | closes; "Saved for every <day>" + Undo | prototype |
| 81 | Done (Organisers) | closes; "Saved for every <day>" + Undo | prototype |

## Deviations
- **Add = a select of the viewer's own live pages** (AW1: you may only link pages you run), replacing the prototype's free-text add. `useSeriesRole` is called inside `OrgSheet` (so it only runs when the sheet is open; other Every tests need no new mock). `myPages` (`HomeOrganiser[]`) is cast to `MyPage[]` (compatible fields).
- Lifecycle: `s.lifecycle_status` (no `ws.lifecycle`). `organisersOff` also applies the AW1 gate (`AW1_APPLIED`).
- Existing `every.test.tsx` "pending" assertion narrowed (Music / Organisers no longer pending).

## Not buildable
- Names for chips come from `fetchOrganiserPages`; before it loads, a chip falls back to the page's name in `myPages`, else "Organiser".

## Files
MusicSheet 31, OrgSheet 53, EveryBody 135 (+11), copy.ts +8, everyMusicOrg.test 109.

## Verified / Not verified
- Verified: `npx vitest run src/modules/organiser/p3/v2` 17 files, 213 pass. tsc `-p tsconfig.app.json`: 0 errors in p3/v2 files other than pre-existing eventPage.proto.test.ts. eslint on my files clean. `check:mojibake` clean.
- Not verified: 390x844 walk, prod data-shape survey, pre-ship, /code-review, V2Sheet.tsx eslint (pre-existing). No PR (per brief).
