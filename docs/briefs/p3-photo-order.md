# Build: Make cover / move / Remove in the P3 Pictures sheet (branch claude/organiser-p3-photo-order)

Lane: normal. One branch, one PR, no DB, no migration. Behind the existing flag `VITE_ENABLE_ORGANISER_PHOTO_ORDER` (`flags.organiserPhotoOrder`, default off).

Owner: "Build this". Owner words that started it: "still old" (the P3 Pictures sheet on the flagged preview still shows the X-remove grid).

## Who and what
Organisers editing an event in the P3 Pictures sheet. After this they can: make a photo the cover, move a photo earlier or later, remove a photo (replaces the X grid). Applies wherever the P3 Pictures sheet already appears (one-offs, festivals, series). The old legacy Gallery sheet is untouched.

## Where
`PicturesSheet` in `src/modules/organiser/p3/screens/DetailsScreen.tsx` (title L.detailsPictures, grid `.p3-photo-x`). Read the finding first: `git show origin/claude/organiser-photo-order:docs/handover/photo-order-flag-build.md` (PR #1604).

## Reuse, do not reinvent
PR #1599 (merged, on main) built the behaviour for the legacy sheet: `PhotoOrderBody` in `src/modules/organiser/events/` and `photosCommand` in `src/modules/organiser/events/photoOrder.ts`. Reuse them or the same pure ordering helpers; same save path (series.upsert RPC writing `event_series.default_gallery`, permission `_assert_can_edit_series_p5`). Do not add a new write path. Cover from P3 needs a series cover write: use what `photosCommand` does.

## Do
1. When `flags.organiserPhotoOrder` is on, PicturesSheet shows tap-a-photo actions: Make cover, move earlier, move later, Remove. Flag off: sheet unchanged.
2. Empty/one/two/many photos each say what to do; disabled controls say why (first photo cannot move earlier; a lone cover explains it cannot be removed if that is the rule, else Remove works). Taps >= 44px (phone html font ~13.5px: explicit px).
3. Extend `tests/e2e/walk-p3-series-pictures.spec.ts` with a flag-on case; table-driven unit tests for 0/1/2/30 photos, last photo removed, duplicate URLs, failed save (stale row count must not stick).
4. Walk at 390x844 with PHOTO_ORDER + SELF_SERVE + P3 on, 0/1/2/30 photos. Screenshots in the PR.
5. PR body: Verified on real data + Phone QA blocks exact labels.

## Done
Pushed to claude/organiser-p3-photo-order with a `[worker-done <ticket>]` commit; PR opened; reply lists checks per job and Verified / Not verified. The Remove path is a delete-class write: say so in the PR so the lead posts the independent review comment.
