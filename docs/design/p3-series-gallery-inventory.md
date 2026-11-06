# P3 series gallery: inventory

Source of truth for what the old area's series gallery does and where P3 now covers it.

| # | State / option | Old area | P3 | Public render |
|---|---|---|---|---|
| 1 | Empty ("No photos yet") | `events/EditorSheet.tsx` case 'gallery' (~L105-) | `DetailsScreen` PicturesSheet `p3-pictures-empty`, `L.detailsPicturesEmpty` | page hides block |
| 2 | Grid of tiles, remove each | EditorSheet `org-gallery-remove` | PicturesSheet `p3-picture-remove` (44px) | gallery on `/event/:id` |
| 3 | Add several (multi-file) | `onUploadGallery` in `events/Details.tsx:109` (slice to MAX_GALLERY) | PicturesSheet `add()` via `uploadEventPicture` (same as `DateFieldSheets.tsx` PhotosSheet L90-) | |
| 4 | Cap 30 (`MAX_GALLERY`, eventModel.ts:77) | add hidden at cap | `p3-pictures-max`; >30 stored = save blocked (`detailsProblems`) | |
| 5 | Upload failure keeps the list | sheet error | `p3-pictures-error` | |
| 6 | Untouched save sends nothing | `mediaCommand` null when same (`seriesExtras.ts:14`) | `DETAILS_SPECS` gallery `same` | |
| 7 | Save = one `series.upsert` `default_gallery` | `Details.tsx:134` on sheet close | `detailsPlan` payload `default_gallery` (equal to `mediaCommand`; test pins it) | |
| 8 | Not owner / profile unfinished / ended | read-only | `useEditLock`: row greyed | |
| 9 | Festival | n/a (team-edited, CONTRACT) | row greyed + `L.detailsPicturesFestival` | |
| 10 | Per-date photos | n/a | unchanged (`DateSheet.tsx:277`), pattern reused | |

Coverage: 9 of 9 old-area gallery states covered (row 10 is existing P3).

## Data source (read-only check, prod `apply_aggregate_write_p5`)
`default_gallery` is in the owner-writable `event_series_p5` upsert key list; the function refuses a non-array value (`jsonb_typeof`). Column: `event_series_p5.default_gallery`. Max count enforced client-side (30); no server cap found in the function text. Writers: series owners via `series_command_p5` / `series.upsert`.

## Deviation to note
Brief says reuse `mediaCommand`. The Details screen sends one combined save, so `detailsPlan` puts `default_gallery` in the same upsert payload; a test asserts the resulting command is deep-equal to `mediaCommand(...)` output when only the gallery changes. No new write path.
