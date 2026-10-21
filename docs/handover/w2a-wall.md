# W2-A: the face wall on /djs and /dancers (behind `flags.peopleWall`, default OFF)

Branch `claude/w2a-wall` (from main at #893). No PR opened (gh not authed); the orchestrator opens it from the body at the bottom.

## Fix pass (2026-10-21, independent reviewer, ticket dt_ac20331415a8)
Review first, then fixes; full review table in [`w2a-wall-review.md`](w2a-wall-review.md) (15 items: 3 fixed, 12 checked and not a bug).
- **R1 fixed (filter could empty the wall):** on /dancers a badges read that SUCCEEDS but comes back empty showed everyone (page rule) while still offering DJs / Dancers chips; tapping "Dancers" emptied the wall. Role filters are now offered only when role data is present (read ok AND some tile has a role tag); else only All. Red first: the new test failed on the unfixed code (1 failed / 30 passed), green after.
- **R2 fixed (a11y):** a 2px `focus-visible` ring in the wall text colour on every tile link, filter chip, "Show everyone" and the new row (`FOCUS_RING` in `tokens.ts`); the site has no global focus style.
- **Owner change 1 (binding click 2026-10-21):** with the flag ON, /dancers has one small warm-dark row UNDER the wall: a "Join the wall" button and a "Book a photoshoot" link (`JoinRow` in `wall/lists.tsx`, 44px tap targets, explicit px). Targets are the site's REAL routes, not invented:
  - Join the wall -> `HOME_ANNOUNCE_HREF` = `/auth?mode=signup&userType=dancer` (`src/lib/homeAnnounceBanner.ts`, the existing dancer sign-up the home banner's "Create your profile" uses; `/create-dancers-profile` used by the flag-OFF page is unrouted).
  - Book a photoshoot -> `SITE_IA.videographers.path` = `/videographers`. The flag-OFF widget's `/photographers` is ALSO unrouted (it is in `navigateTargetsRoutable`'s KNOWN list); `/videographers` is the only media-booking route in the router and site map. OWNER CHECK: confirm that is the page you want "Book a photoshoot" to open.
  - Table-driven page test (`w2aWallPages.test.tsx`, "Join row"): ON /dancers both links present, hrefs pass `isRoutable` against the real route table, row follows the grid; ON /djs absent; OFF /dancers absent. Red first: the ON /dancers case failed before the row existed.
- **Owner change 2:** chip words stay FULL (Teacher / DJ / Dancer). No change.
- Merged `origin/main` (#921, OG media host) into the branch, no conflicts.
- Screenshot `docs/mockups/w2a-wall/on-dancers-bottom.png` (390x844, production build, flag ON, prod reads); `shot.mjs` now records the row (`dancers-joinRow` in `on-report.json`: both links 44px tall, row below the grid; `djs-joinRow: null`). The other `on-*` shots were re-taken in the same run.

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
1. (Resolved in the fix pass: Join the wall + Book a photoshoot now sit under the wall.) The old /dancers hero widgets (Practice Partners, Create a Profile, Book a Photoshoot) are not shown with the flag ON. The Practice Partners CTA remains in "Find a Dance Partner". Create a Profile and Photoshoot links are gone from this page when ON: `/create-dancers-profile` is a known unroutable target (listed in `navigateTargetsRoutable.test.ts`), so I did not carry it into new code. OWNER DECISION: where should "Create a profile" live?
2. If the badges read fails, only the "All" filter is offered and /dancers shows everyone without chips (a filter can never hide everyone because of a missing read).

## Prod shapes (read-only SELECT, 2026-10-21, counts only)
181 active dancer profiles (`is_active` null or true); 114 with a photo; 19 with a nationality. `list_public_djs_v1(null,200)`: 40 DJs, 17 with `has_upcoming_gig`. Walk against the live reads: /djs 40 tiles; /dancers 93 dancing-role tiles (13 with a photo URL that loads a face attempt, 80 initials because the media host is unreachable here).

## CI: every job step run locally (fix pass, head after merge of main; command, exit)
| Job / step | Command | Exit |
|---|---|---|
| typecheck: RPC typing / WallClock brand | `check:rpc-typing`, `check:wallclock-brand` | 0 / 0 |
| typecheck: tsc | `npm run typecheck` | 2: 99 errors, the same count the author measured on clean main; none in wall files or the two pages |
| architecture-guard: integrity | `bash bin/check-integrity.sh` (after `chmod +x bin/*.sh` as CI does) | 0 |
| legacy tables / program RPCs / runtime architecture | `check:legacy-tables`, `check:legacy-program-rpcs`, `lint:architecture` | 0 / 0 / 0 |
| image audit strict | `AUDIT_STRICT=1 npm run check:images` | 0 |
| mojibake canary, plan-hygiene self-test, no-preview-prefixes (self-test + check) | as named | 0 / 0 / 0 |
| dancer-area-isolation (self-test + check) | `check-dancer-area-isolation.mjs --self-test`, `check:dancer-area-isolation` | 0 |
| lint (whole chain) | `npm run lint` | 0 |
| unit London | `TZ=Europe/London npm run test:unit:offline` | 1: 5 failures, all `tests/integrityCouldNotRun.test.ts` (the same 5 the author showed fail on clean main); 10861 passed |
| unit timing / New_York / Sydney | `test:unit:timing`, CI tz list under each TZ | 0 / 0 / 0 |
| perf-budget: build, bundle budget, first-load requests, chunk cycles (each with self-test) | as named | 0 x4 |
| workflow-lint | masking, notification (+ self-test) | 0 |
| phone-qa build-smoke | `playwright.build.config.ts` | 0 |
| phone-qa phone suite 390x844 + 360x640 | `playwright.phone.config.ts` | 1: 271 passed, 1 failed (keyboard "dancer setup: city search", the same spec the author saw flake); PASSES in isolation (10/10 in that file) |
| e2e-smoke | `npm run test:e2e` with the workflow env | 1: 159 passed, 1 failed (organiser-home "load failure ... Retry", the same spec the author saw flake); PASSES in isolation (6/6) |
| seo-check / doc-weight | `check:seo`, `check:doc-weight` | 1 / 1: need a live Vercel preview URL (`previewProbe` measured 0 pages); not code results |
Not run: Lighthouse (needs preview + Chrome infra), live-DB contract suites, GitHub Actions itself, PR body checkers (run on the PR).

## Tests added and mutants
- Table-driven `wall.test.tsx` (29): shapes x list (DJ with/without gig, past-dated gig hidden, "DJ El Rugido", long names, 3 roles, teacher+dancer, no photo, broken photo, no flag, zero roles, badges-read-failed), filters, empty states, one-link tile, no clipped name styles. `wallContrast.test.tsx`: text >= 4.5, chip edge >= 3 from rendered computed styles. `w2aWallPages.test.tsx`: flag defaults OFF; OFF = old tiles; ON feeds the wall.
- Mutant 1: `linkRoleFor` loop order changed to dancer-first: 2 tests RED (restored). Mutant 2: broken-image fallback (`onError`) dropped: 1 test RED (restored).
- Contrast and layout in the real browser (`on-report.json`): scrollWidth 390 (no sideways scroll), 4 columns, tile 86.4px, `namesClipped` 0, max name lines 2 on all four views, 0 page errors; first tile top at 219px (wall is above the fold).

## Verified / Not verified
Fix pass: Verified the Join row and both hrefs in a production build (flag ON, prod reads) at 390x844 (`on-dancers-bottom.png`, report: 44px links, below the grid, absent on /djs); 94 /dancers tiles and 40 /djs tiles, 0 clipped names, no sideways scroll, 0 page errors. Prod shapes re-read today: 182 active dancer profiles, 115 with a photo, 20 with a nationality. NOT verified in the fix pass: what a SIGNED-IN visitor sees after tapping Join the wall (Auth page with a session), a physical phone, real photo crops, keyboard focus ring in a real browser (asserted by class only).

Verified: real prod reads through a production build (flag ON and OFF) at 390x844; screenshots in `docs/mockups/w2a-wall/` (`on-djs-top`, `on-djs-middle`, `on-dancers-top`, `on-dancers-middle`, `on-*-noPhoto`, `on-*-threeRole`, `on-*-longName`, `on-*-filter`, `off-*-flag-off`); counts above.
NOT verified: REAL PHOTO CROPS. `media.bachatacalendar.co.uk` is refused by the sandbox proxy, so photo tiles fell back to initials (13 of 93 /dancers tiles tried a photo). Not checked on a physical phone; flag and date-chip legibility on busy photos unverified. 360x640 not walked by hand (the phone suite ran). `tsc` has 99 pre-existing errors in this sandbox, so type-safety of my files rests on zero new errors plus vitest. Lighthouse not run.

## Owner look-at list
1. On a phone: do the faces and chips read as "who is who"? Chip words are full (Teacher / DJ / Dancer) so 3-role tiles are two chip rows; say if you want the short forms (DJ / Dance / Teach).
2. "Book a photoshoot" now opens /videographers (the only routed media page; the old /photographers is a dead link). Is that the page you want?
3. Real photos with the flag sticker and gold date chip over them (could not be checked here).

## PR body (ready to paste)
```
## Summary
Face wall on /djs and /dancers behind a new flag `peopleWall` (VITE_ENABLE_PEOPLE_WALL, default OFF). Four columns of big faces on the warm dark base, role chips, filter chips, flag sticker, gold date chip for DJs with a gig. On /dancers, a "Join the wall" button (dancer sign-up, /auth?mode=signup&userType=dancer) and a "Book a photoshoot" link (/videographers) sit under the wall. Independent review fixes: role filters only when role data is present; focus ring on every wall control. No new reads. Flag OFF = pages unchanged. Details: docs/handover/w2a-wall.md and docs/handover/w2a-wall-review.md.

## Phone QA
- Sizes checked: 390x844 production build with flag ON and OFF against prod reads; phone suite at 390x844 and 360x640.
- Walked: /djs and /dancers top and scrolled middle, the Join row under the /dancers wall (on-dancers-bottom.png), no-photo tile, 3-role tile, long-name tile, filter applied, flag-OFF page; measured no sideways scroll, 4 columns, 0 clipped names, max 2 name lines.
- Not verified: real photo crops (media host unreachable from the build sandbox), a physical phone, 360x640 by hand.

## Verified on real data
- Shapes surveyed: (read-only, counts, re-read in the fix pass) 182 active dancer profiles, 115 with a photo, 20 with a nationality; list_public_djs_v1 = 40 DJs, 17 with an upcoming gig; walk showed /djs 40 tiles and /dancers 93.
- Checks run: table-driven wall tests (30, incl. the review R1 case, red first) + Join row page table (3 cases, red first) + contrast + page flag tests, two mutants red, every CI job step in the handover table, production-build walk at 390x844 with prod reads.
- NOT verified: signed-in tap on Join the wall, real photos (sandbox cannot reach the media host), physical phone, seo/doc-weight (need a preview URL), Lighthouse, live-DB contract suites; 5 integrityCouldNotRun tests fail on main too; a few organiser/keyboard e2e specs flaked under load and passed on re-run.
```
