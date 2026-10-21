# W2-A: the face wall on /djs and /dancers (behind `flags.peopleWall`, default OFF)

Branch `claude/w2a-wall` (from main at #893). No PR opened (gh not authed); the orchestrator opens it from the body at the bottom.

## Layout pass (2026-10-21, ticket dt_f3639454d52e, brief `W2A-layout-brief.md` ba6f67c8)
Owner decisions (binding): keep today's heroes, no wall header, no new CTA section. With `peopleWall` ON the page order is now exactly:
1. **Today's hero, untouched.** /dancers: dancer emoji, big "Meet Dancers", faint line art and its own cards (Find Practice Partners, Create a Profile, Book a Photoshoot). /djs: headphones emoji, "Bachata DJs", subtitle. Same JSX as flag OFF (`DJs.tsx` hoists the hero object into one `hero` const used by both paths; `Dancers.tsx` no longer hides the hero or the cards).
2. **Filter pills** (the wall's warm dark pill style): All, Dancers, DJs, Teachers, then an **Organisers link** styled as a pill.
3. **The 4-column wall**, then everything below as today (Your Plans, Find a Dance Partner).

Removed from the ON path: the wall's own header ("Meet the ... behind the nights" + "Tap a face...") and the "Join the wall / Book a photoshoot" row (`JoinRow` deleted; the hero's own cards replace it).

Pill behaviour (`wallPills` in `PeopleWall.tsx`):
- **All / Dancers / DJs:** narrow the wall as built. Review fix R1 stays: Dancers / DJs are offered only when role data is present (badges read ok AND some tile has a role tag).
- **Teachers:** always shown while teacher pages are closed (`teacherPagesOpen` = `flags.teacherDetail`, the BadgeOpts option). Tapping it shows NO faces and one sentence: "Teachers are coming soon. Meanwhile, browse DJs and dancers." with two pill buttons, **Browse DJs** and **Browse dancers**, that switch to those pills (if role data is missing and those pills are not offered, one **Show everyone** button instead). When teacher pages open it filters like the others. One edge: teacher pages OPEN but NO role data -> no Teachers pill (filtering would empty the wall, the R1 rule); I chose R1 over "always shown" there, say if you want otherwise.
- **Organisers:** always shown, a real `<a href="/organisers">` (React Router `Link`), never a filter state. `/organisers` is the public organisers page in the router (`AnimatedRoutes.tsx`) and `SITE_IA.organisers.path`.

Hero cards on /dancers, flag ON only (flag OFF untouched):
- **Create a Profile** -> `HOME_ANNOUNCE_HREF` = `/auth?mode=signup&userType=dancer` (the real dancer sign-up). Flag OFF still navigates to `/create-dancers-profile`, which is UNROUTED: separate follow-up, not fixed here (still in `navigateTargetsRoutable`'s KNOWN list, as is `DancerDashboard`, `EditProfile`, `PracticePartners` and the /dancers empty-state button).
- **Book a Photoshoot** -> `/videographers`. Its flag-OFF target `/photographers` is ALSO unrouted, so per the brief it uses `/videographers` (the only media-booking page, owner approved earlier). Flag OFF keeps `/photographers` (same follow-up).
- Both OFF literals stay written as `navigate('/...')` so the `navigateTargetsRoutable` scanner keeps seeing the dead links (wrapping them in a ternary made its KNOWN-list entry look "fixed" and turned that test red; caught by the London unit leg, fixed before push).

Chunk note: `/organisers` and `/videographers` are literals (`ORGANISERS_HREF` in `PeopleWall.tsx`, `MEDIA_BOOKING_HREF` in `lists.tsx`), pinned to `SITE_IA` by a test. Importing `SITE_IA` into the wall/Dancers chunks split `siteIa` into its own chunk: +1 first-load request on /event, /parties, /classes (`check:bundle-budget` chunk ratchet and `check:first-load-requests` both RED at 20e593c, green at 7aa2a78; main itself green).

Tests (table-driven, red first):
- `wall.test.tsx` "layout pass" block (12 new cases): Teachers coming soon x {djs, dancers} x {roles known, badges failed} (sentence, zero tiles, the right buttons); Browse DJs / Browse dancers switch pills; teacher pages open + no role data -> no Teachers pill; Organisers is an `A` with `href=/organisers`, routable (`isRoutable`), after the filter pills, x 4 states; literal hrefs == SITE_IA; no wall header / heading. Updated existing assertions that pinned the old pill set (`['All','Dancers','DJs','Teachers']`, and `['All','Teachers']` without role data). Red first: 15 failed on the pre-pass wall code.
- `w2aWallPages.test.tsx` (page level, GlobalLayout mock now renders the hero): ON/OFF x /dancers,/djs order hero -> (hero cards) -> pills -> grid, pills set, Organisers routable, no "behind the nights", no Join row, no duplicate "Meet" header; Teachers pill coming soon + zero tiles on both pages; /dancers hero cards ON -> `/auth?mode=signup&userType=dancer` and `/videographers` (routable), OFF -> `/create-dancers-profile` and `/photographers` (unroutable, unchanged); **flag OFF markup snapshot** of both pages, written in a worktree of `origin/main` (811d6eb) with this same test file, then copied here: the branch renders byte-identical OFF markup. Red first: 6 failed on the pre-pass code (the OFF snapshots passed there too, as they must).
- **Mutant** (brief): `teachersSoon = false` (Teachers allowed to filter while pages closed) -> 6 tests RED; restored.
- jsdom note: mounting /dancers after a pill click in an earlier test never returned (framer-motion under jsdom), so the page-level click tests are last in the file and the hero card tests call the card's React `onClick` instead of a synthetic click. Not seen in the real browser walk.

Walk (390x844, production build with `VITE_ENABLE_PEOPLE_WALL=true`, prod reads, `shot.mjs`): screenshots `on-dancers-top.png` (hero + cards + pills + first tiles), `on-djs-top.png`, `on-*-pills.png`, `on-*-teachers.png` (coming soon), `on-*-filter.png` (a filter applied), `off-*-flag-off.png` (flag OFF build, unchanged). `on-dancers-bottom.png` (the removed Join row) deleted. Report (`on-report.json`): /dancers 94 tiles, /djs 40; scrollWidth 390 on all four views; namesClipped 0; max name lines 2; 4 columns, tile 86.4px; **firstTileTop 594px on /dancers, 419px on /djs** (the kept hero pushes the wall down: on /dancers the first tile row starts in the bottom third of the first screen); pills top 497 / 322; Organisers `{tag: A, href: /organisers, h: 40}`; Teachers tapped: the sentence and 0 tiles on both pages; wall header absent; Join row absent; 0 page errors.

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
- **After (flag ON, layout pass):** today's hero exactly as before (on /dancers with its own three cards), filter pills (All, Dancers, DJs, Teachers, and an Organisers link), then a FOUR-column wall of big square faces (86px at 390) on the warm dark base. Each tile: face (photo, or a role-coloured tile with big initials if there is no photo or the photo fails), name (2 lines max, never clipped), coloured role chips, a flag sticker top-right only when there is a nationality, a gold "Fri 23" chip bottom-left only for a DJ with an upcoming gig. The whole tile is one link.
- Flag OFF: the pages render exactly as before (page code path untouched; the existing `w1PeopleListsPage` tests pass unchanged).

## Turn it on
Set `VITE_ENABLE_PEOPLE_WALL=true` in the Vercel env (build-time, like the other flags in `src/lib/featureFlags.ts`; key `peopleWall`) and redeploy. Unset/anything else = OFF.

## Files
- `src/modules/person-page/wall/`: `tokens.ts` (ALL colours/sizes, one file), `model.ts` (pure: tile model, date label, initials, filter), `RoleChip.tsx`, `WallTile.tsx`, `PeopleWall.tsx` (pills incl. Teachers coming soon and the Organisers link, grid, empty states, skeleton), `lists.tsx` (`DjsWall`, `DancersWall` adapters), `__tests__/wall.test.tsx`, `__tests__/wallContrast.test.tsx`.
- `src/pages/DJs.tsx`: early `if (flags.peopleWall) return ...` after all hooks, with the same `hero` const as OFF; `isError` of `usePeopleBadges` is now read. `src/pages/Dancers.tsx`: only the directory section and the two hero-card targets are conditional on the flag (the "Your Plans" and "Find a Dance Partner" sections stay below the wall). `src/lib/featureFlags.ts`: `peopleWall`.
- `src/pages/__tests__/w2aWallPages.test.tsx`: flag OFF / ON at page level.
- `docs/mockups/w2a-wall/`: screenshots, `shot.mjs` (walk + measurements), `on-report.json`, `off-report.json`.

## One mapping, no copies
Chips: `roleTagsFor` (badges.ts: ROLE_ORDER, ROLE_LABEL) so labels are the FULL words (Teacher / DJ / Dancer), not the S10 short forms (that avoids a second copy of the vocabulary; 3 chips wrap to 2 rows at 86px). Links: `djTile().href` / `dancerHref` (same targets as today); `linkRoleFor` picks the tile's lead colour (DJ first), and `linkFor` is the fallback href. Names: DJs list uses `djTile().name` (stage name leads) with a leading "DJ " dropped so the chip is not repeated ("DJ El Rugido" reads "El Rugido", per the brief); the dancers list uses today's `renderPublicName` result. Date: `has_upcoming_gig` + `next_gig_date` (DJs) or the badges `nextGigDate` for a DJ-role person on /dancers, shown only when the date is real and not past (`londonDate` helpers). Profile-view telemetry (`emitProfileView`, `listing:djs` / `listing:dancers`) is kept on every tile. No read added or changed.

## Deliberate differences to flag
1. (Superseded by the layout pass: the hero and its cards are back with the flag ON; Create a Profile -> dancer sign-up, Book a Photoshoot -> /videographers.) The old /dancers hero widgets (Practice Partners, Create a Profile, Book a Photoshoot) are not shown with the flag ON. The Practice Partners CTA remains in "Find a Dance Partner". Create a Profile and Photoshoot links are gone from this page when ON: `/create-dancers-profile` is a known unroutable target (listed in `navigateTargetsRoutable.test.ts`), so I did not carry it into new code. OWNER DECISION: where should "Create a profile" live?
2. If the badges read fails, no role filter is offered (All, Teachers coming soon, Organisers link stay) and /dancers shows everyone without chips (a filter can never hide everyone because of a missing read).

## Prod shapes (read-only SELECT, 2026-10-21, counts only)
Layout pass re-read: 182 active dancer profiles, 115 with a photo, 20 with a nationality. Walk: /djs 40 tiles, /dancers 94.
181 active dancer profiles (`is_active` null or true); 114 with a photo; 19 with a nationality. `list_public_djs_v1(null,200)`: 40 DJs, 17 with `has_upcoming_gig`. Walk against the live reads: /djs 40 tiles; /dancers 93 dancing-role tiles (13 with a photo URL that loads a face attempt, 80 initials because the media host is unreachable here).

## CI: every job step run locally (layout pass; merged origin/main 811d6eb; command, exit)
Full run at 20e593c (layout code + merge), then the two fixes it found re-checked at the final head 2eb3da2.
| Job / step | Command | Exit |
|---|---|---|
| typecheck: RPC typing / WallClock brand | `check:rpc-typing`, `check:wallclock-brand` | 0 / 0 |
| typecheck: tsc | `npm run typecheck` | 2: 99 errors, the same pre-existing count as before this pass (final head too); none in wall files or the two pages |
| architecture-guard: integrity | `chmod +x bin/*.sh && bin/check-integrity.sh` | 0 |
| legacy tables / program RPCs / runtime architecture | `check:legacy-tables`, `check:legacy-program-rpcs`, `lint:architecture` | 0 / 0 / 0 |
| image audit strict | `AUDIT_STRICT=1 npm run check:images` | 0 |
| mojibake canary, plan-hygiene self-test, no-preview-prefixes (self-test + check) | as named | 0 / 0 / 0 / 0 |
| dancer-area-isolation (self-test + check), docs-only self-test | as named | 0 / 0 / 0 |
| workflow-lint | masking, notification (+ self-test) | 0 / 0 / 0 |
| lint (whole chain) | `npm run lint` | 0 (final head too) |
| perf-budget: build, bundle budget, first-load requests, chunk cycles (each + self-test) | as named | 20e593c: bundle 1 and first-load 1 (siteIa split, +1 chunk on /event, /parties, /classes; main green). **Final head (7aa2a78 code): 0 x all 7.** |
| unit London | `TZ=Europe/London npm run test:unit:offline` | 20e593c: 6 failed (navigateTargetsRoutable stale-entry, fixed in 2eb3da2 + the 5 below). **Final head: 1, 5 failed / 11565 passed, all 5 in `tests/integrityCouldNotRun.test.ts`, which fail identically on clean main 811d6eb (checked in a main worktree)** |
| unit timing / New_York / Sydney | `test:unit:timing`, the CI tz list under each TZ | 0 / 0 / 0 |
| phone-qa build-smoke | `playwright.build.config.ts` | 0 (66 passed) |
| phone-qa phone suite 390x844 + 360x640 | `playwright.phone.config.ts` | 0 (272 passed) |
| e2e-smoke | `npm run test:e2e` with the workflow env | 0 (160 passed) |
Not run: seo-check / doc-weight / Lighthouse (need a live Vercel preview URL), live-DB contract suites, GitHub Actions itself, PR body checkers (run on the PR). Phone, e2e, build-smoke, timezone legs ran at 20e593c; the two later commits only change two string constants' source and two `onClick` bodies (covered by the re-run unit/lint/tsc/perf).

## Tests added and mutants
- Layout pass: see the Layout pass section (12 new wall cases + 12 new page cases, red first 15 / 6; mutant `teachersSoon = false` -> 6 RED, restored).
- Table-driven `wall.test.tsx` (29): shapes x list (DJ with/without gig, past-dated gig hidden, "DJ El Rugido", long names, 3 roles, teacher+dancer, no photo, broken photo, no flag, zero roles, badges-read-failed), filters, empty states, one-link tile, no clipped name styles. `wallContrast.test.tsx`: text >= 4.5, chip edge >= 3 from rendered computed styles. `w2aWallPages.test.tsx`: flag defaults OFF; OFF = old tiles; ON feeds the wall.
- Mutant 1: `linkRoleFor` loop order changed to dancer-first: 2 tests RED (restored). Mutant 2: broken-image fallback (`onError`) dropped: 1 test RED (restored).
- Contrast and layout in the real browser (`on-report.json`): scrollWidth 390 (no sideways scroll), 4 columns, tile 86.4px, `namesClipped` 0, max name lines 2 on all four views, 0 page errors; first tile top at 219px (wall is above the fold).

## Verified / Not verified
Layout pass: VERIFIED in a production build (flag ON and OFF) against prod reads at 390x844: hero -> pills -> wall order on both pages, pills All / Dancers / DJs / Teachers + Organisers link (`/organisers`, a real anchor), Teachers tapped = coming-soon sentence with 0 tiles on both pages, a filter applied, no wall header, no Join row, scrollWidth 390, namesClipped 0, 0 page errors; /dancers 94 tiles, /djs 40. Flag OFF: page markup identical to main (snapshot from a main worktree) and the OFF screenshots.
NOT VERIFIED: real photo crops (cannot be verified in the sandbox; the walk counted 50 photo attempts on /dancers but I did not judge crops), a physical phone, 360x640 by hand (the phone suite ran), what a visitor sees after tapping Create a Profile with a session, the /organisers page content itself (only that the link is routable), keyboard focus ring in a real browser, the Organisers pill wrapping (seen: it wraps to a second row at 390).

Earlier passes:
Fix pass: Verified the Join row and both hrefs in a production build (flag ON, prod reads) at 390x844 (`on-dancers-bottom.png`, report: 44px links, below the grid, absent on /djs); 94 /dancers tiles and 40 /djs tiles, 0 clipped names, no sideways scroll, 0 page errors. Prod shapes re-read today: 182 active dancer profiles, 115 with a photo, 20 with a nationality. NOT verified in the fix pass: what a SIGNED-IN visitor sees after tapping Join the wall (Auth page with a session), a physical phone, real photo crops, keyboard focus ring in a real browser (asserted by class only).

Verified: real prod reads through a production build (flag ON and OFF) at 390x844; screenshots in `docs/mockups/w2a-wall/` (`on-djs-top`, `on-djs-middle`, `on-dancers-top`, `on-dancers-middle`, `on-*-noPhoto`, `on-*-threeRole`, `on-*-longName`, `on-*-filter`, `off-*-flag-off`); counts above.
NOT verified: REAL PHOTO CROPS. `media.bachatacalendar.co.uk` is refused by the sandbox proxy, so photo tiles fell back to initials (13 of 93 /dancers tiles tried a photo). Not checked on a physical phone; flag and date-chip legibility on busy photos unverified. 360x640 not walked by hand (the phone suite ran). `tsc` has 99 pre-existing errors in this sandbox, so type-safety of my files rests on zero new errors plus vitest. Lighthouse not run.

## Owner look-at list
1. **The wall now starts low.** With your hero kept, the first faces start at 594px on /dancers (bottom third of a 390x844 screen) and 419px on /djs. Look at `on-dancers-top.png`: is that the balance you want?
2. **Pills wrap to two rows at 390:** All, Dancers, DJs, Teachers on row 1, Organisers alone on row 2 (`on-dancers-pills.png`). Fitting one row needs smaller pills (padding or 12px text), which I did not do without your say. Pills are 40px tall (the wall's existing pill size), under the 44px tap target used elsewhere.
3. **Teachers coming soon** (`on-djs-teachers.png`): the sentence and the two "Browse DJs / Browse dancers" buttons. And the follow-up: flag OFF still sends Create a Profile to the dead `/create-dancers-profile` and Book a Photoshoot to the dead `/photographers` (left as is per the brief).

## PR body (ready to paste)
```
## Summary
Face wall on /djs and /dancers behind a new flag `peopleWall` (VITE_ENABLE_PEOPLE_WALL, default OFF). Layout pass (owner decisions 2026-10-21): with the flag ON each page keeps TODAY's hero exactly (on /dancers with its own cards), then filter pills (All, Dancers, DJs, Teachers, and an Organisers link to /organisers), then the four-column face wall, then the rest of the page as today. The wall's own header and the Join row are gone. Teachers pill: "Teachers are coming soon" with Browse DJs / Browse dancers while teacher pages are closed, a normal filter once they open. With the flag ON the /dancers hero cards open real routes (Create a Profile -> /auth?mode=signup&userType=dancer, Book a Photoshoot -> /videographers). No new reads. Flag OFF = pages unchanged (OFF markup snapshot taken from main). Details: docs/handover/w2a-wall.md and docs/handover/w2a-wall-review.md.

## Phone QA
- Sizes checked: 390x844 production build with flag ON and OFF against prod reads; phone suite at 390x844 and 360x640 (272 passed).
- Walked: /dancers and /djs top (hero + pills), pills, Teachers tapped (coming soon, 0 tiles), Organisers pill (href /organisers, an anchor), a filter applied, scrolled middle, no-photo / 3-role / long-name tiles, flag-OFF pages; scrollWidth 390, 4 columns, 0 clipped names, max 2 name lines, first tile at 594px (/dancers) and 419px (/djs), 0 page errors.
- Not verified: real photo crops (cannot be verified in the sandbox), a physical phone, 360x640 by hand.

## Verified on real data
- Shapes surveyed: (read-only, counts) 182 active dancer profiles, 115 with a photo, 20 with a nationality; walk showed /djs 40 tiles and /dancers 94.
- Checks run: table-driven wall + page tests (24 new, red first), one mutant red (Teachers filtering while pages closed), flag-OFF snapshot from a main worktree, every CI job step in the handover table, production-build walk at 390x844 with prod reads.
- NOT verified: real photos, physical phone, signed-in tap on Create a Profile, seo/doc-weight/Lighthouse (need a preview URL), live-DB contract suites; 5 integrityCouldNotRun tests fail on clean main too.
```
