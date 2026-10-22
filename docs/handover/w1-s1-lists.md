# W1 S1 handover: /dancers and /djs lists

Branch `claude/w1-s1-lists` (from origin/claude/w1-base). Sub-branch, no PR. Photos via r2.dev / `_vercel/image` proxy: NOT TRIED (no browser walk was run).

## Done
- `/dancers` (`src/pages/Dancers.tsx`): list filtered to people with the Dancer role (`usePeopleBadges` + `onlyDancers`); tile is a `<Link>` to `/dancers/:id` (via `hrefForRole`), 3 columns at 390px, name wraps whole (no line-clamp), 26px label row pinned to tile bottom with `roleTagsFor(..., {exclude:'dancer'})` at 12px (Teacher plain text while `flags.teacherDetail` is off). Default palette untouched.
- "??" mojibake: the three hero widgets (now Users / UserPlus / Camera icons), the Find-A-Dance-Partner CTA (Heart icon) and the four "??" avatar-stack bubbles (removed; the "200+ looking for partners" text stays).
- `/djs` (`src/pages/DJs.tsx`): `gradientPalette="dj"`, floating icons dropped, flat tiles (no card box), 3 columns, upcoming-gig DJs first by `next_gig_date` ascending then the rest in RPC order, "Playing soon" at 12px, stage name leads via `nameFor('dj')`, "DJ" label always shown (also for "DJ ..." names). Genre chips removed from the tile (no room at 3 columns).
- Pure models: `src/components/dj/djListModel.ts`, `src/components/dancers/dancerListModel.ts`. `DjTiles.tsx` needed no change (it holds profile-page parts only).
- Tests: `src/components/dj/__tests__/djListModel.test.ts` (7, table over role shapes x teacher flag off/on). Existing fixtures updated for the new badges RPC: `directoryAttendance.today.test.tsx` (+ snapshot, 8 updated: "??" gone, tiles now links with labels, teacher-only row hidden), `nationalityFlag.surfaces.matrix.test.tsx` (badge fixture).

## Prod shapes (read-only SELECT 2026-10-20)
`list_public_djs_v1`: keys include `has_upcoming_gig`, `next_gig_date`; 40 DJs, 17 upcoming, 5 stage names starting "dj". People-role shapes: see `w1-s0-badges.md` survey (92 dancer-role of 160 profile ids is today's order of magnitude; exact live count not re-run).

## Gates (command -> exit)
| step | result |
|---|---|
| `npx vitest run djListModel.test.ts` | 0, 7 passed |
| `npx vitest run` nationalityFlag.surfaces.matrix + directoryAttendance.today (after fixture update, `-u`) | 0, 165 passed |
| same files with the new page code, before fixture update | RED: 17 failed (list empties without badges) |
| `npx eslint` changed files | Dancers.tsx 3 `no-explicit-any` errors + 2 hook warnings, all pre-existing lines; others clean |
| `tsc -p tsconfig.app.json` | no errors in changed files (repo total not compared) |
| `npm run check:mojibake` | 0 |
| `NODE_OPTIONS=--max-old-space-size=3072 npm run build` | 0 |

## Phone QA
NOT RUN: no 390x844 / 360x640 browser walk, no before/after PNGs in `docs/mockups/w1-s1/`, no tap-height / contrast / `elementFromPoint` measures, no phone e2e. The mockup shots (`docs/mockups/s12/*-final.png`, branch `claude/s12-mockups`) were not compared. The RED-on-main run of the new table test was not done (new files); the old-code RED evidence is the 17 fixture failures above.

## NOT run / not verified
Full lint chain, full unit suite, other CI jobs, pre-ship, review stamp, Docker, real phone. "Playing soon" colour (amber-300) contrast unmeasured. Dancers list still loads all `dancer_profiles` rows then filters client-side (as before, plus the badges call).

## Next steps (continuation / review)
Browser walk with the prod build (serve with an SPA fallback and check each shot is the right page), shots with real people, measure, run remaining CI steps, compare to the S12 mockups (tile spacing, "Playing soon" styling).
