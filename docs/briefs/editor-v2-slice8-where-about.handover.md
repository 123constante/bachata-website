# Editor v2 slice 8 handover (Where sheet + Description sheet)

## Built
- `v2/WhereSheet.tsx` (new, 58 lines): `WhereSheet`, `savedLabel(mode, dateWords)`, type `SheetMode`. Controlled: `current`, `mode`, `dateWords`, `changed`, `onSave(venueId)`, `onBack`, `onClose`. Real list from `useVenueOptions()`, client-side filter on name + area.
- `v2/AboutSheet.tsx` (new, 45 lines): `AboutSheet`, `aboutToSave`. Controlled: `current`, `usual`, `mode`, `dateWords`, `changed`, `onSave(value | null)`, `onBack`, `onClose`.
- `v2/NightCard.tsx` (+33): the Where and Description facts open the sheets (only when `onSave` is passed). Night venue save sends the `occurrence.set_override` step with `{venue_id, city_id}` from `venueOverridePatch` (the old editor's helper; picking the series' usual venue sends nulls). `before` for Undo = `venueOverridePatch(dt.venueOverride)`. About sends `{description}`, `before = {description: dt.descriptionOverride}`. Back to usual reuses the existing `back('where'|'about', ...)`.
- `v2/copy.ts` (+15): `V2.whereAbout` block. Existing `V2.where`, `V2.description`, `V2.session.saved*` reused.
- `__tests__/whereAbout.test.tsx` (new, 179 lines, 15 tests). No css added; no sixth file.

## Not built: USUAL write
The sheets work in `usual` and `oneOff` mode (component tests prove `onSave` gets the picked value, no Back link). The series write (`default_venue_id` / `default_description`) is NOT built; slices 10 and 11 mount it.

## Not buildable (exact)
- **Typed new venue (SH-WHERE-04 / -06, tap 51): needs a venue-create writer from a typed name.** Checked: `organiser/shared/publicVenues.ts` (read only: `get_organiser_venue_options_v1`), `shared/createCity.ts` (cities only), `dates/venueOverride.ts` (venue_id + city_id only), the `p3/new/sheets.tsx` and `flows/` venue pickers (pick from the list only). No `create_venue` RPC or owner command was found. The "Use ..." row is not rendered; a test asserts it is absent. SH-WHERE-08 hint correctly omitted.

## Tap table
| # | Button | Destination | prototype/OLD |
|---|---|---|---|
| 9 | Where Change > (night card) | Sheet "Where" | prototype |
| 11 | Description Change > (night card) | Sheet "Description", label "What dancers read on <date> only" | prototype |
| 24 | Description (Every / one-off) | AboutSheet `usual`/`oneOff`, label "What dancers read"; component test only | prototype |
| 49 | typing in "Search for a venue" | list filters as you type | prototype |
| 50 | venue row | closes, saves night override, toast + Undo | prototype |
| 51 | Use "<typed>" | not built | NOT DONE (see above) |
| 52 | Back to the usual venue | closes, `back('where')`, toast "Back to usual for <date>" + Undo | prototype |
| 74 | Done | closes, saves (or no save if unchanged), toast + Undo | prototype |
| 75 | Back to the usual description | closes, `back('about')`, toast + Undo | prototype |

## Verified / Not verified
- Verified: `npx vitest run src/modules/organiser/p3/v2`: 14 files, 185 pass. tsc run on the pre-commit tree (`-p tsconfig.app.json`): 0 errors in branch files. eslint on my files: 0 errors (5 react-refresh warnings, same kind as existing). `check:mojibake` clean.
- Not verified: 390x844 browser walk, prod venue-shape survey, pre-ship, /code-review, EditorV2-level mount (NightCard tested directly). Flag OFF; no PR (per brief). The edit hook did not block raw Edit/Write, so `safe-edit.py` was not used.
