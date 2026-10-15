# Brief: Dancer Rebuild W2d, Photo (`/app/me/photo`) -- PR B1a sub-branch

Repo `123constante/bachata-website` (PUBLIC). Model Sonnet 5.5. NEVER run `gh api` in this repo; read
other branches with `git fetch origin <branch>` + `git show FETCH_HEAD:<path>`. Read
`briefs/dancer-rebuild-COMMON.md`, `briefs/dancer-rebuild-INTERFACE.md` and `briefs/dancer-rebuild-W2-SHARED.md`
on `arc/briefs-dancer-rebuild` FIRST, then the plan section 4.3 "Photo" and Appendix A row 12. BRANCH:
`arc/dancer-app-w2d`, created FROM `claude/dancer-app-r1a` (SHA in the dispatch prompt). Push only this
branch. Do NOT open a PR. Siblings own their own `screens/` folders; W1's shared files are FROZEN.

## Files you OWN
`src/modules/dancer-app/screens/photo/**`, `tests/e2e/dancer-app/photo.spec.ts`,
`docs/handover/dancer-rebuild-w2d.md`.

## The screen (mockup "7 Photo" + onboarding step 4's guide)
1. Pick: "Take photo" (`<input type=file accept="image/*" capture="user">`) and "Choose from my photos"
   (same input without capture). Validate with the EXISTING `validateImageFile` (reuse; raster only, the
   existing size rule) and show its copy on refusal.
2. Crop: a square head-and-shoulders crop with the dashed guide overlay (head oval + shoulders arc as
   in the mockup), pinch/drag to position on touch, drag on desktop, EXIF orientation respected
   (`createImageBitmap` with `imageOrientation: 'from-image'` where supported, else a tested fallback),
   output 1024x1024 JPEG quality ~0.86 via canvas. Reduced-motion safe. Keyboard: arrow keys nudge.
3. Preview: "This is how people will see you." + "Use this photo" / "Take another".
4. Upload with the EXISTING `uploadToR2` presign flow (own prefix is forced server-side); then IMMEDIATELY
   `saveMyDancerProfile({ avatar_url })` (replace-only: never null); then delete the PREVIOUS own object
   via the existing `storage-delete-object` call the site uses (find its client wrapper on `origin/main`;
   never a new fetch); a delete failure is logged and swallowed (the save already succeeded; say so in
   the handover). Order matters: save first, delete old second.
5. Return: `?return=<path>` (sanitised with the existing `sanitizeReturnTo`; default `/app/me`).
Release 2 refusals ("closer photo", "two people") and background removal are NOT built; the mockup's two
red messages are NOT rendered in 1a.
Failure states, each with a way out: no camera permission (choose from photos instead); file refused
(reason + pick again); upload failed (Retry, keeps the crop); save failed with an INTERFACE code
(`photo_required` cannot happen here, `area_closed`, `rate_limited`, network: copy from `api/errors.ts`);
offline.

## Tests (table-driven; red-first)
Shapes: portrait JPEG with EXIF rotation 6, landscape, square, tiny (< 256px: refused with the copy the
existing validator gives, or your own if it has none: say which), HEIC on a browser without support
(refused with copy), oversized (existing cap), first photo vs replacing an existing one (old object
deleted AFTER the save), upload failure then retry, save failure. Assert the exact order of network
calls (presign -> PUT -> save -> delete). Red-first: a mutant that deletes before saving must red; a mutant
that sends `avatar_url: null` must red; a mutant that ignores EXIF must red (pixel sample of the rotated
output).

## Gates
Unit (Node 22), lint, typecheck, `npm run build` (report the chunk cost of the crop code; it must sit
inside the `dancer-app` lazy chunk, never first-load), Playwright spec (or NOT RUN + reason), isolation
check, `npm run pre-ship`, every applicable workflow job. 390x844 screenshots of every state under
`docs/handover/dancer-rebuild-w2d/`.

## Failures this brief exists to prevent
Deleting the old photo before the new one is saved; a sideways photo; a non-square upload; a second
upload client; a state with no way out; crop code in the first-load bundle.

## Done means
Everything above + handover (incl. "real phone camera NOT verified"). Commit, push ONCE with
`[worker-done <ticket>]`. Stop after the push.
