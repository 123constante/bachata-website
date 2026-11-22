# Editor v2 slice 9 handover (Flyer and photos sheet + Photo/Video sheet)

## Built
- `v2/FlyerSheet.tsx` (new): `FlyerSheet` (controlled: `seriesId, flyer, gallery, mode, dateWords, dayName, changed, onFlyer(url|null,label), onGallery(next,label), onBackToUsual, onClose`), `isVideoUrl`, `countWord`. Opening a tile swaps to `PhotoSheet` inside the same component (no stacking); Back / Remove return to the flyer sheet.
- `v2/PhotoSheet.tsx` (new): Photo / Video sheet, video link in a link box (`<a target=_blank rel="noopener noreferrer">`).
- `v2/NightCard.tsx`: pill `fact-flyer` opens the sheet (only when `onSave` is passed). `saveFlyer` sends `occurrence.set_override {cover_image_url}` (part `V2.flyer`), `before = {cover_image_url: coverImageOverride}`. `saveGallery` uses `dateGalleryPatch` (part `V2.gallery`), `before = {gallery: galleryOverride}`. Back to usual reuses `back('flyer', V2.flyer)`. `FACT_KEYS.flyer` unchanged (own photos do not set Changed; tested).
- `v2/copy.ts`: `V2.flyerPhotos` block. `v2/__tests__/flyer.test.tsx` (new, 15 tests). No css (inline styles); no sixth file.

## Not built: USUAL write
`usual` / `oneOff` modes work as component only (tests prove callbacks). Series `default_cover_image_url` / `default_gallery` writes are slices 10 / 11.

## Not buildable (exact)
- **Night remove flyer: needs an override value meaning "no flyer for this night".** Checked `shared/seriesCommands.ts` `overrideCommand`: a text key that is blank or `''` is sent as `null` (= back to usual), so a night cannot own "no flyer". "Remove the flyer" is hidden on `night` mode (shown in `usual`/`oneOff`). Tap 58 is tested in usual mode only. OWNER QUESTION.
- **`isDirectVideoUrl` not used as-is:** it (and `parseVenueVideoUrl` "direct") also match any Supabase storage URL, which is where uploaded PHOTOS live, so every photo would show as a video. `isVideoUrl` = YouTube/Vimeo via `parseVenueVideoUrl`, or a direct link with .mp4/.webm/.mov/.m4v. No new regex host copy besides that extension test.

## Tap table
| # | Button | Destination | prototype/OLD |
|---|---|---|---|
| 7 | Flyer and photos pill | Sheet "Flyer and photos" | prototype |
| 57 | Choose a new flyer | picker, save, toast + Undo | prototype |
| 58 | Remove the flyer | usual/oneOff callback; hidden on night | prototype (night NOT BUILT, see above) |
| 59 | Back to the usual flyer | closes, `back('flyer')`, toast + Undo | prototype |
| 60 | tile | Photo / Video sheet | prototype |
| 61 | Add photos | picker, ONE save, sheet stays | prototype |
| 62 | Add a video | link saved, field cleared, sheet stays | prototype |
| 63 | Remove this photo / video | flyer sheet open again, toast + Undo | prototype |
| 64 | Back to flyer and photos | flyer sheet | prototype |

## Verified / Not verified
- Verified: `npx vitest run src/modules/organiser/p3/v2`: 15 files, 199 pass. tsc (`-p tsconfig.app.json`): 0 errors in branch files. eslint on my files: 0 errors (5 react-refresh warnings, same kind as existing). `check:mojibake` clean.
- Not verified: 390x844 browser walk, prod data-shape survey, pre-ship, /code-review, EditorV2-level mount (NightCard tested directly), real upload against storage, `ws.gallery` shape on prod. Flag OFF; no PR (per brief). tsc run on the pre-commit tree.
