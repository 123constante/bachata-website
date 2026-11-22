# Editor v2 slice 10a handover (Every <day> card + Name sheet)

## Built
- `v2/EveryBody.tsx` (new): card (usual flyer block + pill, name + status pill, When / Where / Price facts) and "About this event" rows (Name, Description, Music, Repeats, Organisers). Mounts WhereSheet / AboutSheet / FlyerSheet in `usual` mode and NameSheet. Every write is one `series.upsert` step (target `series`, `name` always present, `version` = series version) through `saveNow`; toast `savedLabel('usual', day)`.
- `v2/NameSheet.tsx` (new). `v2/copy.ts`: `V2.every` block. `v2/EditorV2.tsx`: `{every && <EveryBody .../>}` only. `__tests__/every.test.tsx` (new, 7 tests). No css.
- Undo: `inverseOf` already handles `series.upsert` from the exact `before` keys; no editorModel change. `before` = `{name, <same keys with old values>}`.

## Checklist
E-02..E-17 and SH-NAME-01..05 built (E-07/E-09/E-15/E-16/E-17 render, tap PENDING). E-10/E-11 tested absent.

## Tap table
| # | Button | Destination | prototype/OLD |
|---|---|---|---|
| 7 | Flyer and photos pill | Sheet "Flyer and photos" (usual gallery) | prototype |
| 9 | Where Change > | Sheet "Where" | prototype |
| 23 | Name | Sheet "Name" | prototype |
| 24 | Description | Sheet "Description" | prototype |
| 35 | Done (Name) | empty: "Add a name"; unchanged: closes, no save; else save + toast + Undo | prototype |
| 57-64 | flyer sheet buttons | series writes `default_cover_image_url` / `default_gallery` | prototype |

## PENDING (tap does nothing, flag OFF)
Music (10b), Organisers (10b), Repeats (11), When (11), Price (Tickets screen, later).

## Gaps / not buildable (exact)
- **Repeats end date:** only `ws.endedOn` (`ended_on`) is readable; no series "ends after" field. Row says "ends after <date>" only when `endedOn` is set, otherwise "no end date".
- **Organiser names:** loaded with `fetchOrganiserPages(ws.organiserIds)` (same query key as EventPageV2); while loading, or if it returns nothing, shows "2 organisers" style count.
- **Series city before:** `SeriesWorkspace` has no `default_city_id`; EveryBody reads it loosely. If absent, Undo of a venue change sets the city back to `null`. OWNER QUESTION: add `default_city_id` to the series read.
- **Gallery before** uses `ws.gallery` (the `gallery` column), not a `default_gallery` field.
- **When sub-line:** end time = start + `default_duration`; with no duration only the start shows.
- Remove flyer on Every sends `default_cover_image_url: null`.

## Files
EveryBody.tsx ~135 lines, NameSheet.tsx ~30, every.test.tsx ~120, copy.ts +19, EditorV2.tsx +2.

## Verified / Not verified
- Verified: `npx vitest run src/modules/organiser/p3/v2` 16 files, 206 pass. tsc (`-p tsconfig.app.json`): 0 errors in branch files (only pre-existing eventPage.proto.test.ts). eslint on my files clean. `check:mojibake` clean.
- Not verified: 390x844 walk, prod data-shape survey, pre-ship, /code-review, real upload. No PR (per brief).
