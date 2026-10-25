# People arc S0 critique: PR #975 (`claude/people-wall-split`, head ffe8e61)

Design Gate stage 5, independent review (impeccable-finish-reviewer role). No product code changed.

## Verdict: SHIP

The tile matches owner pick B: no chip on the face; the full date ("Saturday 24 October", full weekday and
month) is a gold `#FFD479` line under the name at 10px / 800 / 13px line-height, always two short lines at 79px
and 86px tile width; DJ tiles grow by exactly 2 x 13px + 1px; face, flag and role chips are unchanged. None of
the findings below blocks the merge. #1 is the only one worth a follow-up, and it is a choice for the owner.

## What I checked

- `git diff origin/main...HEAD -- src`: the date block moved from inside the face wrapper to straight after
  `tile-name` (`src/modules/person-page/wall/WallTile.tsx:59-70`). Name, flag and chip markup are byte-identical
  apart from that. `DATE_CHIP` is gone with no references left; `ChipTokens` is still used by `CHIP`. No dead
  imports (`useState` moved into `usePhotoFallback.ts` together with its only user).
- Local prod build (`npm run build`, `VITE_ENABLE_PEOPLE_WALL=true`, prod Supabase anon key, read-only),
  rendered at 360x800 and 390x844, scrolled to the first row with a date, below the fixed header:
  `docs/design/people-s0-critique/djs-390x844.png`, `docs/design/people-s0-critique/dancers-360x800.png`.
  Faces show initials because the sandbox blocks the media host (the same limitation the builder reported).
- Unit tests: `vitest run src/modules/person-page` 16 files / 562 tests green.
- **Mutation:** I moved the `tile-date` block back inside the face wrapper (`absolute bottom-1 left-1`, as on
  main) and ran the wall tests. They went red: "the date is not inside wall-face and sits after tile-name" failed
  (1 failed / 51 passed). The `nextElementSibling` check also catches a date put between the face and the name.
  The placement is pinned.
- Contrast: `#FFD479` on the wall ground and on the three seam grounds is asserted >= 4.5 in
  `wallContrast.test.tsx`. Taps: the whole tile is one link (79-86px wide, 147px+ tall).
- Copy: nothing on the tile points at a control that is not on screen.

## Findings (most material first)

### 1. Mixed rows: role chips now sit at three heights (low, not blocking)
`src/modules/person-page/wall/WallTile.tsx:59-70`. Screenshot: `docs/design/people-s0-critique/dancers-360x800.png`
(the row Jeff / Sarah / Mauricio Reyes / Gabriel Bravo).
Measured offsets from tile top, on prod data at 360px: on /dancers, chip rows start at 100px (one-line name),
114px (two-line name) and 127px (dated DJ). On /djs every tile is dated, so the only step is the existing
two-line name one (date at 97 vs 111). Name-wrap raggedness was already on main; this PR adds a second, larger
step (27px) that shows wherever a dated DJ sits next to a dancer. Everything stays top-aligned and faces line up,
so it reads as content flowing, not as breakage, and it is what the approved comp says ("DJ tiles get taller").
Concrete fix if the owner wants chip rows level: make the tile a flex column and give `role-labels`
`marginTop: 'auto'` (with `mt-1` kept as a minimum gap), so chips line up at the bottom of each grid row and the
gap goes above the chips on shorter tiles. Don't reserve date space on every tile: that would make all of
/dancers taller to serve 14 of 97 tiles.

### 2. Screen reader: no pause between the name and "Next gig" (nit)
`src/modules/person-page/wall/WallTile.tsx:66`. Screenshot: `docs/design/people-s0-critique/djs-390x844.png`.
The link's name is built as `Mr M` + `Next gig Saturday 24 October` + `, Teacher` `, DJ` `, Dancer`. The order is
right (name, date, roles), and Chrome adds a space between the block divs, but the role chips each start with an
sr-only `", "` and the date does not, so it reads "Mr M Next gig Saturday 24 October, Teacher, ...". Fix:
`<span className="sr-only">, next gig </span>` to match `RoleChip.tsx:15`, and change the `.replace('Next gig ', '')`
in `wall.test.tsx:65` to match.

### 3. The builder's screenshots understate the evidence (doc nit)
`docs/people-arc/s0/shoot.mjs:34`. Screenshots: `docs/people-arc/s0/djs-390x844.png`,
`docs/people-arc/s0/dancers-390x844.png`.
`scrollIntoViewIfNeeded()` puts the wall's first row under the 106px fixed/sticky header, so at 390 the first row's
faces are cut off. `dancers-390x844.png` shows no dated tile at all, so the /dancers mixed-row case is not shown at
390. Fix: scroll to the first row that has a `tile-date`, minus the header height (what the screenshots above do).
This doesn't affect the product.

### 4. The full date also reaches the (flag-off) hub CTA, not walked (nit)
`src/modules/person-page/hub/NextEventButton.tsx:18`. No screenshot: the hub is behind `personHub` (off) and the
builder listed it as not verified. Because `wallDateLabel` is shared, the button now reads "Go to their next event
&middot; Thursday 29 October" instead of "&middot; Thu 29". That is consistent with the owner copy rule, but the
longer label has not been checked for wrapping inside the 44px button at 360px. Fix: walk it when the hub
(S1+) is built; nothing to do on this PR.

No other findings: the face is clear, nothing else on the tile moved, no dead tokens, and the tests pin the
placement.

## Verified / Not verified
- Verified: diff read in full; prod data rendered at 360x800 and 390x844 (/djs 40 tiles, 17 dated; /dancers 97
  tiles, 14 dated, matching the builder's `report.json`); row offsets measured; mutation test red; person-page unit
  tests green.
- Not verified: real face photos (media host blocked in the sandbox; the date no longer sits on the photo, so this
  can't affect its contrast); a real screen reader (finding 2 is from the DOM order); the hub CTA; a real phone.
