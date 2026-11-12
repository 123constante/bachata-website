# Handover: photo-order flag "still old" on the preview (dt_037e7a625a28)

Brief: `docs/briefs/photo-order-flag-build.md` on `brief/organiser-photo-order`.
Outcome: **case 3. The flag is NOT dropped from the build.** No config change made.

## What was checked

1. **Does Vite expose `process.env.VITE_*` to `import.meta.env`?** Yes. Vite 5.4.21's
   `loadEnv` merges any `VITE_`-prefixed `process.env` variable into `import.meta.env`,
   and those values override `.env` files. A bare Vite lib build of
   `import.meta.env.VITE_ENABLE_ORGANISER_PHOTO_ORDER === 'true'` gave `const on = true;`
   with the env var set and `false` without it.
2. **Does the real `react-router build` inline it?** Yes, in both bundles.
   `VITE_ENABLE_ORGANISER_PHOTO_ORDER=true npx react-router build` produced:
   - client `build/client/assets/lib-event-rules-*.js`: `organiserPhotoOrder:!0`
   - server `build/server/.../server-build-*.js`: `organiserPhotoOrder: true`

   This is the same path every other `featureFlags.ts` flag takes (none of them are in `define`).
   `VITE_ENABLE_GOING_PREVIEW` is in `define` for a different reason: it is read next to
   `VERCEL_ENV`, so both reads become string literals and no `import.meta.env` object gets
   inlined. That define is not what lets a flag reach the build.

## Why the owner saw the old sheet

PR #1599 put the new order/cover UI (`PhotoOrderBody`) in the **legacy** organiser editor,
on the `gallery` case in `src/modules/organiser/events/EditorSheet.tsx`, which the old
`/account/events/:id/details` screen opens. The sheet the owner opened is the **P3 "Pictures"
sheet**: `PicturesSheet` in `src/modules/organiser/p3/screens/DetailsScreen.tsx`, with the
title `L.detailsPictures = 'Pictures'`. #1599 did not touch that file, and it does not read
`organiserPhotoOrder`. Its grid is still the X-remove tiles (`.p3-photo-x`) plus "Add pictures".

When `organiserP3` is on (it is in the preview), `r1AreaRedirect` (`src/lib/organiserAreaHome.ts:68`)
sends `/account/events/:id/details` to `/account/p3/events/:id/details`. So organisers using
P3 never reach the reworked legacy Gallery sheet.

## Walk at 390x844 with the flag ON

`VITE_ENABLE_ORGANISER_PHOTO_ORDER=true VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true`:
- `tests/e2e/walk-p3-series-pictures.spec.ts`: 14/14 pass. On the first run, 2 tests timed out
  while the dev server was still starting cold; on the rerun all 14 passed. That spec asserts
  the X-remove sheet, so with the flag on, the P3 sheet is unchanged.
- A one-off probe opened the P3 Pictures sheet with 2 photos: 0 "Make cover" controls,
  2 `.p3-photo-x` remove buttons. This matches the owner's "still old".

## Next step (owner decision; not done here, because the brief says not to touch the photo-order UI)

Bring the order/cover behaviour to the P3 `PicturesSheet` behind `flags.organiserPhotoOrder`.
That needs a series cover write from P3 (the legacy one is `photosCommand` in
`src/modules/organiser/events/photoOrder.ts`). Then extend `walk-p3-series-pictures.spec.ts`
with a flag-on case. That is a new build brief.

## Not verified
- The deployed preview `om32c27ae` itself. Its build env and commit were not inspected (no Vercel
  call made). The conclusion rests on the local build and walk above.
