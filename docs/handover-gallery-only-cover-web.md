# Handover: gallery-only cover (web)

Branch `claude/gallery-only-cover-web`. Status: DONE, one push; the worker opened a bot PR (its number is in the final report). This file mirrors the PR description.

## Summary
- **What changed?** An event with no cover but a gallery picture now shows its first gallery picture as the cover. The rule lives in one shared helper, `pickEventCoverSource` (`src/lib/eventCoverImage.ts`). Two call sites use it: the event snapshot mapping (`parseEventPageSnapshot`, which sets `snapshot.event.imageUrl`) and the OG share-card data (`fetchEventCardData`).
- **Why was it needed?** `/event/ronald-alba-halloween-edition-sensual-vibes` showed the pink title card in the cover tile. Its picture was saved only in `event_series_p5.gallery`. Cover and poster were both NULL.
- **Which layer drops the picture:** the **snapshot mapping**. `useEventPageQuery.ts` built `event.imageUrl` from `cover_image_url ?? hero_image_url` only, and never looked at `photo_urls`. `BentoPage` passes that `imageUrl` to `CoverBlock`, and `CoverBlock` renders its slides only when `imageUrl` is set (`{imageUrl ? <button>...slides</button> : title card}`). Its slide list still had the one gallery picture, though, so the "Tap to expand" pill rendered over the title card with no `<img>`. That is exactly what the owner saw while signed in. The same null `imageUrl` also sent og:image to the generic `/og-image.jpg`.
- **Notable decisions:** the fix is at the mapping, not per screen. Every surface that reads `snapshot.event.imageUrl` now agrees.

| Surface | Reads | Gets the fallback? |
|---|---|---|
| Event page cover tile (`CoverBlock`) | `snapshot.event.imageUrl` | yes |
| Video tile poster (`VideoBlock poster`) | same | yes |
| JSON-LD `image` (`buildEventJsonLd`) | same | yes |
| og:image / twitter:image (`resolveOgCardImage` coverUrl) | same | yes |
| Share card render (`/api/og/card`, `/api/og/bake` via `fetchEventCardData`) | `pickEventCoverSource(cover ?? hero, photo_urls) ?? venue image` | yes (it used to skip both hero and gallery and fall to the venue image) |
| Event cards in lists and feeds (calendar, latest, tonight, search) | one image column per row from list RPCs (`photo_url` / `cover_image_url` / `poster_url`) | **no**: those RPCs return no gallery array, so the client cannot fall back without an RPC change (out of scope: no RPC or migration changes). `calendarUtils.ts` is also a density-excluded file. |
| OG **bake** trigger | DB trigger on `poster_url` / `cover_image_url` change only | **no** pre-baked card for a gallery-only event: the trigger is admin-side. og:image falls through to the live `/api/og/card` render, which now draws the gallery picture. |
| `hero.imageUrl` (`buildEventPageModel`) | `imageUrl` first, so the gallery picture now beats the organiser avatar | consistent, but its only reader `EventHeroMetaBlock` has no importer (dead) |

## Scope
- [x] No unrelated redesign or unrelated feature additions. No DB, RPC, migration or admin change.

## Validation Evidence
RED FIRST, on unfixed `main` (fix stashed, new tests kept): `npx vitest run tests/eventCoverGalleryFallback.test.tsx` gave **5 failed | 5 passed**:
```
FAIL ... 'gallery only (the Ronald & Alba shape)'
FAIL ... 'cover empty string, gallery present'
FAIL ... 'cover whitespace, gallery present'
FAIL ... 'gallery with an empty first entry'
FAIL ... the dehydrated slug payload (gallery only, no cover) > shows the gallery picture in the cover tile, not the title card
AssertionError: expected null to be 'https://media.bachatacalendar.co.uk/i…'
```
With the fix: **13 passed** (3 shapes added in review: a hero with no cover, a padded gallery entry, a stringified `'null'` cover).

Gates (local, on this head):
| Step | Command | Exit |
|---|---|---|
| unit | `npm run test:unit` | 1: 15 failed in 4 files, the known set identical on `main` (`tests/eventViewCompat.contract.test.ts` 5, `tests/integrityCouldNotRun.test.ts` 5, `tests/publicEventPageLineup.contract.test.ts` 3, `tests/occurrenceProgram.contract.test.ts` 2: live-database / environment). 9512 passed. |
| typecheck | `npm run typecheck` | 2: 97 tsc errors on `main` and the same 97 here (the one in `useEventPageQuery.ts` is the pre-existing `safeExternalHref(unknown)`, shifted 7 lines). Not a CI gate. The CI typecheck job's steps `check:rpc-typing` and `check:wallclock-brand` both exit 0. |
| lint chain | `npm run lint` | 1: the only failing link is `check:integrity` exit 126 (sandbox exec bit). `bash bin/check-integrity.sh` exits 0 (1831 files, 0 issues). The other 19 links PASS. |
| eslint (changed files) | `npx eslint <4 changed files>` | 0 |
| build | `npm run build` | 0 |
| bundle budget | `npm run check:bundle-budget` | 0 |
| images | `AUDIT_STRICT=1 npm run check:images` | 0 |

## Review
Two rounds, per the stopping rule for a user-facing change. **Round 1 (medium), 10 findings:**
- **Fixed:**
  - The share card ignored `hero_image_url` (`fetchEventCardData` now uses `cover ?? hero`).
  - Gallery entries were not trimmed, so a padded entry could show as a duplicate slide.
  - A stringified `'null'` cover blocked the fallback.
  - The stale resolver comment in `api.og.card.tsx` is updated.
  - Removed the second copy of the rule (`?? galleryUrls[0]` in `buildEventPageModel`).
  - Added matrix shapes for each of these.
- **Kept, with reasons:**
  - The handover doc (the brief requires it).
  - The JSON-LD, video and og:image rows read `snapshot.event.imageUrl` verbatim at their call sites, and the test says so. The cover tile and share card rows run the real code.
  - Relative gallery paths (0 of 50 prod gallery entries are relative, padded or blank).
  - `firstString` reuse across `app/` and `src/` (a different module).

**Round 2 (low), 1 finding:** it does not reproduce, because `asString` and `firstString` already return null for blank strings, so `??` reaches the hero. Stopped there. `scripts/ship-gate.mjs` reports GREEN (soft tier, advisory). No review stamp was minted, because the forked review reported as text.

## Verified on real data (required)
- **Shapes surveyed (read-only, counts, `event_series_p5`, 2026-10-20):** gallery entries: 50 total, 0 relative, 0 padded, 0 blank. Series: no cover/no gallery/no poster 612; cover only 17; cover+poster 82; cover+gallery 5; cover+gallery+poster 25; **gallery only: 0 now**. The owner has since set this event's cover: `event_view_p5` for the slug now returns `cover_image_url` = the former gallery picture, `photo_urls` = []. `event_view_p5`'s event object carries no `poster_url` key (so `posterUrl` is always null on this path).
- **Checks run:** a table-driven matrix (`tests/eventCoverGalleryFallback.test.tsx`) over cover only / gallery only / cover also in gallery (no duplicate slide) / cover plus other gallery / neither (title card stays) / cover '' / cover whitespace with and without gallery / gallery with an empty first entry. For every shape it asserts that the cover tile `<img>` (SSR render of `CoverBlock`), the slide count, the video poster, JSON-LD image, og:image coverUrl, the share-card coverUrl and the hero all resolve the same picture. It also runs a fixture modelled on this slug's dehydrated `event_view_p5` payload (same top-level and event keys as the live RPC). All the gates above were run.
- **Browser walk:** a local production build (`npm run build` against prod Supabase, read-only anon key), served locally. Because the live row now has a cover, the server's `event_view_p5` answer was rewritten back to the pre-fix shape (cover/hero NULL, the picture only in `photo_urls`).
  - **Unfixed build**, 390x844 and 1280x800: no cover `<img>`/button, the "Tap to expand" pill over the title card, og:image `https://www.bachatacalendar.co.uk/og-image.jpg`. This reproduces the bug.
  - **Fixed build**, both sizes: the cover button renders with `<img src="/_vercel/image?url=…88fae065…webp">`, plus the "Tap to expand" pill. og:image = `/api/og/card?kind=event&id=34156f15…&v=88fae065-…webp`.
- **NOT verified:** the browser walk ran BEFORE the review-round-1 fixes (hero on the share card, trimmed gallery entries, no second rule copy); those were checked by the matrix only. the picture's pixels in the local walk (there is no `/_vercel/image` locally and the sandbox browser has no outbound network, so the `<img>` src was asserted, not looked at). The live `/api/og/card` JPEG for a gallery-only event was not rendered. No real phone. The Vercel preview is not walked (one push).

## Phone QA
- Sizes checked: 390x844, 1280x800
- Walked: `/event/ronald-alba-halloween-edition-sensual-vibes` on a local production build with prod data replayed to the gallery-only shape, before and after the fix (cover tile `<img>`, "Tap to expand", og:image).
- Not verified: the image pixels (no `/_vercel/image` locally), a real phone, the Vercel preview.

## Next steps
- Owner phone check of the Vercel preview, on any event that has a gallery and no cover (none exist in prod right now).
- Optional follow-up (admin/DB, not this repo): let the list RPCs fall back to gallery[0], and fire the OG bake trigger on gallery changes when there is no cover.
