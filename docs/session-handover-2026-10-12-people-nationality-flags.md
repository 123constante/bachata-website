# Session handover 2026-10-12 / 2026-10-13: nationality flag on every person photo

Branch: `feat/people-nationality-flags`, PR #740.

## Done
- **Design (owner decision 2026-10-13): the Sticker** (style F of the owner's mockup), replacing the first
  design, which the owner rejected. A static flag in true 3:2, width 46% of the photo
  (minimum 20px), at top -6% / right -14% of the photo box, tilted 9deg, 3px radius, a 2px white edge and a drop
  shadow (`0 0 0 2px #fff, 0 3px 8px rgba(0,0,0,.6)`). No animation of any kind (no rAF, no IntersectionObserver,
  no shared clock), so reduced motion needs no special case. Card photos flush to a card edge use the `inset`
  placement (inside the corner).
- **One implementation**: `src/components/people/` -- `nationality.ts` (the one rule: a code shows a flag; null,
  empty, non-code, private-use and Kosovo show nothing; the one wording "Nationality: <country>"), `flagArt.ts`
  (inline 30x20 SVG artwork, no CDN, rendered with `preserveAspectRatio` slice; the 11 prod codes plus ~50 likely
  next, a generic flag with the letters for any other valid code), `NationalityFlag.tsx` (the sticker),
  `PersonAvatar.tsx`.
- **Removed in the Sticker swap**: `flagWave.ts`, `flagClock.ts`, `flagClock.test.ts`, the motion cases in
  `nationalityFlag.unit.test.ts`, the canvas rasteriser, and `flagSvg` / `flagDataUrl` (replaced by `flagArtMarkup`).
- **Surfaces wired** (15): /djs list, /teachers list, /dancers list, /all-profiles, /videographers (+`nationality`
  column), /vendors/:id team, /practice-partners (signed in), /djs/:id hero, /dancers/:id hero, /event/:id
  programme (PersonChip; `event_view_p5` has no code and the programme reads that do are retired here --
  check:legacy-program-rpcs -- so `dancer_profiles.nationality` is read for the people on it, non-blocking),
  /festival/:id headliners, header search (+ Cmd+K overlay, flag-gated off), /search cards, /organisers/:id
  Teachers & DJs circles, /account dancer home (own photo).
- **Fixes the sticker needed** (found by the phone spec, both proved by mutation: revert -> red):
  - /organisers/:id team grid: the right column's sticker was cut 2.4px (390) / 1.1px (360) by GlobalLayout's
    `overflow-x-clip`. Fix: `px-3` on the team grid.
  - /account: the sticker touched the name. Fix: `mr-2` on the photo wrapper.
  - Header search rows (+ Cmd+K overlay, same markup): `mr-[5px]` on the photo wrapper, so the sticker's white edge
    is 8px clear of the name at 360 and 390 (was about 3px).
- **The red phone-qa on a38e596 (header search, 360x640, AR covering "Bachata" 184px2)**: NOT a visible overlap.
  The text was the /djs hero title "Bachata DJs", hidden under the opaque open search panel. CI (ubuntu-latest)
  has no system Inter, so the title falls back to DejaVu Sans and is wider (x 50-228 instead of 60-220): its left
  edge slid under the AR sticker's box. Locally the box had a system Inter, so it passed. Reproduced exactly
  (AR, 184, "Bachata") by hiding Inter from fontconfig (`FONTCONFIG_FILE` with a `rejectfont` for
  /usr/share/fonts/opentype/inter). Fix in the spec's audit: a text overlap counts only when
  `document.elementFromPoint` at the overlap's centre is in that text's own element chain (the sticker is
  pointer-events: none). Proved both ways under CI fonts: the original spec red with the CI error, the new spec
  green; and a mutant (row `gap-0`, no `mr`) is still caught ("Lucia", 52px2).
- **`overlap.phone.spec.ts` /auth 360x640 (scrollWidth 390)**: not this PR. Passes on `origin/main` (5e0ec4c) and
  on this branch with the same command under CI fonts; seen flaky on #733.
- **No sticker under 28px (owner decision 2026-10-13)**: `MIN_FLAG_PHOTO_PX = 28` and `smallPhotoNationalityProps` in `nationality.ts`;
  `NationalityFlag` renders nothing for a smaller `size`, and the caller spreads `smallPhotoNationalityProps(code, size)`
  on the photo (role img, aria-label "Nationality: <country>", title, `data-nationality-photo`). Applied on the
  /vendors/:id team circles (size 20, 17px rendered); their row gap is back to main's `gap-2`. /dancers list
  (size 32, 27px rendered, sticker covers 39%) keeps its sticker: the rule reads the `size` prop. PersonChip `xs`
  (24px) would also get no sticker, but no caller uses `xs` and PersonChip does not spread the label props (it
  lazy-loads the flag module): wire them if `xs` ever ships.
- **Not wired, on purpose**: CommunitySpotlight (decorative overlapping stack), AvatarUpload (an upload control), the
  organiser team picker's search rows (`organiser_team_search_people_v1` emits no code -- an admin change),
  /teachers/:id (no portrait exists), dead `sections/` files.
- **Owner controls on a photo**: the only one is the organiser entity's own pencil (`PhotoSlot`, bottom-right). The
  phone spec proves it stays reachable (elementFromPoint) and clear of every sticker.
- **Tests**: `nationalityFlag.unit.test.ts` (the rule + artwork), `nationalityFlag.surfaces.matrix.test.tsx`
  (15 surfaces x 9 shapes + 4 placement checks, incl. no sticker under 28px and the photo's label/title; asserts the
  same markup on every surface), phone spec
  `people-nationality-flag.phone.spec.ts` (15 surfaces + the owner pencil, at 390x844 and 360x640: count and codes,
  label/title, on screen, not clipped by any overflow ancestor, no text or neighbouring sticker covered, tap goes
  through, no animation, the stickerSize width per surface; /vendors/:id: no sticker, label and title on each photo). The phone fake (`tests/e2e-phone/fakeSupabase.mjs`) now serves every one of the
  15 surfaces; the phone config turns on `VITE_ENABLE_TEACHERS_DIRECTORY` (it only gates /teachers).
  Screenshots: `docs/screenshots/nationality-flags/<surface>-<size>.png`. header-search and vendor-team were retaken 2026-10-13 under CI's fonts (DejaVu fallback).
- **Bundle**: the merge of main took main's parties/classes budget of 325 KB (#739). This branch's earlier 321 KB
  bump is gone with it. Measured after the swap: /parties 320.1 KB, /classes 320.2 KB (main 320.0 / 320.1), /event
  379.7 KB of 380 (main 379.1). The flag stays out of first load (lazy in HeaderSearch and PersonChip).

- **Smaller sticker on small photos (owner decision 2026-10-13, round 3)**, after the owner saw the 20px sticker cover
  over half a 36px header-search photo on desktop. `stickerSize` (still the one rule, `NationalityFlag.tsx`):
  photos 28-47px get `max(14, round(photo * 0.4))` (`SMALL_PHOTO_MAX_PX = 47`, `MIN_SMALL_STICKER_PX = 14`);
  48px and up unchanged (46%, at least 20px). Same tilt, edge, shadow and position. Measured (phone spec, CI fonts,
  390x844 / 360x640):

  | Surface | `size` | rendered photo | sticker | photo cover | text clearance |
  |---|---|---|---|---|---|
  | header search rows (Cmd+K same markup) | 36 | 31 / 30px | 14px (was 20) | 0.14 (was 0.30) | 8.3 / 8.2px |
  | /dancers list | 32 | 27px | 14px (was 20) | 0.19 (was 0.39-0.40) | - |
  | /event programme (PersonChip md) | 40 | 40px | 16px (was 20) | 0.09 (was 0.16) | - |
  | /teachers, /practice-partners, /account | 56 | 47-56px | 26px | 0.12-0.19 | unchanged |
  | /djs list | 64 | 54px | 29px | 0.17 | unchanged |
  | inset cards (all-profiles, videographers, dancer hero, festival, /search) | 48 | - | 22px | <= 0.04 | unchanged |
  | /organisers/:id team | 80 | 95-105px | 37px | 0.05-0.07 | unchanged |
  | /djs/:id hero | 132 | 132px | 61px | 0.11 | unchanged |

  "Photo cover" is the sticker's tilted box plus its 2px edge over the photo's square box (conservative).
  - **`mr-[5px]` kept, measured**: the sticker is anchored at right -14%, so a smaller one shrinks leftwards and its
    right edge does not move. Without the margin the header-search sticker is 3.2 / 3.3px from the name (the same
    tight gap the margin was added for); with it 8.2 / 8.3px. The spec now logs `textClearance`.
  - **Readability at 14px** (`docs/screenshots/nationality-flags/flags-14px-dpr1.png` and `-dpr3.png`): ES, AR, BO,
    IT, DE, ZA and GB read on a 3x phone screen (GB is mush at 1x). **CO, EC and VE are hard to tell apart** (same
    yellow / blue / red bands; the EC emblem is a dot and the VE stars vanish at 14px; CO vs EC is hard even at
    26px). **CY is faint**: a mostly white flag on a white edge, the copper island a smudge. The title / aria-label
    still name the country.
  - **Tests**: `stickerSize` table (27 28 36 40 47 48 56 96) in `nationalityFlag.unit.test.ts`; the matrix test
    renders every band row through `NationalityFlag`. Proved red on the old rule (12 failed: every 27-47px row and
    the constants) and green on the new. Phone spec: per-surface `stickerPx` (the width stickerSize gives that
    surface), a 14px floor, header-search cover <= 0.25; red on the old rule (6 failed: header search, /dancers,
    programme, at both sizes), 32/32 green on the new. Screenshots retaken (CI fonts) for header-search, dancers,
    event-programme.

## Open
- Backend option: have `event_view_p5` legacy_compat emit `nationality_code` (admin) so the programme needs no
  second read.
- /event is 0.3 KB under its 380 KB budget on this branch.
- `/code-review` has not run on this diff (no review stamp).
- Not verified on a real phone. Lighthouse and doc-weight need a Vercel preview and were not run locally.
- `tests/integrityCouldNotRun.test.ts` fails 5 locally on main too (environment), not this PR.

## Next
- The owner runs `/code-review`, then a phone test on /djs, an event with a coded teacher, an organiser team, and a
  vendor team (no sticker; a screen reader reads the country on the photo).
