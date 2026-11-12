# Handover: Make cover / move / Remove in the P3 Pictures sheet (dt_86499e010b8a)

Brief: `docs/briefs/p3-photo-order.md` on `brief/organiser-p3-photo-order` (sha 6bd194a).
Branch: `claude/organiser-p3-photo-order`. One PR, no DB, no migration.

## Done
- `PicturesSheet` (`src/modules/organiser/p3/screens/DetailsScreen.tsx`): with `flags.organiserPhotoOrder`
  on it renders `PhotoOrderGrid` (new, `p3/screens/PhotoOrderGrid.tsx`) instead of the X grid. Flag off:
  the X grid is byte-for-byte the old one.
- The row is the cover first, then the gallery (the same model as the legacy sheet, PR #1599; it reuses
  `photoList` from `events/photoOrder.ts`). New pure helpers in `p3/model/photoOrder.ts` act by
  POSITION, so duplicate URLs are told apart.
- Tap a picture: Move earlier / Move later / Make cover / Remove (44px). A blocked control is disabled and
  its reason shows as text under the bar (first/last/only picture; the cover is already the cover; the
  cover cannot be removed here, with a different line for a lone cover).
- Save path unchanged: the Details draft's `cover` and `gallery`, sent by the ONE series.upsert
  (`detailsPlan`: `default_cover_image_url`, `default_gallery`). No new write path. A cover change on a
  multi-date event goes through the existing "which dates" ScopeSheet, as a cover upload already does.
- Remove is a delete-class write: it drops the URL from `default_gallery` on Save (no storage delete).
- CI: `VITE_ENABLE_ORGANISER_PHOTO_ORDER: 'true'` added to the P3 walk step of `e2e-smoke.yml`, so the
  flag-on walk runs in the gate (`check-p3-specs-not-skipped` passes). The shape walks remove through
  whichever sheet the build has; the flag-off X grid stays pinned by a unit test.

## Tests
- `p3/screens/__tests__/photoOrder.matrix.test.tsx`: model x every action for 0/1/lone cover/2/cover+2/30/
  cover+30, duplicate URLs, the last picture removed; the sheet through the real send path for
  0/0+cover/1/2+cover/30+cover, Make cover -> one upsert with both fields, last removed -> empty gallery,
  a failed save keeps the edit and the count, flag off -> X grid.
- `tests/e2e/walk-p3-series-pictures.spec.ts`: new flag-on case for 0/1/2/30 pictures, light and dark.

## Left / next
- Screenshots are made with `P3_PHOTO_SHOTS=<dir>`; the 30-picture sheet puts the action bar under the
  grid (scroll to reach it). A sticky bar was tried and covered the Done button, so it was dropped.
- Owner phone test on the preview with PHOTO_ORDER + SELF_SERVE + P3 on.
