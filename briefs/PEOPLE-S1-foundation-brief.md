# People arc S1 -- shared foundation for the three worlds

Owner approved the worlds direction ("Yes, build this") and "Yes, start S0 + S1" on 2026-10-23.
Work branch: `claude/people-foundation` (new, from origin/main). Lane: normal. Website only, no DB.
A sibling worker (S0) is editing `src/modules/person-page/wall/**` at the same time: DO NOT touch it.

## Read first
- The approved design: branch `claude/people-arc-worlds`, `docs/people-arc/worlds/` -- `HANDOVER.md`,
  `gallery.html`, and `src/facts.js` + `src/worlds.js` (the reference mapping and frame). Shots in `shots/`.
- The audit: branch `claude/people-arc-audit`, `docs/people-arc/audit/REPORT.md` sections 2-4 (every fact computed
  in several places, with file:line).
- `.claude/rules/design-density.md`, `docs/testing-doctrine.md`, the isolation guard that separates
  `src/modules/person-page` from `src/modules/dancer-app` (find it in scripts/ or the lint chain; respect it).

## Build (no page uses it yet except through the flag; S2-S4 wire the worlds)
1. `src/lib/featureFlags.ts`: add `personWorlds` (default OFF, same pattern as the others).
2. `src/lib/languageNames.ts`: move the code->name map out of `modules/dancer-app/public-page/model.ts` into
   src/lib and import it from there (if the isolation guard forbids touching dancer-app in this PR, copy NOTHING:
   leave dancer-app alone, add the src/lib module, and note it for S2).
3. `src/modules/person-page/facts/` -- ONE place for every fact shown on more than one world:
   public name (trim, collapse double spaces); DJ name rule (DJ world: DJ name big + public name small; no DJ
   name -> public name only; never a duplicated "DJ " prefix); languages as full names; date label "Friday 23
   October" (reuse/move the existing London-date helpers, no second copy); count label only from 2; city
   without postcode; nationality as a flag code (never printed); initials. Pure functions + types.
4. `src/modules/person-page/frame/`: `PersonFrame` = Back (left) + Share (right) bar under the site header, then
   `RoleTabs` above the photo: lists ALL the person's roles in the order Teacher, DJ, Dancer, the current one
   filled in its role colour, the others with a coloured dot, each a real link to `/teachers|/djs|/dancers/<slug>`;
   no tab row for a one-role person; same y on every world; taps >= 44px (explicit px: html is ~13.5px on phones).
   `Avatar`: one placeholder family (circle, initials, Inter 800, colour per world) with the photo-fallback
   behaviour (an image that fails, also before hydration, falls back to initials) -- copy the logic of #963's
   `wall/usePhotoFallback.ts` into frame/ (S0 keeps the wall copy; S2 will dedupe).
5. `src/modules/person-page/worlds/tokens.ts`: the three worlds' grounds, cards, ink, accents, fonts (DM Serif
   Display for DJ, Fraunces for the teacher card name if the reference uses it -- check the font is loaded or
   add it the way the site loads fonts), one file, values taken from the reference.
6. The crash: on #963, wall -> hub -> role navigation threw `NotFoundError: removeChild`. Check whether the same
   happens on main for role page -> role page navigation (tap the role pills). If it is in shared code
   (page transition / layout), fix it here with a test; if it was hub-only, write that down.

## Tests (red first where it fixes something)
Table-driven consistency matrix in `src/modules/person-page/__tests__/`: every fact function x every real shape
from `docs/people-arc/worlds/data.md` (thin dancer, teacher no city, Papacito/Morcilla, Ramiro x3, long name,
double-space names, raw language codes, postcode city, no nationality); RoleTabs: 1 role = no row, 2-3 roles =
all listed, current selected, hrefs right, tap size; Avatar: photo, no photo, failing photo.

## Checks before push
Every CI job step that applies (read `.github/workflows`), unit tests green. A preview page is NOT needed.
PR body: what each new module owns, the per-job CI table, Verified / Not verified, and a list of the old copies
(file:line from the audit) that S2-S4 must switch to the new functions.

## Handover
Push once. `docs/people-arc/s1/HANDOVER.md`: head sha, PR number, the public API of facts/ and frame/, what
S2-S4 must do, not verified.
