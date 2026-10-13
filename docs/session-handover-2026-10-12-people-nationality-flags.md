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
- **Too small, reported not hidden**: /vendors/:id team circles render at 17px (`h-5` at the phone's 13.5px root);
  the 20px minimum sticker covers 93% of the photo. Making the circle bigger is a design call for the owner.
  /dancers list photos are 27px (sticker covers 39%, still the corner).
- **Not wired, on purpose**: CommunitySpotlight (decorative overlapping stack), AvatarUpload (an upload control), the
  organiser team picker's search rows (`organiser_team_search_people_v1` emits no code -- an admin change),
  /teachers/:id (no portrait exists), dead `sections/` files.
- **Owner controls on a photo**: the only one is the organiser entity's own pencil (`PhotoSlot`, bottom-right). The
  phone spec proves it stays reachable (elementFromPoint) and clear of every sticker.
- **Tests**: `nationalityFlag.unit.test.ts` (the rule + artwork), `nationalityFlag.surfaces.matrix.test.tsx`
  (15 surfaces x 9 shapes + 3 placement checks; asserts the same markup on every surface), phone spec
  `people-nationality-flag.phone.spec.ts` (15 surfaces + the owner pencil, at 390x844 and 360x640: count and codes,
  label/title, on screen, not clipped by any overflow ancestor, no text or neighbouring sticker covered, tap goes
  through, no animation, >= 20px). The phone fake (`tests/e2e-phone/fakeSupabase.mjs`) now serves every one of the
  15 surfaces; the phone config turns on `VITE_ENABLE_TEACHERS_DIRECTORY` (it only gates /teachers).
  Screenshots: `docs/screenshots/nationality-flags/<surface>-<size>.png`.
- **Bundle**: the merge of main took main's parties/classes budget of 325 KB (#739). This branch's earlier 321 KB
  bump is gone with it. Measured after the swap: /parties 320.1 KB, /classes 320.2 KB (main 320.0 / 320.1), /event
  379.7 KB of 380 (main 379.1). The flag stays out of first load (lazy in HeaderSearch and PersonChip).

## Open
- Backend option: have `event_view_p5` legacy_compat emit `nationality_code` (admin) so the programme needs no
  second read.
- Vendor team circles (17px) are too small for the sticker: owner to decide (bigger circle, or no flag there).
- /event is 0.3 KB under its 380 KB budget on this branch.
- `/code-review` has not run on this diff (no review stamp).
- Not verified on a real phone. Lighthouse and doc-weight need a Vercel preview and were not run locally.
- `tests/integrityCouldNotRun.test.ts` fails 5 locally on main too (environment), not this PR.

## Next
- The owner runs `/code-review`, then a phone test on /djs, an event with a coded teacher, an organiser team, and a
  vendor team (to decide the 17px circle).
