# Dancer rebuild W2d: Photo (`/app/me/photo`)

Branch `arc/dancer-app-w2d`, from `claude/dancer-app-r1a` @ `9fc95715`. No PR (the orchestrator merges the sub-branch).

## What changed (files)

All inside `src/modules/dancer-app/screens/photo/` unless noted.

| File | What |
|---|---|
| `PhotoScreen.tsx` | The screen: pick (camera + library inputs) -> crop (drag, pinch, wheel, slider, arrow keys, `+`/`-`) with the dashed head-oval + shoulders guide -> preview ("This is how people will see you.") -> save. Failure states each keep the crop and offer a way out. |
| `cropModel.ts` | Pure maths: view clamp / pan / zoom, EXIF orientation matrices, `renderCrop` (one canvas transform, 1024x1024), JPEG header readers (`readOrientation`, `readJpegSize`), `orientationToApply`. |
| `decodeImage.ts` | `createImageBitmap(file, { imageOrientation: 'from-image' })`, header check, own rotation fallback, refuses < 256 px (short side, after rotation). |
| `photoFlow.ts` | `replacePhoto`: upload -> save `{avatar_url}` -> delete previous own object (swallowed on failure). `deleteOwnPhoto`. |
| `photoScreenDeps.ts` | Test seam (`photoScreenDeps`) and `returnPathFor` (`sanitizeReturnTo`, default `/app/me`, never back to the photo screen). |
| `useMyDancerEdit.ts` | W1 did not export `useMyDancerEdit`; same query key `['my-dancer-edit', userId]` kept here. **Duplicate, flagged: delete once W1's lands** (`// ORCHESTRATOR:` comment in the file). |
| `__tests__/*` | `cropModel.test.ts`, `photoFlow.test.ts`, `PhotoScreen.test.tsx` (73 tests), helpers `rasterCtx.ts`, `jpegFixture.ts`. |
| `tests/e2e/dancer-app/photo.spec.ts` | Playwright at 390x844 (5 tests, network order asserted). |
| `docs/handover/dancer-rebuild-w2d/*.png` | 390x844 screenshots: 1-pick, 2-crop, 3-preview, 4-refused, 5-upload-failed, 6-save-failed, 7-offline. |

No W1 file edited. No new fetch client: upload is the existing `uploadToR2`; the delete goes through the same `supabase.functions.invoke` client.

## Decisions and INTERFACE deviations

1. **Network order is invoke -> save -> delete, not presign -> PUT -> save -> delete.** The existing `uploadToR2` uses the PROXY mode of `storage-sign-upload` (one multipart call; the browser never PUTs to R2). Reused as is, as the brief says.
2. **`storage-delete-object` has no client wrapper anywhere on `origin/main`** (docs/briefs/storage-callers-handover.md: "nothing in src/ or app/ calls it"). `deleteOwnPhoto` in `photoFlow.ts` is a 3-line `supabase.functions.invoke('storage-delete-object', { body: { bucket: 'avatars', publicUrl } })`. **The request body shape is NOT verified against the deployed function (v12)**, which I cannot read from this repo. A wrong shape only means the old object is not deleted (failure is logged and swallowed; the save already succeeded). **Owner/orchestrator: confirm the body shape.**
3. **Tiny photos**: the existing validator has no minimum size, so the screen refuses < 256 px (short side, after rotation) with its own copy (`TOO_SMALL_COPY`). Other refusals (SVG, HEIC/non-image, > 5 MB) show the existing `validateImageFile` copy plus "Pick another photo to carry on."
4. **HEIC**: not in the validator's allow-list, so it is refused with the existing "Only image files are allowed (JPG, PNG, WebP, GIF)" line. Note: many phones convert HEIC to JPEG when `accept="image/*"` is used; a camera capture arrives as JPEG.
5. **Size cap**: the existing validator caps at 5 MB (the brief says "existing size rule").
6. **EXIF**: ask the decoder for `from-image`, then compare the bitmap size with the JPEG's stored size; if a browser ignored the option for orientations 5-8, `renderCrop` rotates it. Flip-only orientations 2-4 are trusted to be handled by the decoder (cannot be told apart by size).
7. **Retry after a failed save reuses the uploaded URL** (no second upload, no orphan).
8. **Delete only runs when there is a previous `avatar_url` that differs from the new one.**
9. **`test:e2e` is an explicit spec list in `package.json` (a W1 seam file I may not edit): `tests/e2e/dancer-app/photo.spec.ts` must be ADDED BY NAME by the orchestrator** or it does not gate.
10. Error copy for save failures comes from `DancerApiError` (`api/errors.ts`, `copyFor`). The round-2 codes (`invalid_url` for `avatar_url` etc.) that W1-finish adds land through the same mapping; nothing here depends on them. `photo_required` cannot happen here (we never send null).
11. Release-2 refusals ("closer photo", "two people") and background removal are NOT built; the mockup's two red messages are not rendered.

## Shapes surveyed

No new database survey: this screen reads `my_dancer_edit_v1` through the W1 shapes (`DANCER_SHAPES`, the plan's section-3 survey: 152 live profiles, 97 with a photo). Relevant split: photo present vs absent. The screen tests run the save flow over eight of them: `emptyStub`, `nameCityOnly`, `adminUnclaimedPhotoless` (first photo: no delete) and `fourFieldComplete`, `completeAllExtras`, `claimedAdmin`, `paused`, `namelessProfile` (replacing: old object deleted AFTER the save). `authUserNoPersona` covers a profile that cannot load. File shapes: portrait JPEG with EXIF 6, landscape, square, tiny, SVG, HEIC, PDF, oversized.

## Red-first proof (mutants against the finished code, then restored)

| Mutant | Result |
|---|---|
| Delete the old object BEFORE the save (swapped the two blocks in `replacePhoto`) | 12 tests failed, e.g. `save order x shape fourFieldComplete > replacing: ... upload -> save -> delete` and `save fails with area_closed: ... old photo NOT deleted` |
| `saveMyDancerProfile({ avatar_url: null }, ...)` | 14 failed, e.g. `save order x shape emptyStub > first photo`, plus `realPhotoDeps.save sends the one replace-only key` |
| `renderCrop` ignores the EXIF orientation (`orientation = 1`) | 8 failed: orientations 2-8 pixel-corner table and `a portrait phone photo (raw landscape, orientation 6) is cropped square from the ROTATED image` |

(Tests were written together with the code; "red-first" here is proven by the mutants above, not by a pre-code failing run.)

## CI per-job table (run locally, Node 22 sandbox)

| Job / command | Result |
|---|---|
| `npx vitest run src/modules/dancer-app/screens/photo` | PASS, 73/73 |
| `npm run typecheck` | 96 errors; all pre-existing (my folder: 0; one real TS error I introduced was fixed). Baseline in `scripts/pre-ship.mjs` is 106. |
| `npx eslint src/modules/dancer-app/screens/photo` | 0 errors, 0 warnings |
| `npm run build` | PASS. `dancer-app` lazy chunk: 21.8 KB raw / **8.35 KB gz JS** (W1 baseline 1.6 KB gz with placeholders, so the crop screen costs about +6.7 KB gz) and 0.84 KB gz CSS. `from-image` / crop code appears ONLY in `dancer-app-*.js` (plus the pre-existing `flyerModel`); not in any first-load chunk. `perf-budgets.json` budget (310 KB) left for the orchestrator to re-measure with all five screens. |
| `npm run lint` (chain) | 15 of 16 links PASS; `check:integrity` exit 126 (exec bit missing in the checkout); run via `bash bin/check-integrity.sh`: PASS (0 issues). `lint:eslint` SKIP by design. |
| `npm run check:dancer-area-isolation` | 1 violation, NOT mine: `docs/session-handover-2026-10-15-dancer-w1.md` (W1's file, in the base). My changed files are all inside `src/modules/dancer-app/`, `tests/`, `docs/handover/`. |
| `npm run pre-ship` | NOT COMPLETED (stopped after the unit step). `test:unit`: 6 files / 18 tests failed, none in my folder: 4 files are the known live-DB/env set (eventViewCompat.contract, integrityCouldNotRun, occurrenceProgram.contract, publicEventPageLineup.contract), plus `tests/client/dancerAppApi.test.tsx` (1 test) and `tests/regression/today/reminderBanner.today.test.ts` (/app paths) from the W1/R0 base. Not compared against the base. pre-ship also rewrote regression snapshots; I reverted that. |
| Playwright `photo.spec.ts` (chromium, CI's placeholder `VITE_SUPABASE_*` env) | PASS, 5/5. Without that env the W1 `reachability.spec.ts` also fails in this sandbox (the dev server 500s), so it is an environment need, not a code failure. |

## 390x844 walk

Done in Playwright on a mocked backend (screenshots in `docs/handover/dancer-rebuild-w2d/`): pick, crop (guide overlay), preview, refused file, upload failed, save failed, offline. No horizontal scroll on the crop step. 44 px tap targets (buttons 48 px).

## Verified / Not verified

Verified: pure crop maths and EXIF corners (all eight orientations, pixel samples through a raster fake of the same `renderCrop` the browser runs); call order upload -> save -> delete with the old object deleted after the save only; `avatar_url` never null; retry paths; offline; `?return=` sanitising; build chunk placement; the Playwright walk on a mocked network.

**Not verified:**
- **A real phone camera** (capture, permission prompt, front-camera mirror, real EXIF from a real device, HEIC conversion by iOS).
- **A real decode of a photo with EXIF rotation in a real browser** (the Playwright JPEG is generated in-page with no EXIF); the `from-image` support check is by size comparison, unit-tested with fakes.
- **The real `storage-delete-object` request body** (see decision 2), and the real `storage-sign-upload` and R2 round trip (mocked at the network layer).
- **The real `save_my_dancer_profile_v2` server** (the fake backend mirrors it).
- Pinch zoom on a touch device (pointer-event code is simple but only keyboard, slider and wheel are exercised).
- Real-data shape survey against prod (no new survey was needed; used the W1 fixtures).
- Phone QA at 360x640 and 200% text.

## What is left for the orchestrator

1. Add `tests/e2e/dancer-app/photo.spec.ts` to `package.json` `test:e2e` by name.
2. Confirm or fix the `storage-delete-object` body in `photoFlow.ts` (`deleteOwnPhoto`).
3. Swap `useMyDancerEdit.ts` for W1's hook when it lands.
4. Re-measure `perf-budgets.json` (dancer-app row) with all five screens in.
