# Handover: W2-B person hub on /people/:id (branch `claude/w2b-hub`, ticket dt_b07bf3f93dc9)

Brief: `123constante/bachata-admin` branch `brief/search-v7-2026-10-20`, `briefs/W2B-hub-brief.md`
(blob 366100ccd683c2f99320f60615c9f9bc70873d69, read first). No PR opened (gh is not authed; the orchestrator opens it
from the body at the bottom). Nothing merged or approved.

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

## CI: every job step run in the sandbox (final code; `npm ci` / Playwright install skipped, deps present)
| Workflow / job | Command | Exit |
|---|---|---|
| architecture-guard | `bin/check-integrity.sh` (via `bash`; CI chmods first) | 0 |
| architecture-guard | `npm run check:legacy-tables` | 0 |
| architecture-guard | `npm run check:legacy-program-rpcs` | 0 |
| architecture-guard | `npm run lint:architecture` | 0 |
| architecture-guard | `AUDIT_STRICT=1 npm run check:images` | 0 |
| architecture-guard | `npm run check:image-widths:self-test && npm run check:image-widths` | 0 |
| architecture-guard | `npm run check:plan-hygiene:self-test` | 0 |
| architecture-guard | `npm run check:workflow-artifact-policy:self-test && ...policy` | 0 |
| architecture-guard | `npm run check:mojibake:self-test` + the mojibake `git grep` | 0 / 0 |
| architecture-guard | `npm run prove:entry-point:self-test && npm run prove:entry-point` | 0 |
| typecheck | `npm run check:rpc-typing` | 0 |
| typecheck | `npm run check:wallclock-brand` | 0 |
| (not a CI step) | `npm run typecheck` | 2: 100 errors on this branch AND 100 on `origin/main` (worktree compare), none in changed files |
| unit-tests | `npm run test:unit:offline` | 1: 12 014 tests, only `tests/integrityCouldNotRun.test.ts` red (5). Sandbox-only: `NODE_PATH` points at a global TypeScript; with `env -u NODE_PATH` that file passes (67 passed) |
| unit-tests | `npm run test:unit:timing` | 0 |
| unit-tests / dancer-area-isolation | `node scripts/check-dancer-area-isolation.mjs --self-test && npm run check:dancer-area-isolation` | 0 |
| perf-budget | `check:bundle-budget:self-test`, `check:first-load-requests:self-test`, `check:chunk-cycles:self-test` | 0 / 0 / 0 |
| perf-budget | `npm run build` (flag OFF) | 0 |
| perf-budget | `npm run check:bundle-budget` | 0 |
| perf-budget | `npm run check:first-load-requests` | 0 |
| perf-budget | `npm run check:chunk-cycles` | 0 |
| perf-budget (lighthouse job) | `npm run check:doc-weight` | 1: cannot run here ("previewProbe: GITHUB_REPOSITORY is not set"; it needs the Vercel preview) |
| lint chain | `npm run lint` (with `bin/*.sh` executable, as CI) | 0: 20 of 20 links green |
| e2e-smoke, phone-qa, seo-check, live-qa, prod-smoke | need a deploy or Playwright suites against a preview | NOT run |
| real-data-verified, phone-qa-section | PR-body checkers | body below carries both sections |

Production build with `VITE_ENABLE_PERSON_HUB=true VITE_ENABLE_PEOPLE_WALL=true`: exit 0, served by
`scripts/_serve-build.mjs` (SSR).

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

## Verified / Not verified
- **Verified:** flag OFF = old page (tests + production build view); flag ON hub renders under SSR in a production build
  with 0 hydration warnings and 0 page errors; one h1; no sideways scroll; no clipped text; tap targets >= 44px; text
  contrast >= 6.41; soft seams (max one-row step 1/255); card order and links; next-event button rules; 404 for zero
  visible roles; wall tiles never link to a 404 (after the fix); all CI job steps above.
- **NOT verified:** prod data shapes (no prod access, see above); real photo crops; a DJ with a real upcoming gig on a real
  event page; the wall -> hub tap with the real badges read (tests only); first-paint card reorder for a DJ+dancer with a gig
  (by reasoning only); a physical phone; keyboard focus ring in a real browser (asserted by class only); e2e/phone-qa/lighthouse
  suites that need a preview deploy; Vercel preview (VERCEL_TOKEN present but not exercised; no preview checked).

## Owner look-at list (3)
1. `docs/mockups/w2b-hub/fixture-three.png`: the hub for a 3-role DJ with a gig. Is "Back" (not "People wall") and no
   "HAPPENING NOW" label right?
2. Before flipping the flag: confirm on prod that every tile whose badge has a role also gets a hub (badges vs
   person-roles agree). One SELECT comparing the two functions' role lists for the wall's people would settle it.
3. Organiser card and a "level" fact need one more public read each; say if you want them (W2-C/W2-D or a new slice).

## Ready-to-paste PR body

```markdown
## What
Person hub on `/people/:id` behind `flags.personHub` (`VITE_ENABLE_PERSON_HUB=true`), default OFF. With the flag ON, a
wall tile opens the hub: face, name (stage name leads for a DJ), city, role chips, facts that exist, "Go to their next
event" only for a DJ with a gig, then one big card per role page in lead order. OFF = today's tabbed page and wall links,
unchanged. No new read, no RPC, no migration. Design record: `docs/design/w2b-hub.md`. Handover: `docs/handover/w2b-hub.md`.

## Phone QA
Sizes checked: 390x844 (production build flag ON and OFF, and the dev fixture harness), isMobile, DPR 2.
Walked: /people/:id for a sandbox-DB DJ and dancer (prod build, flag ON), teacher-only person (404, unchanged), flag-OFF page, /dancers wall tap; fixture shapes 3-role with gig, DJ with gig, no photo, broken photo, long name, thin (no facts, no city), teacher card hidden. scrollWidth 390, 0 clipped, taps >= 44px, min contrast 6.41, 0 hydration warnings.
Not verified: a physical phone, real photo crops (no reachable photos), the wall -> hub tap with the real badges read (sandbox lacks it; tests cover it), 360x640.

## Verified on real data
Shapes surveyed: sandbox Supabase project via public anon reads (137 active dancer rows: 127 no role, 4 DJ, 4 teacher-only, 2 dancer; 0 gigs; 31 no photo; 27 no city); orchestrator's 2026-10-21 prod counts (165 active, 110 photo, 18 flag, 14 languages) used for the fixture shapes.
Checks run: production build walks against the sandbox DB (DJ, dancer, teacher-only 404, flag OFF, wall tap); 31-test shape x screen matrix plus three mutants shown red; every CI job step from .github/workflows run locally (table in the handover).
NOT verified: prod data shapes directly (Supabase connector not authorised, no prod anon key in the sandbox); real photo crops; a real DJ gig on a real event page; whether get_public_people_badges_v1 and get_public_person_roles_v1 agree on prod.
```
