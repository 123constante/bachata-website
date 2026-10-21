# W2-A: the face wall on /djs and /dancers (behind `flags.peopleWall`, default OFF)

Branch `claude/w2a-wall` (from main at #893). No PR opened (gh not authed); the orchestrator opens it from the body at the bottom.

## What changed, in plain words
- **Before (today, flag OFF):** /djs and /dancers are 3-column dark tiles with a small round photo or one letter, grey role words, a big hero.
- **After (flag ON):** no hero. One friendly line ("Meet the DJs behind the nights" / "Meet the dancers behind the nights"), filter chips (All, DJs, Dancers, and Teachers only when teacher pages are open), then a FOUR-column wall of big square faces (86px at 390) on the warm dark base. Each tile: face (photo, or a role-coloured tile with big initials if there is no photo or the photo fails), name (2 lines max, never clipped), coloured role chips, a flag sticker top-right only when there is a nationality, a gold "Fri 23" chip bottom-left only for a DJ with an upcoming gig. The whole tile is one link.
- Flag OFF: the pages render exactly as before (page code path untouched; the existing `w1PeopleListsPage` tests pass unchanged).

## Turn it on
Set `VITE_ENABLE_PEOPLE_WALL=true` in the Vercel env (build-time, like the other flags in `src/lib/featureFlags.ts`; key `peopleWall`) and redeploy. Unset/anything else = OFF.

## Files
- `src/modules/person-page/wall/`: `tokens.ts` (ALL colours/sizes, one file), `model.ts` (pure: tile model, date label, initials, filter), `RoleChip.tsx`, `WallTile.tsx`, `PeopleWall.tsx` (header, filter chips, grid, empty states, skeleton), `lists.tsx` (`DjsWall`, `DancersWall` adapters), `__tests__/wall.test.tsx`, `__tests__/wallContrast.test.tsx`.
- `src/pages/DJs.tsx`: early `if (flags.peopleWall) return ...` after all hooks; `isError` of `usePeopleBadges` is now read. `src/pages/Dancers.tsx`: hero, widget row and directory section are conditional on the flag (the "Your Plans" and "Find a Dance Partner" sections stay below the wall). `src/lib/featureFlags.ts`: `peopleWall`.
- `src/pages/__tests__/w2aWallPages.test.tsx`: flag OFF / ON at page level.
- `docs/mockups/w2a-wall/`: screenshots, `shot.mjs` (walk + measurements), `on-report.json`, `off-report.json`.

## One mapping, no copies
Chips: `roleTagsFor` (badges.ts: ROLE_ORDER, ROLE_LABEL) so labels are the FULL words (Teacher / DJ / Dancer), not the S10 short forms (that avoids a second copy of the vocabulary; 3 chips wrap to 2 rows at 86px). Links: `djTile().href` / `dancerHref` (same targets as today); `linkRoleFor` picks the tile's lead colour (DJ first), and `linkFor` is the fallback href. Names: DJs list uses `djTile().name` (stage name leads) with a leading "DJ " dropped so the chip is not repeated ("DJ El Rugido" reads "El Rugido", per the brief); the dancers list uses today's `renderPublicName` result. Date: `has_upcoming_gig` + `next_gig_date` (DJs) or the badges `nextGigDate` for a DJ-role person on /dancers, shown only when the date is real and not past (`londonDate` helpers). Profile-view telemetry (`emitProfileView`, `listing:djs` / `listing:dancers`) is kept on every tile. No read added or changed.

## Deliberate differences to flag
1. The old /dancers hero widgets (Practice Partners, Create a Profile, Book a Photoshoot) are not shown with the flag ON. The Practice Partners CTA remains in "Find a Dance Partner". Create a Profile and Photoshoot links are gone from this page when ON: `/create-dancers-profile` is a known unroutable target (listed in `navigateTargetsRoutable.test.ts`), so I did not carry it into new code. OWNER DECISION: where should "Create a profile" live?
2. If the badges read fails, only the "All" filter is offered and /dancers shows everyone without chips (a filter can never hide everyone because of a missing read).

## Prod shapes (read-only SELECT, 2026-10-21, counts only)
181 active dancer profiles (`is_active` null or true); 114 with a photo; 19 with a nationality. `list_public_djs_v1(null,200)`: 40 DJs, 17 with `has_upcoming_gig`. Walk against the live reads: /djs 40 tiles; /dancers 93 dancing-role tiles (13 with a photo URL that loads a face attempt, 80 initials because the media host is unreachable here).

## CI: every job step run locally (command, exit)
| Job / step | Command | Exit |
|---|---|---|
| typecheck: RPC typing | `npm run check:rpc-typing` | 0 |
| typecheck: WallClock brand | `npm run check:wallclock-brand` | 0 |
| `npm run typecheck` (tsc) | 99 errors BOTH on main and on this branch (sandbox types drift); none in files I touched | same count |
| architecture-guard: integrity | `bash bin/check-integrity.sh` | 0 |
| legacy tables / program RPCs / runtime architecture | `check:legacy-tables`, `check:legacy-program-rpcs`, `lint:architecture` | 0 / 0 / 0 |
| image-attribute audit (strict) | `AUDIT_STRICT=1 npm run check:images` | 0 |
| image-width contract | `check:image-widths:self-test`, `check:image-widths` | 0 / 0 |
| mojibake canary + grep guard | `check:mojibake:self-test`, `git grep` | 0 / 0 |
| unit (London, `test:unit:offline`, live-DB suites skipped as CI does when no DB path changed) | `npm run test:unit:offline` | 1: 5 failures in `tests/integrityCouldNotRun.test.ts`, which fail identically on clean main (verified with stash); the 6th (navigateTargetsRoutable) was mine, FIXED, now green |
| unit timing pass | `npm run test:unit:timing` | 0 |
| unit New_York / Sydney tz-sensitive | `TZ=... npx vitest run ...` (CI list) | 0 / 0 |
| `npm run lint` (20 links) | `npm run lint` after `chmod +x bin/*.sh` as CI does | 0 |
| dancer-area-isolation (self-test, check) | `check:dancer-area-isolation` | 0 / 0 |
| perf-budget: bundle canary, build, budgets, first-load requests, chunk cycles | `npm run build`, `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` | 0 x4 |
| phone-qa phone suite 390x844 + 360x640 | `playwright.phone.config.ts` | 270 passed; 2 failed (keyboard city search, organiser contact sheet) = flaky under load, both PASS on re-run |
| phone-qa build-smoke (production build, fake Supabase) | `playwright.build.config.ts` | 0 |
| e2e-smoke | `npm run test:e2e` with the workflow env | 158 passed; 2 failed (organiser-home load-failure, organiser-layout sideways) = flaky: the layout one passed on re-run, organiser-home failed once more under load and then passed 3 times in isolation, and passes on clean main |
Not run: Lighthouse and doc-weight (need Chrome/Lighthouse infra), live-DB contract suites, Vercel preview. GitHub Actions itself not run.

## Tests added and mutants
- Table-driven `wall.test.tsx` (29): shapes x list (DJ with/without gig, past-dated gig hidden, "DJ El Rugido", long names, 3 roles, teacher+dancer, no photo, broken photo, no flag, zero roles, badges-read-failed), filters, empty states, one-link tile, no clipped name styles. `wallContrast.test.tsx`: text >= 4.5, chip edge >= 3 from rendered computed styles. `w2aWallPages.test.tsx`: flag defaults OFF; OFF = old tiles; ON feeds the wall.
- Mutant 1: `linkRoleFor` loop order changed to dancer-first: 2 tests RED (restored). Mutant 2: broken-image fallback (`onError`) dropped: 1 test RED (restored).
- Contrast and layout in the real browser (`on-report.json`): scrollWidth 390 (no sideways scroll), 4 columns, tile 86.4px, `namesClipped` 0, max name lines 2 on all four views, 0 page errors; first tile top at 219px (wall is above the fold).

## Verified / Not verified
Verified: real prod reads through a production build (flag ON and OFF) at 390x844; screenshots in `docs/mockups/w2a-wall/` (`on-djs-top`, `on-djs-middle`, `on-dancers-top`, `on-dancers-middle`, `on-*-noPhoto`, `on-*-threeRole`, `on-*-longName`, `on-*-filter`, `off-*-flag-off`); counts above.
NOT verified: REAL PHOTO CROPS. `media.bachatacalendar.co.uk` is refused by the sandbox proxy, so photo tiles fell back to initials (13 of 93 /dancers tiles tried a photo). Not checked on a physical phone; flag and date-chip legibility on busy photos unverified. 360x640 not walked by hand (the phone suite ran). `tsc` has 99 pre-existing errors in this sandbox, so type-safety of my files rests on zero new errors plus vitest. Lighthouse not run.

## Owner look-at list
1. On a phone: do the faces and chips read as "who is who"? Chip words are full (Teacher / DJ / Dancer) so 3-role tiles are two chip rows; say if you want the short forms (DJ / Dance / Teach).
2. The /dancers page lost Create a Profile and Book a Photoshoot when the flag is ON (see difference 1): where should they go?
3. Real photos with the flag sticker and gold date chip over them (could not be checked here).

## PR body (ready to paste)
```
## Summary
Face wall on /djs and /dancers behind a new flag `peopleWall` (VITE_ENABLE_PEOPLE_WALL, default OFF). Four columns of big faces on the warm dark base, role chips, filter chips, flag sticker, gold date chip for DJs with a gig. No new reads. Flag OFF = pages unchanged. Details: docs/handover/w2a-wall.md.

## Phone QA
- Sizes checked: 390x844 production build with flag ON and OFF against prod reads; phone suite at 390x844 and 360x640.
- Walked: /djs and /dancers top and scrolled middle, no-photo tile, 3-role tile, long-name tile, filter applied, flag-OFF page; measured no sideways scroll, 4 columns, 0 clipped names, max 2 name lines.
- Not verified: real photo crops (media host unreachable from the build sandbox), a physical phone, 360x640 by hand.

## Verified on real data
- Shapes surveyed: (read-only, counts) 181 active dancer profiles, 114 with a photo, 19 with a nationality; list_public_djs_v1 = 40 DJs, 17 with an upcoming gig; walk showed /djs 40 tiles and /dancers 93.
- Checks run: table-driven wall tests (29) + contrast + page flag tests, two mutants red, every CI job step in the handover table, production-build walk at 390x844 with prod reads.
- NOT verified: real photos (sandbox cannot reach the media host), physical phone, Lighthouse, live-DB contract suites; 5 integrityCouldNotRun tests fail on main too; a few organiser/keyboard e2e specs flaked under load and passed on re-run.
```
