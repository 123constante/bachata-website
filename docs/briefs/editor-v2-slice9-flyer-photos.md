# Brief: Editor v2 slice 9, Flyer and photos sheet + Photo/Video sheet, wired to the night card

Branch: claude/editor-v2-s1c
Size: 5 files, 390 lines
Repo: 123constante/bachata-website. Flag `organiserEditorV2` stays OFF; zero migrations; no admin change.

The prototype file is NOT reachable from the cloud. Everything you need from it is embedded below; it is the spec, copy words exactly. Slices 1-8 are on the branch: read `docs/briefs/editor-v2-slice8-where-about.handover.md` and `docs/briefs/editor-v2-slice7b-when-sheet.handover.md` first (`V2Sheet`, `V2` copy, `OnSave` type, `savedLabel`, `SheetMode`, how WhereSheet/AboutSheet are mounted from NightCard and `back(...)`). DESIGN-REGISTRY rows 61-81 win over this brief.

## Scope
- `FlyerSheet` and `PhotoSheet`, opened from the night card's flyer pill "Flyer and photos" (tap 7, `data-testid="fact-flyer"`, already rendered, no handler yet: wire it). On This night they save as a NIGHT override (`occurrence.set_override`: flyer key `cover_image_url`, gallery key `gallery`).
- Both are CONTROLLED components (props: current flyer url, gallery `string[]`, `mode: SheetMode` from WhereSheet.tsx, `dateWords`, `dayName`, `changed`, callbacks) so slice 10 mounts them on the Every card and slice 11 on the one-off event page (E-05). The USUAL write (series default_cover_image_url / default_gallery) is NOT built here: say so in the handover; component tests prove `usual` / `oneOff` modes call the callbacks.

## Files (touch only these)
- src/modules/organiser/p3/v2/FlyerSheet.tsx (new): `FlyerSheet` (flyer + gallery grid + add photos + add video link). Opening a tile opens PhotoSheet inside the same component state (sheet swap, not stacking): Back returns to the flyer sheet.
- src/modules/organiser/p3/v2/PhotoSheet.tsx (new): `PhotoSheet` (Photo or Video).
- src/modules/organiser/p3/v2/NightCard.tsx: wire the pill; night saves go through the existing `onSave` prop (`OnSave`) exactly like `saveVenue`; Back to usual flyer reuses `back('flyer', V2.flyerPart...)` / `backToUsualStep` (already exists for `flyer`): reuse, do not rewrite.
- src/modules/organiser/p3/v2/copy.ts: add the lines below.
- src/modules/organiser/p3/v2/__tests__/flyer.test.tsx (new)
Do NOT edit EditorV2.tsx, NightV2, NightHub, SaveBar, saveNow.ts, editorModel.ts (if Undo for a gallery or flyer step needs an `inverseOf` case, pass the exact `before` object like `saveVenue` does; only if that cannot work, STOP and say so in the handover, do not touch editorModel), anything in `shared/`, `dates/`, `events/`. Max 15 lines to `v2/v2.css` only if unavoidable (6th file, tell me). Files over 2 KB: `scripts/safe-edit.py` / `scripts/safe-write.py`. JSX entities only, explicit px for sizes.

## Data and writes (reuse, do not rewrite)
- Picture upload: `uploadEventPicture(seriesId, file)` in `src/modules/organiser/events/media.ts` (checks, re-encodes, uploads, returns a public URL, throws an Error with plain copy). Show that error text under the button on failure; show "Uploading..." while busy. File input: `accept={FLYER_ACCEPT}` from `shared/flyerModel`; "Choose a new flyer" and "Add photos" each trigger a hidden `<input type="file">` (Add photos: `multiple`) so the phone photo picker opens. The seriesId is `ws.series.id` (props from NightCard).
- Night flyer write: step `{ target:'occurrence', id: date.id, version: date.version, command:{kind:'occurrence.set_override', payload:{ cover_image_url: url }}, order:1, part: V2.flyerPart }` via `onSave(steps, before, label)`; `before` = `{ cover_image_url: dt.coverImageOverride }`. Toast label per mode via `savedLabel(mode, dateWords)`, with Undo.
- Remove the flyer on a night: check whether the override writer can express "no flyer for this night" (look at how `buildOverridePatch` / `seriesCommands` OVERRIDE keys treat `''` vs `null`; null = clear the night key = back to usual, which is NOT what Remove means). If an honest blank exists, use it. If not, do NOT fake it: hide "Remove the flyer" on `night` mode, keep it in `usual` / `oneOff` modes (callback), and write "Night remove flyer: needs <exact thing you checked>" in the handover (owner question). Tap 58 then = test in usual mode only.
- Night gallery write: `dateGalleryPatch(ws, detail, next)` in `p3/data/dateFields.ts` (returns `{gallery: next}`, `{gallery:null}` when equal to the usual list, or null when over MAX_GALLERY / unchanged): use it, step `part: V2.galleryPart`, `before` = `{ gallery: dt.galleryOverride }`. Current list = `dateGalleryOf(ws, dt)`. Gallery items are URL strings. A video is an item whose URL is a video link: classify with the existing `src/lib/isDirectVideoUrl.ts` plus YouTube/Vimeo hosts (see `components/VideoEmbed.tsx` / `VideoFrame.tsx` for the host test; reuse, add no new regex copy if one exists); one helper `isVideoUrl(url)` local to FlyerSheet.tsx. Photo tile = `<img>` thumbnail (object-fit cover); video tile = dark tile with play mark.
- "Add a video" takes the link field value, trims, ignores empty, rejects non-http(s) with the short message "Paste a full link starting with https://", appends to the gallery (save at once), clears the field; sheet stays open. "Add photos" uploads each picked file then ONE save with all new urls; sheet stays open. Gallery max = MAX_GALLERY (from dateFields); at the limit show "That is the most photos and videos for one event." and disable the two add buttons.
- Remove a photo/video (PhotoSheet): saves the list without it at once, returns to FlyerSheet (open again), toast "Photo removed" / "Video removed" with Undo (Undo puts the item back at its place: the `before` list does it).
- Own photos on a night do NOT set "Changed" / "Only this night" (SH-FLY-15): `FACT_KEYS.flyer` stays `['cover_image_url']` only; do not add `gallery`. Check the existing test and keep it green.
- The flyer pill must show "Flyer and photos" (exists); the `own.flyer` tag logic stays as is.

## Embedded prototype (spec)
```
flyer sheet 'Flyer and photos':
  <div class="flyer f1|f2|none" style="border-radius:8px"><span>{fl ? fl : 'No flyer'}</span></div>   // 4:3 preview; real image instead of "(sample)"
  button btn pri 'Choose a new flyer'   (spec checklist says secondary: build it SECONDARY, class btn sec)
  button btn dan 'Remove the flyer'     (only when there is a flyer)
  link btn sec 'Back to the usual flyer' (This night only, only when changed)
  galleryBlock:
    <div class="lab">{night ? 'Photos and videos from this night' : 'Photos and videos'}{count ? ' &middot; ' + count : ''}</div>
    <p class="txt">{night: 'Photos and videos from this night only. Dancers see them on this night, with the event gallery.'
                    oneOff: 'Photos and videos dancers see on the event page.'
                    else:   'Photos and videos dancers see every ' + dayName + '.'}</p>
    {n ? <div class="ggrid">  tiles: <button class="gtile g{k}{video ? ' gv' : ''}" aria-label="{Photo|Video} {i+1}, tap to see it large or remove it">{video ? <span class="gplay">&#9654;</span> : ''}</button> </div>
         <p class="hint">Tap a photo or video to see it large or remove it.</p>
       : <p class="hint">Nothing here yet.</p>}
    button 'Add photos' (class btn sec)
    field  'Or add a video link' (type url, placeholder "https://")
    button 'Add a video' (class btn sec)
  count word: "4 photos, 1 video" (photos first, then videos; singular for 1; only the parts that are non-zero: "2 photos", "1 video")

photo sheet 'Photo' | 'Video':
  <div class="gbig g{k}{gv}">{video ? play mark : ''}</div>   // 4:3, radius 8px; real image for a photo
  {video ? <div class="box">{url}</div> : ''}                  // link in a link box (render as <a href target=_blank rel=noopener>)
  button btn dan 'Remove this photo' | 'Remove this video'
  button btn sec 'Back to flyer and photos'

CSS spec: grid 3 across, gap 6px, tile square (aspect-ratio 1), radius 8px; video tile background linear-gradient(#14161C,#565B69), play mark 24px white; gbig aspect-ratio 4/3 radius 8px.
```
NOT built (do not render): prototype hint "Sample flyer and pictures. The real one opens your photos." and the word "(sample)".

## Copy (add to `V2`, exact; reuse any that exist; `V2.flyerPart`/`V2.galleryPart` are new names: reuse existing `V2.flyer`="Flyer" / `V2.gallery`="Gallery" for the step `part` instead if they exist)
"Flyer and photos" (exists) / "Choose a new flyer" / "Remove the flyer" / "Back to the usual flyer" / "Photos and videos from this night" / "Photos and videos" / the three gallery texts above / "Tap a photo or video to see it large or remove it." / "Nothing here yet." / "Add photos" / "Or add a video link" / "https://" / "Add a video" / "Photo" / "Video" / "Remove this photo" / "Remove this video" / "Photo removed" / "Video removed" / "Back to flyer and photos" / `Photo {n}, tap to see it large or remove it` / "Uploading..." / "Paste a full link starting with https://" / "That is the most photos and videos for one event." Toasts for flyer/gallery add use `savedLabel(mode, dateWords)`.

## Prototype checklist (every line built; one OLD = not done)
- [ ] E-05 night card flyer pill "Flyer and photos" opens the sheet (night gallery on This night); usual/one-off mounting = slices 10/11 (component test only)
- [ ] SH-FLY-01 Title "Flyer and photos"
- [ ] SH-FLY-02 Flyer preview at top (4:3, radius 8px); no flyer = grey block "No flyer"
- [ ] SH-FLY-03 "Choose a new flyer" (secondary) opens the phone photo picker; saves at once; toast per mode with Undo
- [ ] SH-FLY-04 "Remove the flyer" (danger) saves at once, toast with Undo (night: see Data and writes, may be a reported gap)
- [ ] SH-FLY-05 Link "Back to the usual flyer" (This night, only when changed)
- [ ] SH-FLY-06 Gallery label night / not night, with count " · 4 photos, 1 video"
- [ ] SH-FLY-07 text night
- [ ] SH-FLY-08 text Every "Photos and videos dancers see every <day>."
- [ ] SH-FLY-09 text one-off
- [ ] SH-FLY-10 Grid 3 across, 6px gap, radius 8px; video tile dark with 24px play mark
- [ ] SH-FLY-11 Tile aria-label "Photo 1, tap to see it large or remove it" ("Video" for a video; number counts up)
- [ ] SH-FLY-12 Hint "Tap a photo or video to see it large or remove it."; empty: "Nothing here yet."
- [ ] SH-FLY-13 "Add photos" (secondary) opens the phone photo picker
- [ ] SH-FLY-14 Field "Or add a video link", placeholder "https://", button "Add a video"
- [ ] SH-FLY-15 Own photos on a night do NOT set Changed / "Only this night"
- [ ] SH-FLY-16 "(sample)" and the sample hint NOT built (correct to omit)
- [ ] SH-PHOTO-01 Title "Photo" or "Video"
- [ ] SH-PHOTO-02 Picture large (4:3, radius 8px); video shows its link in a link box
- [ ] SH-PHOTO-03 "Remove this photo/video" (danger): removes at once, toast "Photo removed"/"Video removed" with Undo, and "Flyer and photos" is open again
- [ ] SH-PHOTO-04 Link "Back to flyer and photos"

## Tap table (fill in `docs/briefs/editor-v2-slice9-flyer-photos.handover.md`; columns: button | destination | prototype/OLD; any OLD = not done)
| # | Button | Where | Result |
| 7 | Flyer and photos pill | This night card | Sheet "Flyer and photos" (night gallery) |
| 57 | Choose a new flyer | sheet | Phone photo picker, then saved; toast + Undo |
| 58 | Remove the flyer | sheet | Flyer gone; toast + Undo (night: possibly NOT BUILT, owner question) |
| 59 | Back to the usual flyer | sheet | Sheet closes; toast "Back to usual for <date>" + Undo |
| 60 | photo or video tile | sheet | Sheet "Photo" or "Video" |
| 61 | Add photos | sheet | Phone photo picker; photos added; sheet stays open |
| 62 | Add a video | sheet | Video tile added from the link field; sheet stays open |
| 63 | Remove this photo / video | Photo / Video sheet | "Flyer and photos" open again; toast "Photo removed"/"Video removed" + Undo |
| 64 | Back to flyer and photos | Photo / Video sheet | Sheet "Flyer and photos" |
Tests render NightCard with mocked detail query, `uploadEventPicture` and `onSave` (7, 57, 59-64); FlyerSheet in `usual` / `oneOff` mode for texts and 58.

## Tests (flyer.test.tsx, vitest)
Pill opens sheet; texts per mode (night / Every with dayName / oneOff); count word cases (0, 1 photo, 4 photos + 1 video); tile aria-labels; empty hint; choose flyer: upload mocked, one onSave with cover_image_url step, night toast; upload error shown; add photos: two files, ONE save with both urls, sheet stays open; add video: valid link saves, invalid shows message, empty ignored; limit disables adds; tile opens PhotoSheet (Photo vs Video title, link box); remove saves list without item, returns to flyer sheet, toast text, `before` = old list; Back links; own photos do not set `changed` (ownedKeys unaffected by gallery).

## Handover
Write `docs/briefs/editor-v2-slice9-flyer-photos.handover.md`: built, filled tap table, not-buildable (exact), files and line counts, tests run (`npx vitest run src/modules/organiser/p3/v2`, tsc, eslint on your files; note pre-existing errors in eventPage.proto.test.ts tsc and V2Sheet.tsx eslint are not yours). Push to `claude/editor-v2-s1c` as the dispatch rules say; open no PR.
