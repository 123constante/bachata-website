# W2-A: the face wall on /djs and /dancers (behind `flags.peopleWall`, default OFF)

Branch `claude/w2a-wall` (from main at #893). No PR opened (gh not authed); the orchestrator opens it from the body at the bottom.

## Critique + fix pass (2026-10-22, independent reviewer, ticket dt_7082432fddd9, brief `W2A-critique-brief.md` 450768fd)
Fresh worker, not the builder. Critique written FIRST: [`docs/design/924-critique.md`](../design/924-critique.md) (13 items, each with severity and verdict). Then one fix pass, flag-ON path only.
- **What changed (code):** `wall/tokens.ts` `SIZE.filterHeight` 40 -> **44**, new `SIZE.filterPadX` 10 (was a 14px literal) and `SIZE.filterGap` 6 (was rem `gap-2`, 6.75px on phones); `PeopleWall.tsx` pills / Organisers link / coming-soon buttons get `minWidth` 44 and centred labels; coming-soon sentence now "Teacher pages are coming soon. Meanwhile, browse DJs and dancers." Hero, order, pill set, Teachers coming-soon behaviour and the Organisers link are untouched.
- **Result (prod build, flag ON, PROD reads, 390x844):** every pill and the link 44px tall (All 44x44, Dancers 75x44, DJs 46x44, Teachers 81x44, Organisers 92x44); the five fit ONE row at 390 and 430 (8px spare at 390); at 360 Organisers still wraps alone to row 2 (accepted, see critique #2). First tile: /dancers 594 -> **551px**, /djs 419 -> **376px**. scrollWidth 390, 0 clipped names, max 2 name lines, /dancers 94 tiles (50 photo / 44 initials), /djs 40, 0 page errors (`on-report.json`, now also `pillSizes` / `pillRows`).
- **Tests (red first):** `wall.test.tsx` new table: {filter pills, Organisers link, coming-soon buttons} x {/djs, /dancers} >= 44px tall and wide: 3 RED at head a1b655b7 (40px, no min width), green after. The coming-soon wording assertions in `wall.test.tsx` (4) and `w2aWallPages.test.tsx` (2) were changed first: 6 RED, green after. Wall + page files: 68/68.
- **Seams after this pass** (`seam.mjs`, 360 / 390 / 430, exit 0 each; raw: `seam-critique-390.txt`): /dancers hero -> pills max step 2 / 3 / 3; /dancers wall -> Your Plans 1 / 1 / 1; /djs hero -> pills 1 / 1 / 1; /djs wall -> footer ground 1 / 1 / 1. Pills -> tiles: one surface.
- **What I saw in the retaken pictures** (all of `docs/mockups/w2a-wall/on-*`, looked at): `on-dancers-pills.png`: the blue-green ground under Book a Photoshoot warms into brown across the single pill row, no line; All is a cream 44px circle, the four outlined pills sit level; faces start right under. `on-djs-teachers.png`: near-black hero into brown at the pills, no line; Teachers selected; the sentence wraps with "dancers." alone on line 2 (nice-to-fix, not done), Browse DJs / Browse dancers 44px under it; below that the empty page ground down to the fold (the coming-soon state is short; pre-existing). `on-djs-wall-to-next.png`: the last tile row's brown cools to near-black with no line, then the site's orange footer (site-wide, unchanged). `on-dancers-wall-to-next.png`: brown cools into the Your Plans ground, no line.
- **Owner calls (not in code), with my recommendation:** (1) the ~64px empty band under the /dancers hero's last card is the hero's own bottom padding: trim ~40px with the flag ON so faces lift into the first screen; (2) Organisers looks exactly like a filter but leaves the page: add a small chevron (costs ~12px, would re-wrap the row at 390, so only with a shorter label or smaller pills); (3) the light circle on initials tiles reads like a ghost button at 86px: drop it, keep the diagonal texture; (4) balance the coming-soon sentence so "dancers." is not alone on a line.
- **Not verified (this pass):** a physical phone (font metrics: the one-row fit has 8px spare at 390 with the site's webfont; a fallback font could wrap Organisers again); landscape / desktop; real photo crops (photo host blocked); 360 and 430 were measured (pill rows, seams), not photographed; doc-weight / Lighthouse (need the Vercel preview).

### CI: every job step run locally (critique pass, commit 5568733 code; command, exit)
| Job / step | Command | Exit |
|---|---|---|
| typecheck job | `check:rpc-typing`, `check:wallclock-brand` | 0 / 0 |
| tsc (not a CI gate) | `npm run typecheck` | 2: 99 errors, same pre-existing count, none in wall files or the two pages |
| architecture-guard | `bin/check-integrity.sh` (after `chmod +x bin/*.sh`), `check:legacy-tables`, `check:legacy-program-rpcs`, `lint:architecture`, `AUDIT_STRICT=1 check:images`, `check:image-widths` (+ self-test), `check:plan-hygiene:self-test`, `check:mojibake` (+ self-test), `check:workflow-artifact-policy` (+ self-test) | 0 x 12 |
| workflow-lint | docs-only self-test, masking, notification (+ self-test), no-preview-prefixes (+ self-test) | 0 x 6 |
| unit-tests: dancer-area-isolation (+ self-test), migration authority | as named | 0 / 0 / 0 |
| lint (whole chain) | `npm run lint` | 0 |
| perf-budget | self-tests x3, `npm run build`, `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` | 0 x 7 |
| unit London | `TZ=Europe/London npm run test:unit:offline` (2 threads) | 1: **5 failed / 11572 passed, all 5 in `tests/integrityCouldNotRun.test.ts`**, the same 5 that fail on clean main (earlier passes checked it in a main worktree) |
| unit timing / New_York / Sydney | `test:unit:timing`, the CI tz list under each TZ | 0 / 0 / 0 |
| phone-qa build-smoke | `playwright.build.config.ts` | 0 |
| phone-qa phone suite | `playwright.phone.config.ts` | full run 1: 3 failed / 269 passed (keyboard x2, organiser contact sheet 360x640); re-run alone: keyboard passed; contact sheet passed **12/12** on a clean tree (none touch /dancers or /djs) |
| e2e-smoke | `npm run test:e2e` | 1: 2 failed / 158 passed: `organiser-layout` passed alone; `organiser-home.spec.ts:55` (load failure + Retry) **fails on clean main 811d6eb too** (main worktree: 3 failed there), not this PR |
| Not runnable here | `check:doc-weight`, `check:lighthouse` (need the Vercel preview), `check-ci-budget`, live-DB contract suites, PR body checkers (run on the PR) | - |

## Seam fix pass (2026-10-22, ticket dt_38e92fd874e7, brief `W2A-seam-brief.md` 3d95a0c0)
Owner's defect: with the flag ON the kept hero ended in a HARD line against the wall's warm-brown base. Owner decision (click): SOFT FADE, hero untouched.
- **Fix (flag-ON path only, no OFF markup touched, no layout box added):** the wall's own background is now `WALL_FADE` (`wall/tokens.ts`): clear -> `#1E1410` over the top 64px and back to clear over the bottom 64px, so the page ground under the hero shows through and warms into the wall, and the wall cools back into whatever follows. Tokens: `SEAM = { clear: 'rgba(30, 20, 16, 0)', base: WALL.page, height: 64 }`. Used by `PeopleWall` and `WallSkeleton` (`data-seam="soft"`). Pill and tile positions are unchanged (first tile 594px /dancers, 419px /djs).
- **Why from clear, not from the sampled hero colour:** I sampled the hero bottom in the browser (/dancers rgb(20,28,33), /djs rgb(10,8,11)); they differ per page and the /dancers ground is a fixed, animated layer, so any hard-coded start colour would draw a new edge. The sampled values are in the `SEAM` comment and `docs/design/924.md`.
- **Two gradient layers instead of one with `calc()` stops:** same pixels; jsdom drops a gradient with `calc()` stops, which would have left the unit test unable to see the style.
- **Bottom seam:** it WAS hard too (warm brown -> /dancers Your Plans rgb(14,18,21), -> /djs ground rgb(10,8,11)); same soft treatment. /djs has no Your Plans; the site's orange footer starts ~54px under the wall there (site-wide, same with the flag OFF; not touched).
- **Browser measurement** (`docs/mockups/w2a-wall/seam.mjs`, production build, flag ON, PROD reads, pixel column x=4, 48px outside to 72px inside each wall edge; exits 1 on any adjacent-row step >= 6 in any channel):

| Seam | Current head 88777931 (red, exit 1) | This pass 360 / 390 / 430 (exit 0) |
|---|---|---|
| /dancers hero -> wall | step 16 at the edge: rgb(20,28,33) -> rgb(30,20,16) | 3 / 2 / 3 |
| /dancers wall -> Your Plans | 16: rgb(30,20,16) -> rgb(14,18,21) | 1 / 1 / 1 |
| /djs hero -> wall | 20: rgb(10,8,11) -> rgb(30,20,16) | 1 / 1 / 1 |
| /djs wall -> footer ground | 20: rgb(30,20,16) -> rgb(10,8,11) | 1 / 1 / 1 |

  Raw output: `docs/mockups/w2a-wall/seam-before-390.txt`, `seam-after-390.txt`.
- **Tests (table-driven, red first):** `w2aWallPages.test.tsx` "soft seam" x {dancers, djs} x {ON, OFF}: ON = exactly one `[data-seam]` element, it is the wall root, after the hero, its first child is the pills, its background props equal `WALL_FADE` (through the same CSS parser), no solid background colour, gradient built from `SEAM` (height 48-72, base = `WALL.page`); OFF = no `[data-seam]` and the OFF markup snapshots unchanged. Red first: the 2 ON cases failed on the unfixed wall code (19 others passed, OFF snapshots included).
- **Design record:** `docs/design/924.md` (brief, options, tokens, self-running checks, colour-seam inspection, walk, not verified). One self-check FAILS and predates this pass: filter pills and the Organisers link are 40px tall (< 44px). Not changed (seam-only brief); owner call.
- **Walk** (390x844, production build, flag ON, prod reads): retook `on-dancers-top`, `on-djs-top`, `on-*-pills` (hero bottom + pills + first tiles), new `on-dancers-wall-to-next.png` / `on-djs-wall-to-next.png` (390x1400, end of wall into the next section), plus the rest of the `on-*` set and `on-report.json` from `shot.mjs`. What I saw at each seam: /dancers hero -> pills: the blue-green ground under the cards warms into brown across the pill row, no line. /djs hero -> pills: near-black into brown, no line. Pills -> tiles: same surface, nothing to see. /dancers wall -> Your Plans: brown cools into the Your Plans ground under the last tile row, no line. /djs wall -> footer: brown cools into near-black, then the orange footer (unchanged, site-wide).
- **Sandbox note:** this container's `VITE_SUPABASE_URL` points at a NON-prod project (fixture names, `get_public_people_badges_v1` 404, 4 DJs). The walk and measurements above were rebuilt against prod (`stsdtacfauprzrdebmzg`, public anon key from the Supabase connector, not committed): 94 dancers, 40 DJs, all pills, matching the layout pass.

- **Review round (one, `/code-review` medium on the seam commit; 9 findings):** fixed 7: `SEAM.clear` is now derived from `WALL.page` (was a copied literal; test pins it); `WALL_FADE.minHeight` = 2 x SEAM.height so a short wall still reaches the solid base; the contrast test had been silently weakened by the change (it read the root's `backgroundColor`, now empty) and now uses the painted base, proven present in the rendered gradient, PLUS checks pill and name text against the three measured fade-zone grounds; seam.mjs exits 2 if the viewport cuts its window, and falls back to the default Chromium; the copied gradient formula assertion was dropped; the page test waits for the wall root (skeleton timing); the "Kept LAST" comment is back above the click tests. Not fixed, noted: the /dancers animated ground was sampled at one moment (the fade starts from clear and every measured ground keeps >= 14.8:1); seam.mjs is a walk script, not a CI gate. Mutant after the fixes: fade removed from the wall root -> 3 tests RED, restored. Re-measured after the fixes: identical numbers.
- **Verified (this pass):** the soft seam at both edges of the wall on /dancers and /djs, flag ON, production build, prod reads, 360/390/430, by pixel measurement and by eye in the screenshots; OFF markup snapshots unchanged; layout unchanged (first tile 594 / 419px, pills 497 / 322px, scrollWidth 390, 0 clipped names, 0 page errors).
- **Not verified (this pass):** a physical phone; landscape / desktop; the animated /dancers ground across its whole cycle; real photo crops (photo host blocked); doc-weight and Lighthouse (need the Vercel preview).

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

## CI: every job step run locally (seam fix pass, head before the final docs commit; command, exit)
| Job / step | Command | Exit |
|---|---|---|
| architecture-guard: integrity, legacy tables, legacy program RPCs, runtime architecture | `bin/check-integrity.sh`, `check:legacy-tables`, `check:legacy-program-rpcs`, `lint:architecture` | 0 / 0 / 0 / 0 |
| image audit strict, image widths (+ self-test) | `AUDIT_STRICT=1 npm run check:images`, `check:image-widths(:self-test)` | 0 / 0 / 0 |
| plan-hygiene canary, workflow-artifact-policy (+ self-test), mojibake canary + grep, entry point (+ self-test) | as named | 0 x 7 |
| unit London | `TZ=Europe/London npm run test:unit:offline` (2 workers; the default pool OOM-restarted this container once) | 1: **5 failed / 11569 passed, all 5 in `tests/integrityCouldNotRun.test.ts`**, the same 5 that fail on clean main 811d6eb (layout pass checked it in a main worktree; still failing here with `bin/*.sh` executable) |
| unit timing / New_York / Sydney | `test:unit:timing`, the CI tz list under each TZ | 0 / 0 / 0 |
| dancer-area-isolation (+ self-test) | `check:dancer-area-isolation` | 0 / 0 (a first red was a stale local `origin/main`; after `git fetch origin main` the merge-base is 811d6eb and it passes) |
| perf-budget: self-tests x3, build, bundle budget, first-load requests, chunk cycles | as named | 0 x 7 |
| migration authority | `node scripts/check-migration-stamps.mjs` | 0 |
| lint (whole chain) | `npm run lint` (with `chmod +x bin/*.sh`, as the CI job does) | 0 |
| e2e-smoke | `npm run test:e2e` | full run alongside the unit suite: 8 failed / 150 passed (account settings, organiser, dancer-app specs, none touch /dancers or /djs); the 8 re-run alone: **8 passed** (load, not this PR) |
| phone-qa phone suite 390x844 + 360x640 | `playwright.phone.config.ts` | full run: 1 failed / 271 passed (organiser contact sheet); that spec re-run alone: **12 passed** |
| phone-qa build-smoke | `npm run build` + `playwright.build.config.ts` | 0 (66 passed) |
| Not runnable here | `check:doc-weight`, `check:lighthouse` (need `GITHUB_REPOSITORY` + a Vercel preview), `check-ci-budget` (needs `CI_BUDGET_GITHUB_TOKEN`), live-DB contract suites, PR body checkers (`check-pr-phone-qa`, `check-pr-real-data-verified`, run on the PR) | - |

## CI: layout pass (kept for the record)
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
1. **Pills now fit one row at 390** (`on-dancers-pills.png`): 44px tall, tighter sides. At 360 Organisers still drops to a second row alone. Happy with that?
2. **The empty band under the /dancers hero** (critique #4): trim the hero's bottom padding with the flag ON? It would lift the first faces into the first screen.
3. **Organisers looks like a filter but opens another page** (critique #5): add a chevron? (would need smaller pills or a shorter word to stay on one row).
4. **The light circle on initials tiles** (critique #6): keep or drop?
5. Still open from earlier: flag OFF sends Create a Profile to the dead `/create-dancers-profile` and Book a Photoshoot to the dead `/photographers`.

## PR body (ready to paste)
```
## Summary
Face wall on /djs and /dancers behind the flag `peopleWall` (VITE_ENABLE_PEOPLE_WALL, default OFF). With the flag ON each page keeps TODAY's hero exactly (on /dancers with its own cards), then filter pills (All, Dancers, DJs, Teachers, and an Organisers link to /organisers), then the four-column face wall, then the rest of the page as today. Teachers pill: "Teacher pages are coming soon" with Browse DJs / Browse dancers while teacher pages are closed. With the flag ON the /dancers hero cards open real routes (/auth?mode=signup&userType=dancer, /videographers). No new reads. Flag OFF = pages unchanged (OFF markup snapshot taken from main).

Seam fix (owner 2026-10-22, "soft fade"): the wall's background fades in from clear over 64px at the top and back out over 64px at the bottom (tokens SEAM / WALL_FADE), so there is no hard line at either edge.

Critique pass (independent reviewer, docs/design/924-critique.md): pills, the Organisers link and the coming-soon buttons are now 44px tap targets (were 40) and the five pills fit one row at 390 and 430 (first faces 43px higher); the coming-soon sentence says "Teacher pages" because the wall itself shows Teacher chips. Four owner calls listed in docs/handover/w2a-wall.md. Design record: docs/design/924.md.

## Phone QA
- Sizes checked: 390x844 production build, flag ON, prod reads (walk + measurements); pill rows and seams also measured at 360 and 430 wide; phone suite at 390x844 and 360x640.
- Walked: /dancers and /djs top (hero + pills + first tiles), pills, Teachers tapped, a filter applied, middle of the wall, end of the wall into Your Plans (/dancers) and the footer (/djs). Every pill and the Organisers link 44px tall; one pill row at 390 and 430; no line at either seam (max colour step 1-3); scrollWidth 390; 0 clipped names; 0 page errors.
- Not verified: a physical phone (the one-row pill fit has 8px spare at 390), real photo crops (photo host blocked in the sandbox), landscape / desktop.

## Verified on real data
- Shapes surveyed: production reads through a production build: /dancers 94 tiles (50 photo faces, 44 initials), /djs 40, 1-3 role chips, flags, gig dates, 2-line names, a filter applied, Teachers coming soon (0 tiles).
- Checks run: table-driven tap-target test (pills / link / coming-soon buttons x both lists, red at 40px first); wording tests red first; seam measurement at 360/390/430 (exit 0); contrast test; every applicable CI job step run locally (table in the handover).
- NOT verified: physical phone, real photo crops, doc-weight / Lighthouse (need the preview), live-DB contract suites; 5 integrityCouldNotRun unit tests and e2e organiser-home.spec.ts:55 fail on clean main too.
```
