# Handover: W2-B person hub on /people/:id (PR #947, branch `claude/w2b-hub`; build ticket dt_b07bf3f93dc9, critique ticket dt_6a53cc3c9770)

Brief: `123constante/bachata-admin` branch `brief/search-v7-2026-10-20`, `briefs/W2B-hub-brief.md`
(blob 366100ccd683c2f99320f60615c9f9bc70873d69, read first). PR #947 was opened by the orchestrator from the body at the bottom (refreshed after stage 5).
Nothing merged or approved.

## W2-B fix pass: the hub reads the same chips as the wall (ticket dt_e347a0fee081, brief `briefs/W2B-fix-brief.md` blob 107560bf)

**Bug** (orchestrator, prod data, 390x844, flag ON): Vicky Franchi (dancer + teacher, teacher pages closed) reads
"Teacher, Dancer" on her wall tile and only "Dancer" on her hub. About 61 prod people (dancer+teacher 36,
dancer+DJ+teacher 25, DJ+teacher). Cause: `PersonSnapshot.roles` is the VISIBLE list (`derivePersonRoles` drops teacher
while closed) and `hub/model.ts` built the chips from it. Stage 5's critique item 6 assumed the chip showed; only the
harness fixtures (which passed `teacher` in `roles` with pages closed, a shape the loader never makes) did.

**Fix** (owner rule: the same fact reads the same on every screen; the wall decides):
- `src/modules/person-page/reads.ts`: new `PersonSnapshot.heldRoles` = the `get_public_person_roles_v1` answer before the
  closed-page filter (the loader already fetched it: no new read, no RPC, no migration; it travels in loader data, so SSR
  and hydration see the same value). Fallback path (function missing) = `roles`. Optional in the type: an older snapshot
  without it falls back to `roles`.
- `src/modules/person-page/hub/model.ts`: `tags` = `roleTagsFor` over the held roles. A closed Teacher is the same
  plain-text chip as the wall (href null). Cards, lead role, the cards heading (counts visible cards only: "Their page"
  for one), the 404 rule (zero VISIBLE roles) and every link stay on the visible roles.
- Harness (`harness-main.tsx.txt`) now feeds prod-shaped data: `roles` = visible, `heldRoles` = held.

**Tests** (`hub/__tests__/hubHeldRoles.test.tsx`, 14; `__tests__/reads.test.ts` +1 test, +1 assertion):
- Table, teacher pages closed AND open x {dancer, dancer+teacher, dancer+DJ+teacher with gig, DJ+teacher, DJ only}: hub
  chips === wall tile chips (role, label, order; model AND rendered), same lead; cards = visible roles; cards heading;
  closed = no Teacher card and no `/teachers` href anywhere on the page; open = Teacher chip AND card.
- Vicky's shape pinned: chips "Teacher, Dancer", teacher chip href null, one Dancer card.
- Teacher-only, closed: zero visible roles (404 unchanged), tile keeps `/dancers/<id>`. No `heldRoles` = old behaviour.
- Loader: `heldRoles` keeps the closed teacher from the same single roles call; fallback path `heldRoles` = `roles`.
- **Red first** against the unfixed code: 7 failed / 24 passed (the 3 closed multi-role shapes, Vicky, and the 3 loader
  cases). Fixed: green. **Mutant** (chips from `person.roles` again): 4 red (3 closed shapes + Vicky); restored: green.
- Only existing test touched: `hub.test.tsx` title "teacher pages closed: no teacher card, no teacher chip" renamed (its
  assertions only ever checked cards; its fixture has no `heldRoles`, so it still passes unchanged).
- Picture retaken and looked at: `docs/mockups/w2b-hub/fixture-teacherhidden.png` now shows chips "Teacher" + "Dancer",
  one Dancer card, heading "THEIR PAGE" (shot numbers: scrollWidth 390, 1 h1, 0 clipped, min contrast 7.43, 0 errors).
  The retake is byte-identical to stage 5's file, so git shows no change: stage 5's harness already put `teacher` in
  `roles` (the shape the loader never made), which is exactly why that picture showed the chip and prod did not. The
  harness now builds the prod shape (visible `roles`, held `heldRoles`) and the hub draws the same picture from it.

**CI job steps run in this sandbox on the fix head** (`npm ci` / Playwright install skipped, deps present; `NODE_PATH` unset):

| Workflow / job | Command | Exit |
|---|---|---|
| architecture-guard | `bin/check-integrity.sh` (after `chmod +x bin/*.sh`, reverted after) | 0 |
| architecture-guard | `check:legacy-tables`, `check:legacy-program-rpcs`, `lint:architecture` | 0 / 0 / 0 |
| architecture-guard | `AUDIT_STRICT=1 npm run check:images`; `check:image-widths:self-test` / `check:image-widths` | 0; 0 / 0 |
| architecture-guard | `check:plan-hygiene:self-test`, `check:workflow-artifact-policy:self-test` / `...policy` | 0, 0 / 0 |
| architecture-guard | `check:mojibake:self-test`; `prove:entry-point:self-test` / `prove:entry-point` | 0; 0 / 0 |
| typecheck | `check:rpc-typing`, `check:wallclock-brand` | 0 / 0 |
| unit-tests | `npm run test:unit:offline` | 0: 525 files, 12 024 passed, 18 skipped |
| unit-tests | `npm run test:unit:timing` | 0 |
| unit-tests / dancer-area-isolation | `--self-test` / `check:dancer-area-isolation` | 0 / 0 |
| perf-budget | `check:bundle-budget:self-test`, `check:first-load-requests:self-test`, `check:chunk-cycles:self-test` | 0 / 0 / 0 |
| perf-budget | `npm run build` (flag OFF, as CI); `check:bundle-budget` / `check:first-load-requests` / `check:chunk-cycles` | 0; 0 / 0 / 0 |
| lint chain | `npm run lint` | 0 |
| (local) | `npm run check:integrity` | 0 |
| (not a CI step) | whole-tree `npm run typecheck` | 2, red on the unfixed head too (about 100 pre-existing errors elsewhere); none in the files this pass changed |
| perf-budget lighthouse, e2e-smoke, phone-qa, seo-check, live-qa, prod-smoke | need a deploy / preview | NOT run |
| real-data-verified, phone-qa-section | PR-body checkers on the body below (`PR_BODY` env) | see the final report |

**Verified (this pass):** hub chips equal the wall tile's for every listed shape, teacher pages closed and open (model
and rendered DOM); no Teacher card and no teacher link while closed; Teacher chip and card while open; 404 rule and tile
links unchanged; loader carries held roles from the same single call; red first, mutant red; the retaken harness picture.
**NOT verified (this pass):** Vicky Franchi's real hub on prod or a preview (no prod DB access here: the Supabase
connector is not authorised in this session, and the preview needs the flag ON); the prod shape counts are the
orchestrator's survey, not re-run; a physical phone.


## Stage 5: independent critique + one fix pass (ticket dt_6a53cc3c9770, a different worker from the builder)
Brief: `briefs/W2B-critique-brief.md` on the same admin branch (blob 09f15b0b2db56e53a758255bb654dd5421c419f6).
Critique (written before any edit): [`docs/design/w2b-hub-critique.md`](../design/w2b-hub-critique.md), 13 findings,
each with severity and verdict. No blocker; 4 "should", all fixed here; the rest "nice" (not a bug, or an owner call).

**What changed, in plain words**
1. **Cards no longer swap places when the visitor came from the wall.** Before, a DJ with a gig (and another role)
   first showed the Dancer card on top; ~1 s later the DJ card jumped above it and the gold button pushed everything
   down (dancer card moved 153 px), so a quick tap could open the wrong page. Now the hub reuses the wall's own answer
   (the badges read the wall already made, still in memory; no new request) to put the cards in their final order and
   keep the button's place on first paint. Until the event id arrives (under a second) the button is the same gold
   box, not yet a link. Measured: layout shift 0.021 -> 0 (from the wall). A direct load (search, shared link) still
   moves: owner call O1.
2. **"What Bachata does" is gone.** A person with no public real name and 2+ cards got the placeholder name split
   into the cards heading. Now: "What they do".
3. **The flag sticker no longer covers the face.** It is sized from half the face, as the S12 mock (26 px wide instead
   of 52 px); 0 overlap with the initials at 360 / 390 / 430.
4. **One-card pages keep the warm base to the bottom of the first screen** instead of ending under the card in a cold
   empty block above the footer.

**Files (stage 5):** `hub/model.ts` (`wallBadge` input, pending gig, "What they do"), `hub/PersonHub.tsx`
(`wallBadgeOf`, ground min height), `hub/NextEventButton.tsx` (not-yet-a-link box), `hub/HubFace.tsx` (sticker size),
`wall/tokens.ts` (`HUB.flagFrom`, `HUB.groundMinHeight`), `hub/__tests__/hubCritique.test.tsx` (new, 14 tests),
`docs/design/w2b-hub-critique.md` (new), `docs/design/w2b-hub.md` (numbers), this file, retaken pictures in
`docs/mockups/w2b-hub/` (+ `fixture-noname.png`, `fixture-djdancer-fromwall.png`, `cls.mjs`, harness copies as `.txt`).
**Reads:** none added. `wallBadgeOf` only looks in the query cache (`['people-badges', ...]`); it never fetches. On a
direct SSR load neither server nor client has it, so the first client render still matches the server.

**Red first:** `hubCritique.test.tsx` was run against the unfixed code: 6 of 13 red (3 card-order rows, the heading,
the sticker width "expected 52 to be <= 28", the ground height); all green after the fix. Self-review of the fix then
found that a FAILED gig-list read would leave the gold box on screen forever, not a link: one more row (failed read ->
no box), seen red, then fixed (a failed read counts as "no gigs"). 14 of 14 green, with the 31 builder tests and the
rest of `src/modules/person-page` (476 tests) unchanged and green.

**Owner calls (recommendation each; no code):**
- **O1. Direct loads still reorder** (DJ with a gig + another role, opened from search or a link). Recommend adding the
  next gig date to the `/people` loader (one call of the badges read for this id = a new read on this page, so not
  done). No-read alternative: always DJ card first for a DJ-led person (header already leads with the stage name); that
  changes the approved "dancer before a DJ without gigs" order.
- **O2. Chip order vs card order** (chips Teacher, DJ, Dancer like the wall; cards in lead order) and the "Teacher" chip
  with no Teacher card while teacher pages are closed (61 prod people). Recommend leave as is until teacher pages open.
- **O3. One-card hub** (the commonest prod shape). Recommend keep; later make the single card a bigger "Open <name>'s
  dancer page" button. Not removed.

## Before / after, in plain words
- **Before:** tapping a face on the wall opened that person's DJ or dancer page. `/people/:id` was a page with tabs
  (Teaching / DJ / Dancing) holding the old role pages.
- **After, with the flag ON:** tapping a face opens `/people/:id`, now a **person hub**: a Back button, a big square
  face (initials in the role colour if there is no photo or the photo fails to load), the name (the stage name leads for
  a DJ, with the real name under it; anyone else shows the real name, with "DJ <stage name>" under it when they have one),
  the city, the role chips, the facts that exist (years dancing, languages), a "Go to their next event" button only for a
  DJ with a gig coming up, and then one big card per role page (DJ with a gig first, then dancer, then DJ without a gig,
  then teacher). Each card is one link to that role's own page.
- **With the flag OFF (the default):** nothing changes. `/people/:id` is the tabbed page and wall tiles link exactly as before.

## Flag
`flags.personHub` in `src/lib/featureFlags.ts`, read from `VITE_ENABLE_PERSON_HUB`. Turn on: set
`VITE_ENABLE_PERSON_HUB=true` in the Vercel env and redeploy (build-time, like the other flags). Unset or any other value = OFF.
The wall itself still needs `VITE_ENABLE_PEOPLE_WALL=true` for tiles to exist at all.

## Files
- `src/lib/featureFlags.ts`: new flag `personHub`.
- `src/modules/person-page/PersonPage.tsx`: the default export picks `PersonHub` (flag ON) or the unchanged tabbed page
  (renamed internally to `TabbedPersonPage`, body untouched).
- `src/modules/person-page/hub/`: `model.ts` (pure rules), `PersonHub.tsx` (page), `HubFace.tsx`, `FactsStrip.tsx`,
  `RoleCard.tsx`, `NextEventButton.tsx`, `__tests__/hub.test.tsx`.
- `src/modules/person-page/wall/model.ts`: `tileHref` (tiles open the hub when the flag is ON and the person has a role
  with an open page); `bareStage` exported for the hub's "DJ <stage name>" line.
- `src/modules/person-page/wall/tokens.ts`: `HUB` sizes added to the ONE tokens file (no new colours).
- `docs/design/w2b-hub.md` (design record), `docs/mockups/w2b-hub/` (screenshots, `shot.mjs`, `seam.mjs`, `report.json`,
  `harness-main.tsx.txt` + `harness-vite.mjs.txt`: the dev harness used for fixture shapes, kept as text so no checker picks it up).

## Reads (none added)
- No new read, no new RPC, no database change. The loader is unchanged.
- The hub reads the loader's cached dancer row (`['dancer-profile', id]`) and DJ row (`['dj-profile', id]`), both already
  dehydrated by the `/people` loader, and the DJ page's own gig timeline (`get_profile_event_timeline_v2` via
  `useProfileProgramAppearances('dj', id, 1000)`, the same query key DJProfile uses), fetched after mount exactly like
  DJProfile so the server and first client render match.
- **Not built, and why (STOP items):**
  - **Organiser card:** no existing public read on this page says "this person runs an organiser page". Adding it needs a
    new read (or an organiser id on an existing one). Not added.
  - **Level fact:** no public read carries a dancer's own level (`partner_search_level` is the level of partner they look
    for, not theirs). Not shown. Facts are years dancing (dancer row) and languages (DJ row) only.
  - **Next-event order on first paint:** the gig list is fetched after mount (hydration rule above), so a DJ+dancer with a
    gig first renders the dancer card first, then the DJ card moves to the top when the timeline arrives. Avoiding that move
    needs the gig date in the loader, which means a new read in the loader. Not done.

## Bug found and fixed during the walk (red first)
With the flag ON, the first `/dancers` tile in the walk (a person with no public roles) linked to `/people/<id>`, and that
URL is a 404 (the hub needs at least one visible role; every active dancer row is on `/dancers` whether or not it has a
role). Seen red in the production build walk (tile -> `/people/...` -> 404). Fix: `tileHref` sends a tile to the hub only when
the badges read says the person has a role whose page is open; otherwise the tile keeps today's role-page link. Re-walked:
the tile opens `/dancers/unclaimed-eeee0000-1` (the dancer page), no 404. Test: `wall tiles: flag ON -> /people/<id> only
with a visible role` in `hub.test.tsx`.
**Residual risk:** the badges read (`get_public_people_badges_v1`) and the hub's roles read (`get_public_person_roles_v1`)
are different functions. If they ever disagree on prod, a tile could still lead to a 404. Owner look-at item 2.

## Prod shapes
**Not surveyed on prod.** The Supabase connector needs authorisation in this session, and the sandbox has no prod anon key
(the sandbox's `VITE_SUPABASE_*` point at a different project, `srrp...`; the prod URL rejects that key). I did not use the
service-role key. Orchestrator's 2026-10-21 prod survey (not re-checked): 165 active dancer profiles, 110 with photo, 55
without, 18 with flag, 14 with languages.
What the sandbox project has (public anon reads, counts only): 137 active dancer rows; roles (`get_public_person_roles_v1`):
127 none, 4 DJ only, 4 teacher only, 2 dancer only, 0 with 2+ roles; 4 DJs, 0 with an upcoming gig, 0 with languages;
31 without photo; 27 without city; `get_public_people_badges_v1` does not exist there (404). It is seed data, not prod-shaped,
so the multi-role, gig, flag, facts and long-name shapes were walked through the dev harness with prod-SHAPED fixtures.

## CI: every job step run in the sandbox (stage 5 head; `npm ci` / Playwright install skipped, deps present)
| Workflow / job | Command | Exit |
|---|---|---|
| architecture-guard | `bin/check-integrity.sh` (after `chmod +x bin/*.sh`, as CI) | 0 |
| architecture-guard | `npm run check:legacy-tables` | 0 |
| architecture-guard | `npm run check:legacy-program-rpcs` | 0 |
| architecture-guard | `npm run lint:architecture` | 0 |
| architecture-guard | `AUDIT_STRICT=1 npm run check:images` | 0 |
| architecture-guard | `npm run check:image-widths:self-test` / `npm run check:image-widths` | 0 / 0 |
| architecture-guard | `npm run check:plan-hygiene:self-test` | 0 |
| architecture-guard | `npm run check:workflow-artifact-policy:self-test` / `...policy` | 0 / 0 |
| architecture-guard | `npm run check:mojibake:self-test` + the mojibake `git grep` (no hits) | 0 / 0 |
| architecture-guard | `npm run prove:entry-point:self-test` / `npm run prove:entry-point` | 0 / 0 |
| typecheck | `npm run check:rpc-typing` | 0 |
| typecheck | `npm run check:wallclock-brand` | 0 |
| unit-tests | `npm run test:unit:offline` (with `NODE_PATH` unset: the sandbox points it at a global TypeScript, see the builder's note) | 0: 524 files, 12 010 passed, 18 skipped (re-run on the final code) |
| unit-tests | `npm run test:unit:timing` | 0: 65 passed |
| unit-tests / dancer-area-isolation | `node scripts/check-dancer-area-isolation.mjs --self-test` / `npm run check:dancer-area-isolation` | 0 / 0 |
| perf-budget | `check:bundle-budget:self-test`, `check:first-load-requests:self-test`, `check:chunk-cycles:self-test` | 0 / 0 / 0 |
| perf-budget | `npm run build` (flag OFF, as CI) | 0 |
| perf-budget | `npm run check:bundle-budget` / `check:first-load-requests` / `check:chunk-cycles` | 0 / 0 / 0 |
| perf-budget (lighthouse job) | `check:lighthouse`, `check:doc-weight` | NOT run (need the Vercel preview) |
| lint chain | `npm run lint` | 0: 20 of 20 links green (the trailing whole-tree `eslint .` is informational, red on main too) |
| e2e-smoke, phone-qa, seo-check, live-qa, prod-smoke | need a deploy or Playwright suites against a preview | NOT run |
| real-data-verified, phone-qa-section | PR-body checkers | body below run through both scripts (`PR_BODY` env): 0 / 0 |

Also: production build with `VITE_ENABLE_PERSON_HUB=true VITE_ENABLE_PEOPLE_WALL=true` exit 0, served by
`scripts/_serve-build.mjs` (SSR) for the walk.

## Tests (`src/modules/person-page/hub/__tests__/hub.test.tsx`, 31 tests)
- Shape table (rendered, flag ON): DJ with gig, DJ no gig, dancer only, DJ+dancer with and without gig, 3-role with gig,
  teacher+dancer, DJ without stage name, long name: one h1, heading and name line, card order, every card's href, the
  next-event button only with a gig (to `/event/<soonest>`), no "next event" text without it.
- Teacher pages closed: no teacher card, never a dead link. No photo, broken photo, no name, no city, no facts (strip
  absent), facts only when they exist, flag sticker only with a nationality.
- Same fact, same reading (hub vs wall tile vs role pages): chips and order (`roleTagsFor`), lead, flag code, link
  target, name, city.
- Flag: defaults OFF (fresh import), OFF = tabs and no hub, ON = hub and no tabs. Wall `tileHref` ON/OFF/no page/no role.
- Existing PersonPage, alsoBar, embedded, wall and page suites: unchanged and green.
- **Mutants (each shown red, then restored):** lead order broken in `leadRole` (DJ always first): 3 tests red; broken-image
  fallback dropped (`onError` no-op): 1 red; facts strip shown when empty: 1 red.

## Walk (390x844)
Screenshots in `docs/mockups/w2b-hub/`; numbers in `report.json` and `docs/design/w2b-hub.md`.
- Production build, flag ON, sandbox DB reads: `on-dj-real.png` (DJ, no name, no photo: placeholder heading, "?"-style
  initials fixed after this shot to "?"), `on-dancer-real.png`, teacher-only person = 404 (unchanged),
  `on-wall-tap-before.png` / `on-wall-tap.png` (wall -> tap -> the dancer page, because the sandbox has no badges read; on
  prod the same tap opens the hub, covered by tests, NOT walked).
- Production build, flag OFF: `off-flag-off-dj.png` (the tabbed page, no hub).
- Dev harness, prod-shaped fixtures: `fixture-three.png` (3 roles), `fixture-djgig.png`, `fixture-nophoto.png`,
  `fixture-long.png`, `fixture-thin.png`, `fixture-teacherhidden.png`, `fixture-brokenphoto.png`.
- Media host: no real photo was reachable in any view (the sandbox people have none; fixtures use no photo or a broken URL).
  **Real photo crops are NOT verified.**

- **Stage 5 tests** (`hubCritique.test.tsx`, 14): from-the-wall card order on first paint = final order (DJ+dancer with
  gig, 3-role with gig, DJ+dancer without gig, DJ only with gig), the pending button is not a link and says the same
  words, a past wall date is ignored, no wall answer = unchanged, the timeline wins over the wall answer; cards heading
  for no-name / named x 1 / 2+ cards; a failed gig-list read drops the box; sticker width <= 28; ground min height uses `svh`. **Mutant:** `wallBadgeOf` replaced by `null` in `PersonHub` -> 3 of the from-the-wall rows red; restored -> green.
  Changed-file eslint: 1 error (`set-state-in-effect` on the builder's `mounted` line, same as before this pass) and one
  new warning of the kind already there (`wallBadgeOf` exported beside the component, like `goBackTarget`).
- **Stage 5 walk** (retaken, every picture looked at): production build flag ON `on-dj-real`, `on-dancer-real`,
  `on-teacher-only-real` (404, unchanged), `on-wall-tap` (sandbox: tile -> dancer page, as before); flag OFF
  `off-flag-off-dj` (same numbers as the builder's: no hub, contrast 9.14); harness fixtures `fixture-three`, `-djgig`,
  `-nophoto`, `-long`, `-thin`, `-teacherhidden` (now with the "Teacher" chip and no Teacher card, the prod shape),
  `-brokenphoto`, new `-noname` and `-djdancer-fromwall`. Also 360 and 430 wide for `three` and `long` (scratch, numbers
  in the design record). Seams: inside the hub max one-row step 1/255; the only hard edges are the site nav's gold rule
  and the orange footer, site-wide.

## Verified / Not verified (after stage 5)
- **Verified:** flag OFF = old page (tests + production build view, same numbers as before); flag ON hub under SSR in a
  production build with 0 hydration warnings and 0 page errors; one h1; scrollWidth = viewport at 360 / 390 / 430; no
  clipped text; tap targets >= 44 px; text contrast >= 6.41; seams inside the hub max step 1/255; card order and links;
  from the wall: 0 card movement and layout shift 0 while the gig list loads (harness, timeline 800 ms late); flag
  sticker 0 overlap with the initials; no "What Bachata does"; warm ground to the bottom of the first screen on one-card
  pages; every CI job step in the table above.
- **NOT verified:** prod data directly (the Supabase connector is not authorised in this session; prod role counts are
  the orchestrator's 2026-10-22 survey); the wall -> hub tap with the real badges read (the sandbox project has no
  `get_public_people_badges_v1`, so the from-the-wall path is verified in the harness and unit tests only); the shape of
  the badges cache on prod (assumed the `Map` that `usePeopleBadges` builds, as in the code); direct-load reorder (still
  moves, owner call O1); real photo crops (no reachable photo; the smaller sticker on a real photo is not seen); a real
  gig on a real event page; a physical phone; keyboard focus ring in a real browser; e2e / phone-qa / lighthouse suites
  and the Vercel preview (not checked here).

## Owner look-at list (3)
1. `docs/mockups/w2b-hub/fixture-teacherhidden.png` (the commonest prod shape: dancer + closed teacher page): one card,
   a "Teacher" chip with no Teacher card, now the SAME chips as the wall tile (W2-B fix; before it, prod showed only
   "Dancer" on the hub). Keep as is (O2, O3)?
2. O1: direct loads of a DJ with a gig still reorder the cards. Add the next gig date to the `/people` loader (new
   read), or always put the DJ card first for a DJ-led person (changes the approved order), or leave it?
3. Before flipping the flag: one SELECT comparing `get_public_people_badges_v1` and `get_public_person_roles_v1` for the
   wall's people (the orchestrator's survey says they agree on all 161 people with a role; re-check right before the flip).

## Ready-to-paste PR body

```markdown
## What
Person hub on `/people/:id` behind `flags.personHub` (`VITE_ENABLE_PERSON_HUB=true`), default OFF. With the flag ON, a
wall tile opens the hub: face, name (stage name leads for a DJ), city, role chips, facts that exist, "Go to their next
event" only for a DJ with a gig, then one big card per role page in lead order. OFF = today's tabbed page and wall links,
unchanged. No new read, no RPC, no migration. Design record: `docs/design/w2b-hub.md`. Critique (Design Gate stage 5):
`docs/design/w2b-hub-critique.md`. Handover: `docs/handover/w2b-hub.md`.

Stage 5 fixes (independent reviewer): cards no longer swap places after first paint when the visitor came from the wall
(reuses the wall's badges answer already in memory; layout shift 0.021 -> 0); "What they do" instead of "What Bachata
does" for a person with no real name; flag sticker sized like the S12 mock (no longer covers the face); one-card pages
keep the warm base to the bottom of the first screen.

W2-B fix: the hub's role chips now read the same as the wall tile's (owner rule: the wall decides). While teacher pages
are closed a person who teaches (about 61 on prod, e.g. dancer + teacher) shows a plain-text "Teacher" chip on both,
with still no Teacher card and no teacher link. The loader carries the roles the person holds from the roles read it
already makes (`PersonSnapshot.heldRoles`); no new read.

## Phone QA
Sizes checked: 390x844 (production build flag ON and OFF, and the fixture harness), 360x844 and 430x844 (harness: 3-role and long name), isMobile, DPR 2.
Walked: /people/:id for a sandbox-DB DJ and dancer (prod build, flag ON), teacher-only person (404, unchanged), flag-OFF page, /dancers wall tap; fixture shapes 3-role with gig, DJ with gig, DJ + dancer arriving from the wall with the gig list 800 ms late, no real name, no photo, broken photo, long name, thin, dancer + closed teacher page (retaken after the W2-B fix with prod-shaped visible/held roles: chips "Teacher" + "Dancer", one Dancer card). scrollWidth = viewport, 0 clipped, taps >= 44px, min contrast 6.41, 0 hydration warnings, hub seams max step 1/255.
Not verified: a physical phone, real photo crops (no reachable photos), the wall -> hub tap with the real badges read (sandbox lacks it; harness and tests cover it), card reorder on a direct load (still moves; owner call).

## Verified on real data
Shapes surveyed: orchestrator's 2026-10-22 prod survey (166 active dancers: teacher-only 62, dancer+teacher 36, dancer+DJ+teacher 25, dancer-only 23, dancer+DJ 10, DJ-only 4, DJ+teacher 1, no role 5; teacher pages closed), used to pick the walked shapes (dancer-only, dancer + hidden teacher, DJ + dancer); sandbox Supabase project via public anon reads for the production-build walks.
Checks run: W2-B fix table (dancer, dancer+teacher, dancer+DJ+teacher with gig, DJ+teacher, DJ only, teacher-only; teacher pages closed and open): hub chips === wall tile chips, no Teacher card or teacher link while closed, run red against the unfixed code first (7 red) and against a mutant (4 red); production build walks (DJ, dancer, teacher-only 404, flag OFF, wall tap); 31 + 14 test shape x screen matrix, stage 5 tests run red against the unfixed code first; every CI job step from .github/workflows run locally (table in the handover).
NOT verified: prod data directly (Supabase connector not authorised in these sessions), including Vicky Franchi's real hub after the fix; real photo crops; a real DJ gig on a real event page; the from-the-wall path against the real badges read (harness and unit tests only).
```
