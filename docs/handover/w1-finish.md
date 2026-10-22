# W1 finish pass: handover (PR #893, branch `claude/w1-people-surfaces`)

Finish pass brief: `briefs/W1-finish-brief.md` @ `158fe99`; split pass brief: `briefs/W1-split-brief.md`
(blob `7a3aa28`), both on branch `brief/search-v7-2026-10-20`.
Review worked from: `docs/reviews/w1-people-surfaces-review.md` on `claude/w1-review`.
Tickets: finish pass dt_b42abe7dcec8 (base `1f00b24`, head `be098eb`); split pass dt_af7c9127b69d (base `be098eb`).

**`gh` is not authenticated in this sandbox**, so the PR #893 body could NOT be replaced.
**The PR body to paste is the section "PR body (paste into #893)" below** (replaced by the split pass).

## Split pass (dt_af7c9127b69d, 2026-10-21)

Orchestrator decision (option B + one seam), applied as briefed.

### What moved
1. **`src/modules/dancer-app/` is byte-identical to `origin/main`.** The 7 W1 files there were restored to
   main (`git restore --source=origin/main`): `public-page/PublicDancerPageV2.tsx`, `loadPublicPage.ts`,
   `model.ts`, and `__tests__/{embeddedPassThrough.test.tsx,model.test.ts,page.test.tsx,route.test.ts}`.
   `git diff origin/main -- src/modules/dancer-app` is empty, so #893 is no longer a dancer-area PR (rule c only).
2. **Behaviour this removes from #893** (it moves to the follow-up PR):
   - **7f "New this year"** (`model.ts` facts.dancing). Main shows "0 years" for a current-year start.
   - **C9 `extrasOk` removal** (`model.ts` type, `loadPublicPage.ts`, `PublicDancerPageV2` prop, tests).
     Main's `extrasOk` stays and `DancerProfile` passes it again.
   - **S2 in `PublicDancerPageV2.tsx`:** (a) the `showRoleLabel` prop, which hid the DANCER label on the
     thin `/dancers/:id` page for a person who does not hold the Dancer role (wired from `DancerProfile` via
     `usePeopleBadges`); (b) the "Favourite songs" card section; (c) removal of the "No public contacts yet.
     Use Share..." line (main shows it again).
3. **Seam:** `src/pages/DJProfile.tsx` added to `seams` in `scripts/dancer-area-isolation-allowlist.json`
   with the briefed `seamNotes` text. No other seam; the check script is untouched.
4. **Merge of `origin/main` (`fb91b8a`, #870 + #885).** #893 conflicted with main in
   `src/components/layout/GlobalLayout.tsx` (D84 plain background vs W1 page grounds), so the PR's
   `pull_request` workflows could not queue. Resolved: plain-background routes (`/invite*`,
   `/admin/organisers*`) win, then the W1 ground, then velvet/brass/organiser. Main's
   `plainBackground.test.tsx` reads `data-testid="layout-bg"`, and `'default'` is now a W1 ground, so the
   ground div carries `data-testid="layout-bg" data-bg="ground"` (was `page-ground`);
   `GlobalLayout.grounds.test.tsx` selectors updated. Layout tests 21/21.

### Follow-up record (dancer page PR, to be re-applied from `be098eb`)
Files I changed OUTSIDE `src/modules/dancer-app/` to make #893 build against main's dancer-app:
| path | what I reverted | why | re-apply? |
|---|---|---|---|
| `src/pages/DancerProfile.tsx` | 3 hunks: the `usePeopleBadges` import; the `roleBadges`/`holdsDancerRole` block; `showRoleLabel={holdsDancerRole}` removed and `extrasOk={publicPage.extrasOk}` restored on `<PublicDancerPageV2>`. Kept: `gradientPalette="dancer"`, `AlsoRoles className="pb-2"` | main's V2 has no `showRoleLabel` and requires `extrasOk` | **yes** (seam file; main has not touched it since, so `git checkout be098eb --` is exact) |
| `app/routes/people.loader.test.ts` | fixture back to `{ extras: {}, extrasOk: true }` | matches main's `PublicPageV2Data` | **no**: the mock is passed through untouched, so the test passes either way; re-applying it is a non-seam, non-`tests/` file and turns rule (a) red (proved below) |
| `scripts/dancer-area-isolation-allowlist.json` | (added DJProfile seam) | brief step 3 | nothing to re-apply |

Re-application for the follow-up worker, on top of #893's head:
`git checkout be098eb -- src/modules/dancer-app src/pages/DancerProfile.tsx`

**Proof** (scratch worktree at code head `a1a2276`, not pushed):
- with `app/routes/people.loader.test.ts` also re-applied: `DANCER_ISOLATION_BASE=a1a2276 node scripts/check-dancer-area-isolation.mjs`
  = exit 1, 1 violation: rule (a) on `app/routes/people.loader.test.ts`.
- with the command above (8 files): exit 0, "dancer-area PR: rules a+b+c ... OK".
- vitest `src/modules/dancer-app/public-page app/routes src/pages/__tests__ src/modules/person-page tests/searchV7People.test.tsx`:
  1197/1198 in the batch; the 1 failure (DancerFirstGate.matrix returnTo row) passes alone 114/114 (load flake).
- `npm run typecheck`: 99 errors, the identical set to #893's head and to main.

### Red-first
- At `be098eb`: `node scripts/check-dancer-area-isolation.mjs` exit **1**, "dancer-area PR: rules a+b+c",
  105 violations (base merge-base `0ab0ff9`; the finish pass reported 93 on its working tree), the
  last being rule (c) on `src/pages/DJProfile.tsx`.
- At this head: exit **0**, "not a dancer-area PR: rule c only ... OK" (base merge-base `fb91b8a` after the merge).

### Status
See "Gates" in the PR body below. Everything the sandbox can run is green or fails identically on main.

## PR body (paste into #893)

> **Do not merge.**
>
> ### What changed (finish pass, on top of S0-S4)
> - **/dancers**
>   - If the badges read fails, or succeeds but comes back empty, the list now shows every row without labels. It never says "No dancers yet" (C1).
>   - A failed background refetch while badges are cached keeps the filter.
>   - Tile tags are separated in the accessible name: "Name, Teacher, DJ" (M7).
>   - The dead hand-written hrefs are removed.
>   - The label row wraps instead of clipping.
>   - The flag sticker is 48px; the phone spec row is updated.
> - **/djs**
>   - Tiles with three tags no longer clip their labels: they wrap to two lines inside the 26px minimum height. Phone QA had found 25 of 40 tiles cut.
>   - New page-level order test.
>   - Hero vinyl: the initials sit in a still overlay outside the spinning disc, and the spindle dot is gone (7a).
> - **DJ page**
>   - The BreadcrumbList JSON-LD is restored while the subheader is hidden (C3).
>   - A manual share shows the URL as selectable text (C4).
>   - Instagram is taken from the website field only when the link names a handle (not the home page, explore, p, reel, reels, stories or tv). `m.instagram.com` is recognised (C5).
>   - The loading and error states paint the DJ ground (C8).
>   - An eslint-disable comment naming a non-existent rule is removed.
> - **Badges mapping (`badges.ts`)**
>   - The DJ tag label drops a leading `DJ ` from the stage name: "DJ · El Rugido" (7b).
>   - `usePeopleBadges` returns `isError`.
>   - New `linkRoleFor` holds the DJ > dancer > teacher order in one place.
> - **Header overlay and `/search`**
>   - Both use one shared function, `searchPersonView`, so they give the same link (role pages via `linkFor`) and the same tags (Teacher shown plain while closed) (M1/7c).
>   - A person with no page links to a search for their name, city-scoped when the overlay is.
>   - The searchPerson chunk loads in parallel with the RPC and is only awaited when the results contain people. If it fails, people rows degrade to search links, the failure is reported once, other result kinds are unaffected, and the page is never reloaded.
>   - The dead `personSearchRow` is removed.
> - **Organiser team strip**
>   - Members show their real name; the stage name appears only in the DJ tag (M2).
>   - The organiser-authored title shows when set (7d). It stays hidden while the badges load, and when it is blank, repeats a tag word, or is "Leader" (see Owner below).
>   - While the badges load or on error, a member's link falls back to `/dancers/:id`.
>   - A click calls `emitProfileView`.
> - **Event lineup**
>   - If the badges read fails, ScheduleBlock keeps the feed's DJ/dancer link and never gives a teacher a link (C6). There is a component test, and the `people: s.people` mutant now fails it.
>   - EventScheduleGrid takes its role words from `ROLE_LABEL` (M5).
>   - PersonChip telemetry and `data-profile-type` follow the role of the page the link opens. The route prefixes are derived from `hrefFor` (C7).
> - **Layout:** an embedded GlobalLayout no longer paints `<html>`/`<body>` (C2).
> - **Thin dancer page wrapper (`DancerProfile.tsx`, outside the dancer-app module):** the dancer ground and the AlsoRoles spacing only. Nothing under `src/modules/dancer-app/` changes in this PR.
> - **Isolation seam:** `src/pages/DJProfile.tsx` is a named seam (orchestrator 2026-10-21): it reuses the public dancer page's share helper (`SHARE_MESSAGES`, `shareDancerPage`) instead of a second copy.
> - **Merged `origin/main` `fb91b8a`:** GlobalLayout keeps D84's plain background on `/invite*` and `/admin/organisers*`; every other route gets the W1 ground.
> - **Fixtures:** the nameless Dancer row is restored in `directoryAttendance`, and `badges` is declared in `vi.hoisted`.
> - **Bundle:** the `/event` chunk ratchet regression (44 > 43, caused by W1 S3) is fixed by a `lib-people` first-party group in `vite.chunks.ts`, plus single-module pins for `client.ts` and `searchEntities.ts`. No allowance was raised.
>
> ### Orchestrator decisions applied
> - 7b: YES. A leading `/^dj\s+/i` is stripped in the DJ tag label only.
> - 7d: YES. The authored title shows, with no 'Team' default.
> - 7e: KEEP. No genre chips on the /djs tiles.
> - 7f: YES, but it ships in the follow-up dancer page PR, not here.
> - Isolation: option B (split) + the one DJProfile seam.
>
> ### Follow-up PR (dancer page)
> These W1 changes were split out so that #893 changes nothing under `src/modules/dancer-app/`. Another worker re-applies them from `be098eb` as their own dancer-area PR (`git checkout be098eb -- src/modules/dancer-app src/pages/DancerProfile.tsx`; proof in `docs/handover/w1-finish.md`, "Split pass"):
> - 7f: a current-year start shows "New this year", never "0 years".
> - C9: the dead `extrasOk` prop, field and no-op test are removed.
> - S2: the thin page hides the DANCER label for someone who does not hold the Dancer role; a "Favourite songs" card; no "No public contacts yet" line.
>
> Until it lands, the live dancer page keeps main's behaviour for those items.
> - 7a: item 19 is done.
>
> ### Gates (split pass, local, final code head `a1a2276`; compared to origin/main `fb91b8a`)
> | Job / step | Command | Exit | Note |
> |---|---|---|---|
> | **dancer-area-isolation** | `npm run check:dancer-area-isolation` (+ `--self-test`) | **0** (was 1 at `be098eb`) / 0 | "not a dancer-area PR: rule c only ... OK" |
> | lint chain | `npm run lint` | 19/20 links PASS; check:integrity 126 (main 126) | Same on main: the script is mode 644 in git and CI chmods it first. `bash bin/check-integrity.sh` = 0 |
> | eslint on the files this pass touched | `npx eslint` DancerProfile, GlobalLayout, grounds test, people.loader.test | 4 errors / main 4 | No increase |
> | architecture-guard steps | PyYAML, integrity, legacy-tables, legacy-program-rpcs, lint:architecture, `AUDIT_STRICT=1 check:images`, image-widths, plan-hygiene self-test, artifact-policy, mojibake canary + grep, prove:entry-point | all 0 | |
> | typecheck job | check:rpc-typing, check:wallclock-brand | 0 | |
> | typecheck (not in CI) | `npm run typecheck` | 2 / 2 | 99 errors, the identical set on main |
> | unit (London, offline as on a PR) | `CI=1 TZ=Europe/London npm run test:unit:offline` | 1 | 10796 passed, 6 failed: all `integrityCouldNotRun` (sandbox PATH); the same 5 fail when that file runs alone on main and on the branch |
> | unit (London, full incl. contract) | `CI=1 npx vitest run` | 1 | run BEFORE the layout test-id fix: env failures above + 10 `*.contract.test.*` (sandbox .env key) + 5 `plainBackground` rows; those 5 are fixed (the offline run above came after the fix) |
> | unit New_York / Sydney / timing | 9-file list, test:unit:timing | 0 / 0 / 0 | |
> | live gate | `node scripts/ci-live-db-gate.mjs` | 0 | |
> | e2e-smoke | `npm run test:e2e` | 1 | 153 passed, 5 flaky, 2 failed under load (organiser-home:55, organiser-layout:171). Re-run alone with `--retries=0`: both specs 18/18 pass on the branch. Neither touches W1 files |
> | **phone-qa (FULL suite)** | `npx playwright test --config playwright.phone.config.ts` | **0** | 272 passed, 74 skipped, 0 failed, 0 flaky |
> | build-smoke | fake-Supabase build + `playwright.build.config.ts` | 0 | 66 passed |
> | perf-budget | 3 self-tests, `npm run build` (perf env), check:bundle-budget, first-load-requests, chunk-cycles | all 0 | event 380.1 KB / 43 files (budget 381) |
> | workflow-lint | docs-only self-test, workflow-masking, workflow-notification, no-preview-prefixes | all 0 | |
> | build | `npm run build` | 0 | |
> | NOT RUN | live db-contract checks, types-drift, Lighthouse/preview jobs, real phone, `npm run pre-ship` | - | prod secrets, `SUPABASE_ACCESS_TOKEN`, a Vercel preview or hardware are not available; the `.githooks` are not executable in this checkout |
>
> ## Phone QA
> The production build ran with prod's public anon key, served by the react-router server build (`node --conditions=production scripts/_serve-build.mjs`; an unknown path returns 404, no SPA fallback). `location.pathname` and the h1 were asserted on every shot. Shots are in `docs/mockups/w1-finish/`.
>
> | measure | /dancers 390x844 | /dancers 360x640 | /djs 390x844 | /djs 360x640 |
> |---|---|---|---|---|
> | tiles | 92 | 92 | 40 | 40 |
> | horizontal scroll | none (390/390) | none (360/360) | none | none |
> | names cut | 0 | 0 | 0 | 0 |
> | label row height | 29px | 29px | 29px (two-line rows too) | 29px |
> | clipped label rows | 0 | 0 | **0** (25/40 before the wrap fix) | **0** (25/40 before) |
> | "Playing soon" contrast | n/a | n/a | rgb(252,211,77) on rgb(10,8,11) = 13.84:1, 12px/600 | same |
> | elementFromPoint at tile centres | 92/92 | 92/92 | 40/40 | 40/40 |
>
> - **C1:** /dancers with `get_public_people_badges_v1` intercepted to 500 renders 164 tiles (unfiltered, no labels) and 0 "No dancers yet". Unfiltered includes test-looking rows such as "Doortest"; that is the accepted degraded state.
> - **7h, footer strip:**
>   - Client navigation / -> /faq and /dancers -> /faq: html, body and the band above the footer are all rgb(14,18,21), identical to a direct load, with no strip.
>   - `/event/4ec7a3d5-02bb-4e80-9439-9db4766b00b2` (Pura Nights Ealing) lands on `/event/pura-nights-ealing`. The gap above the footer is a smooth graphite gradient with no separate band.
> - **7a:** on `/djs/carlos-de-la-cruz` the element at the initials' centre is the initials text, and there is no spindle dot.
> - **7f** moved to the follow-up dancer page PR (the finish-pass walk showed it working on `be098eb`).
> - Split pass: the full phone suite (`playwright.phone.config.ts`) ran once on the final code head, 272 passed / 0 failed. The prod-data browser walk above was NOT repeated; the split only returns the dancer page to main's code.
>
> ## Verified / Not verified
> **Verified:**
> - Every review item 1-19: each test failed on the pre-fix code and passes now (commands below).
> - Two code-review rounds, with their findings applied.
> - The gates in the table above, including the full phone-qa suite and `dancer-area-isolation` = 0.
> - The follow-up re-application (split pass): isolation 0, tests pass, same typecheck set.
> - Prod-data browser walk at 390x844 and 360x640 on a local production build.
> - Read-only prod counts: 0 programme people without a `dancer_profiles` row; 4 have an archived row, so the badges RPC returns nothing for them and their chip loses its link (3 of them on upcoming events); 2 profiles with a 2026 start; all 58 team rows have role 'Leader'.
>
> **Not verified:**
> - A Vercel deploy preview (the walk ran on a local prod build).
> - Real photos (the proxy blocks the photo hosts).
> - A real phone.
> - Prod Vercel flag values (proxy).
> - GitHub Actions on #893 were not read (no `gh`).
> - The prod-data browser walk was not repeated after the split pass (dancer page is main's code again; GlobalLayout merge covered by unit tests and the phone suite).
> - `npm run pre-ship` and the code-review rounds were not run for the split pass.
> - #850 is not rebased (7g: rebase or close it before merging; W1 adds no new conflicted file).

## Owner / orchestrator items raised by this pass
1. **dancer-area-isolation:** resolved by the split pass (option B + DJProfile seam). Mirror the new seam into `briefs/dancer-rebuild-INTERFACE.md` section 5 on `arc/briefs-dancer-rebuild` (orchestrator).
2. **Team title "Leader":** in prod, all 58 active `organiser_team_members` rows have `role='Leader'` and `is_leader=true`. That is a system default, not an authored title. The site hides 'leader'; the real fix is in admin, which should store NULL or backfill. Until then, an organiser who really types "Leader" won't see it.
3. **Overlay link for a person with no page** (teacher-only while closed, or no public role): it goes to `<city>/search?q=<name>`. The alternatives were no link (needs a type change in HeaderSearch/SearchOverlay) or the closed /teachers/ page.
4. **Overlay stage name:** the overlay does no badges read, so the DJ tag reads "DJ" there and "DJ · El Rugido" on /search once the badges load. Link and roles agree.
5. **C1 degraded state** shows all `dancer_profiles` rows, test rows included. The other option is an error line with a retry.
6. Not done: 'DJ-Kiko' stays as is (the decided regex is `/^dj\s+/i`); the GlobalLayout-level breadcrumb JSON-LD refactor (the DJ page emits its own).
7. 4 programme people have an archived `dancer_profiles` row, so their lineup chip loses its link after load (3 on upcoming events: 1 DJ, 2 teachers).

## Next steps
- Follow-up worker: the dancer page PR from `be098eb` (see "Split pass", follow-up record).
- Read CI on #893 at this push, and paste the PR body above.
- Do the walk on the Vercel preview, then Ricky's phone test.

---
Appendices: the raw worker notes from this pass (per-item RED/GREEN commands and counts, review rounds, gates, QA). Paths under `/tmp/...` were sandbox scratch and are gone.


## Appendix: groupA

### Group A fix notes (items 1, 5, 10, 13, 14, 18, 19/7a)

All under /home/user/bachata-website. No commits, no branch changes. Files I touched:
- src/pages/Dancers.tsx
- src/pages/DJs.tsx
- src/components/dj/djListModel.ts
- src/components/dj/DjTiles.tsx
- src/modules/person-page/badges.ts (the lead's isError was already there; I left it alone)
- src/modules/person-page/__tests__/badges.test.ts
- src/pages/__tests__/w1PeopleListsPage.test.tsx (NEW)
- src/components/dj/__tests__/djHeroVinyl.test.tsx (NEW)
- tests/regression/today/directoryAttendance.today.test.tsx and its __snapshots__/.snap (updated)

Edits went through scripts/safe-edit.py or safe-write.py. CRLF is kept, and the new test files are CRLF.

### 1. C1 (BLOCKING): /dancers when the badges read fails
- Dancers.tsx reads `isError: badgesError` from usePeopleBadges.
- `shownDancers = badgesError ? dancers : onlyDancers(dancers, badges)`. When the read fails, every row renders. No badge means no labels, and "No dancers yet" is never shown.
- Test: w1PeopleListsPage.test.tsx > "/dancers page > C1: badges RPC error -> tiles render unfiltered, no labels, never "No dancers yet"". There is also a control test: "badges OK -> only Dancer-role people are listed".
- RED: HEAD copies of Dancers.tsx, DJs.tsx and djListModel.ts swapped in, then restored. `npx vitest run src/pages/__tests__/w1PeopleListsPage.test.tsx` gave 3 failed | 2 passed (5). The failures were C1 and both M7 tests. C1 failed on "expected <p> to be null" (the empty state was shown).
- GREEN: same command, 5 passed (5).

### 5. 7b: "DJ · DJ El Rugido"
- badges.ts has a new `stageLabel()`. It strips `/^dj\s+/i` and trims, then builds `DJ · <rest>`. If nothing is left (djName "DJ "), the label is plain "DJ". This applies only inside the roleTagsFor label. nameFor, tile names and the DJ page keep the full name.
- S0 table (badges.test.ts):
  - Existing row 'djName starts with DJ' changed: 'DJ · DJ X' becomes 'DJ · X'.
  - New rows: 'djName "DJ El Rugido"' -> 'DJ · El Rugido'; 'dj  kiko' -> 'DJ · kiko'; 'DJane Kiko' is unchanged (no space after DJ); 'DJ ' -> 'DJ'.
- Page check that the tile keeps the full name: w1PeopleListsPage "M7: the DJ tile ..." expects the textContent to contain 'DJ El Rugido'.
- RED: `npx vitest run src/modules/person-page/__tests__/badges.test.ts` gave 8 failed | 30 passed (38). These were the 4 changed or new rows, each run with the teacher pages open and closed. The DJane row passed, as expected.
- GREEN: 38 passed (38).
- Still pending the owner's confirmation, per the review.

### 10. M7: tag separators in the accessible name
- Dancers.tsx and DJs.tsx: each tag span now starts with `<span className="sr-only">, </span>`. sr-only is absolutely positioned, so it is not a flex item and the visual layout does not change.
- Tests: w1PeopleListsPage "M7: the tile accessible name separates the tags" (/dancers) and "M7: the DJ tile accessible name separates the tags" (/djs). They assert a comma between the name and every tag, with the regex `/Ana Lopez\s*,\s*Teacher\s*,\s*DJ$/`.
  - Why a regex: jsdom's dom-accessibility-api trims each child, so the name reads "Ana Lopez ,Teacher,DJ". A browser reads "Ana Lopez, Teacher, DJ".
  - Before the fix the names were "AL Ana Lopez TeacherDJ" and "D DJ El Rugido TeacherDJDancer". The "AL"/"D" prefix is the avatar fallback initials, which were already in the name.
- RED/GREEN: in the item 1 run above (3 failed, then 5 passed).
- Snapshot side effect: directoryAttendance link names now read "Ana Lopez ,Teacher,DJ" (expected).

### 13. /djs page-level order test
- Test: w1PeopleListsPage "/djs page > renders the SORTED list: upcoming gigs first by date, then the rest in RPC order". The fixture is j1, j2(gig 12-01), j3, j4(gig 11-01), and the expected hrefs are j4, j2, j1, j3.
- Mutant: in DJs.tsx, `sorted.map` changed to `djs.map` (sed, then restored from a copy). `npx vitest run src/pages/__tests__/w1PeopleListsPage.test.tsx -t 'SORTED'` gave 1 failed | 4 skipped, so RED.
- GREEN on the real code: passes.

### 14. Dead hand-written href fallbacks removed
- Dancers.tsx: `to={dancerHref(...)}` (no `?? '/dancers/..'`).
- DJs.tsx: `to={tile.href}` (no `?? '/djs/..'`).
- To keep the types honest, badges.ts `hrefForRole` gained an overload: `(role: 'dj' | 'dancer', ...) => string`. The general signature still returns `string | null`, and the runtime is unchanged. djListModel.ts `DjTileModel.href` is now `string`.
- No behaviour change, so there is no RED test. The existing hrefs are pinned by the w1PeopleListsPage href assertions and the directoryAttendance snapshot, which stayed green. tsc reports no errors in these files.

### 18. directoryAttendance fixture
- `badges: [] as unknown[]` is declared in the vi.hoisted object.
- Added D('d5', null) with no name row and badge roles ['dancer']. The nameless shape is listed again on /dancers. d4 stays teacher-only, so the exclusion is still exercised.
- RED: `npx vitest run tests/regression/today/directoryAttendance.today.test.tsx` gave Snapshots 4 failed, Tests 4 failed | 14 passed (18).
  - Diff: a new tile `link "D Dancer" href=/dancers/d5` with `heading "Dancer"`, plus the M7 comma changes. Nothing else changed.
- Accepted with `-u`. GREEN: 18 passed (18).

### 19 / 7a: DJ hero vinyl
- DjTiles.tsx (DjHero, no-photo branch):
  - The gold label disc stays inside the spinning element, so the label still spins and has no text.
  - The initials moved to a sibling overlay (absolute, inset 32%, centred) that does not spin.
  - The 9px spindle dot is removed. It only ever rendered when initials showed.
- Test: src/components/dj/__tests__/djHeroVinyl.test.tsx
  - "without a photo: initials shown, not inside the spinning disc, no spindle dot": no ancestor has animation dj-spin, the spinning disc's textContent is '', and no 9px div exists.
  - "with a photo: no initials label, the disc still spins".
- RED: `npx vitest run src/components/dj/__tests__/djHeroVinyl.test.tsx` gave 1 failed | 1 passed (2).
- GREEN: 2 passed (2).

### Regression / typecheck
- `npx vitest run src/modules/person-page src/components/dj src/components/people src/pages/__tests__/w1PeopleListsPage.test.tsx tests/regression/today/directoryAttendance.today.test.tsx tests/searchV7People.test.tsx src/modules/event-page` gave 43 files, 866 passed.
  - An earlier run had 19 failures in w1S3Strips "organiser team strip". Another agent was editing OrganiserProfile at the time. A rerun moments later was 56/56 green, so those failures were not from my change.
- `npx tsc -p tsconfig.app.json --noEmit` (the repo's typecheck minus the typegen step) shows many errors that were there before (VendorPortal, VenueEntity, Venues, ...). None are in my files.
- eslint on my files: only the old `any` errors and the exhaustive-deps warnings in Dancers.tsx (fetch code I did not touch).

### Not done / not verified
- No browser walk at 390x844. I did not check visually that the sr-only separators leave the tag row unchanged, or how the non-spinning initials look on the spinning label.
- 7b label strip is still pending the owner's confirmation.


## Appendix: groupB

### Group B fix notes (items 2, 4, 12, 9, 15, 16)

No commits, no pushes, no branch switches. Every source edit went through scripts/safe-edit.py / safe-write.py (CRLF kept; ASCII only, middle dot written as `·`). badges.ts NOT touched.

### Item 2 (M1 + 7c): overlay row == /search PersonRow
Files:
- NEW src/modules/person-page/searchPerson.ts: `searchPersonView(id, roles, badge, opts) -> { tags, href }` (search roles + badge stage name, then roleTagsFor withStageName + linkFor). The ONE function both surfaces call.
- src/lib/searchRpc.ts mapPersonV7: `await import('@/modules/person-page/searchPerson')` (only when v7 returned people); kind always 'person'; href = linkFor answer, else `/search?q=<name>` (no person page: teacher-only while closed, or no public role; never /people/, never the closed /teachers/ gate); subtitle = tag labels joined " · "; roles = tag roles (Teacher kept, plain, while closed). personSearchRow/roleLine no longer imported (personSearchRow in searchEntities is now unused by prod code; left in place, not mine).
- src/pages/SearchResults.tsx PersonRow: uses searchPersonView (was inline merge + roleTagsFor + linkFor); aria-label from the tag roles; comment no longer says "/people/:id has no route".
- Why a separate module: a first try that dynamically imported badges.ts straight from searchRpc made badges.ts a dynamic entry; rollup then hoisted `import "./vendor-supabase"` into it -> puller ratchet on /event went 2 -> 3. With the intermediate module: puller 2/2 (ok).
Tests:
- tests/searchV7People.test.tsx: new describe "overlay == /search row, the 8 S0 prod shapes" (8 shapes x teacher open/closed = 16 tests; expected hrefs/tags written out, not recomputed): searchPublicV3 row AND rendered PersonRow, same href, same tags, no /people/, no /teachers/ while closed. Fixed: mapper it.each (role-page href, subtitle = role text), overlay click test now expects /djs/p3, the "/people/:id has no route" premise comment.
- src/modules/person-page/__tests__/searchPageMatrix.test.ts: search-side expectations moved to the role-page answer (it pinned overlay -> /people/p1); page-side /people snapshot checks kept as "what a typed /people URL shows".
RED (pre-fix code): `npx vitest run tests/searchV7People.test.tsx` -> 24 failed | 26 passed (50); reasons: kind 'teacher' for teacher-only, Teacher dropped from roles while closed, href '/people/p0'.
GREEN: same cmd -> 50 passed (50). `npx vitest run src/modules/person-page/__tests__/searchPageMatrix.test.ts` -> 120 passed (was 120 failed against the new behaviour before its update, as expected).

### Item 4 (M2) + item 12 (7d): organiser team strip
File: src/pages/OrganiserProfile.tsx TeamCircle: name = nameFor('other', ...) (real name; stage name only inside the DJ tag); organiser-authored title (member.role, trimmed) shown as `[data-team-title]` in the tag row before the tags; no 'Team' default; hidden when blank or when it only repeats a tag word (e.g. "dj" next to the DJ tag). Import ROLE_LABEL from searchEntities.
Test: src/modules/person-page/__tests__/w1S3Strips.test.tsx: strip name expectation -> 'Real Name' for every shape, title 'Founder' expected; new describe "organiser team strip: the organiser-authored title (review 7d)" (set / padded / null / blank / same-word-as-tag + stage name only in DJ tag).
RED: `npx vitest run src/modules/person-page/__tests__/w1S3Strips.test.tsx` -> 19 failed | 37 passed (56) ('El Rugido'/'Oreo Sensual' instead of 'Real Name', title null).
GREEN: same -> 56 passed (56).

### Item 9 (C6 + mutant gap): ScheduleBlock on badges error
File: src/modules/event-page/bento/blocks/ScheduleBlock.tsx: reads `isError` from usePeopleBadges; `mapPersonFromBadges(p, badge, feedFallback)` with feedFallback = loading || error: DJ/dancer keep the feed link, a teacher (or any feed /teachers/ href) gets none.
Test: NEW src/modules/event-page/bento/blocks/__tests__/scheduleBadgesLinks.test.tsx: renders the REAL ScheduleBlock (fake supabase: event_view_p5 programme with teacher, DJ, dancer; badges RPC errors / answers x2 / never resolves), waits for the badges query to SETTLE, asserts each chip's href and no '/teachers/' in the DOM. 4 tests.
RED (pre-fix): `npx vitest run src/modules/event-page/bento/blocks/__tests__/scheduleBadgesLinks.test.tsx` -> 1 failed | 3 passed (error case: DJ chip href null, expected /djs/dj-1).
GREEN: same -> 4 passed.
Mutant `people: s.people` (applied with sed on a backup, restored, sha verified identical): 4 failed (4). The gap from review section 8 is closed.

### Item 15 (M5): EventScheduleGrid role text
File: src/modules/event-page/sections/EventScheduleGrid.tsx roleLabel: teacher/dj/dancer text = roleTagsFor(one-role badge)[0].label (ROLE_LABEL); videographer/vendor keep their words. (Proved live: parseProgramItems feeds ScheduleBlock via useProgramItems.) Local hrefFor there untouched (not in this item).
Test: NEW src/modules/event-page/bento/blocks/__tests__/programmeRoleLabelOneCopy.test.ts: mocks ROLE_LABEL with sentinels; parseProgramItems role must follow. 6 tests.
RED: `npx vitest run src/modules/event-page/bento/blocks/__tests__/programmeRoleLabelOneCopy.test.ts` -> 3 failed | 3 passed ('Teacher' instead of 'T-sentinel' etc.).
GREEN: same -> 6 passed.

### Item 16 (C7 only): PersonChip telemetry
File: src/modules/event-page/bento/blocks/schedule/PersonChip.tsx: exported `profileTypeForLink(href, fallback)`: /djs/ -> dj, /dancers/ -> dancer, /teachers/ -> teacher, /vendors/ -> vendor, /organisers/ -> organiser, else the feed type. (emitProfileView accepts dancer|teacher|dj|organiser|videographer|vendor; anything else is sanitised to 'unknown' there.)
Test: NEW src/modules/event-page/bento/blocks/__tests__/personChipTelemetry.test.tsx (8 cases).
RED: `npx vitest run .../personChipTelemetry.test.tsx` -> 4 failed | 4 passed (feed 'teacher' logged for a /djs/ link etc.).
GREEN: same -> 8 passed.
C8 NOT done (not in my items).

### Gates run
- Related suites: `npx vitest run src/modules/event-page src/modules/person-page src/components/people src/components/search tests/searchV7People.test.tsx src/pages tests/regression` -> 82 files, 1725 passed (with the other agents' concurrent changes in the tree).
- Typecheck: `npx tsc -p tsconfig.app.json --noEmit` -> 99 errors; branch HEAD (clean worktree) -> 99. None introduced (one I introduced in EventScheduleGrid was fixed).
- eslint on my changed/new files: no new errors (remaining errors pre-existing: EventScheduleGrid `as any` x4 at 212/438/461/485, OrganiserProfile set-state-in-effect at 523). PersonChip's new export adds a react-refresh warning (warning only).
- `npm run build` -> 0. `npm run check:bundle-budget`: puller ratchet event 2/2 ok, home 0/0 ok. Chunk ratchet event 44 > 43 is PRE-EXISTING: a clean HEAD worktree build gives the same 44 (and an experiment with my searchRpc + EventScheduleGrid changes reverted also gave 44).

### Not done / not verified
- Browser walk / real data: not run (sandbox). The overlay fallback href `/search?q=<name>` for a person with no page is my call at a fork (alternatives: no link, or the closed /teachers/ gate); flag it to the owner.
- Overlay subtitle has no stage name (the overlay has no badges read); /search adds it once badges arrive. Tags and link agree; label text can differ by the stage name only.
- M3 (PersonRow tags from search roles, not the badge) unchanged: not in my items; searchPersonView keeps that behaviour.


## Appendix: groupC

### Group C fix pass (items 3, 6, 7, 8, 16/C8, 17, 11/7f)

All edits via scripts/safe-edit.py / safe-write.py; CRLF preserved on every file. Nothing committed.

### 3. C2 embedded paint (GlobalLayout)
- Files: src/components/layout/GlobalLayout.tsx (`groundBase = !embedded && showGradientBg && ground ? ground.base : null`),
  src/components/layout/__tests__/GlobalLayout.grounds.test.tsx (new it.each `%s embedded as a /people/:id tab: <html>/<body> untouched` for default/dancer/dj).
- RED: `npx vitest run src/components/layout/__tests__/GlobalLayout.grounds.test.tsx` -> 3 failed | 9 passed (12).
- GREEN: same cmd -> 12 passed.

### 6/7/16. C3 JSON-LD, C4 manual share link, C8 ground on loading/error (DJProfile)
- Files: src/pages/DJProfile.tsx; NEW src/pages/__tests__/DJProfile.test.tsx (5 cases).
  - C3: loaded state renders `<script type="application/ld+json">` from renderBreadcrumbListJsonLd({crumbs: djBreadcrumbs, origin: SITE_ORIGIN, currentUrl: SITE_ORIGIN + canonical /djs/<slug>}). Skipped when embedded (person page owns the head) to avoid a duplicate on /people/:id.
  - C4: DjShare renders a readOnly, select-on-focus `<input data-testid="dj-share-link">` with the URL when outcome === 'manual' (44px tap height, DJ ink colours).
  - C8: loading and error states now pass `gradientPalette="dj"` (were `showGradientBg={false}`), so body/html get #0A080B immediately.
- Tests: "loaded page (subheader hidden) still emits one BreadcrumbList JSON-LD ending at the DJ" (Home > Parties > DJs > DJ Oreo, last item ends /djs/oreo); "embedded ... no JSON-LD of its own" (guard, green both before/after); "share with no share sheet and no clipboard shows the page link"; "loading state paints the DJ ground"; "error state paints the DJ ground".
- RED (HEAD DJProfile.tsx swapped in temporarily via safe-write, then restored byte-identical): `npx vitest run src/pages/__tests__/DJProfile.test.tsx` -> 4 failed | 1 passed (5).
- GREEN: same cmd -> 5 passed.

### 8. C5 Instagram-in-website (djContacts)
- Files: src/components/dj/djContacts.ts; src/modules/person-page/__tests__/alsoBar.test.tsx (splitInstagramWebsite table, +13 rows).
  - Host match: (https?://)?(www.|m.)?instagram.com. First path segment must look like a handle ([A-Za-z0-9._]{1,30}) and not be explore|p|reel|reels|stories|tv|accounts|direct; otherwise the link is dropped (instagram null, website null). An existing `instagram` value still wins and the website IG URL is dropped (unchanged behaviour).
  - Bare `www.instagram.com` row changed from "becomes Instagram" to "dropped" (the C5 defect itself).
- RED: `npx vitest run src/modules/person-page/__tests__/alsoBar.test.tsx -t splitInstagramWebsite` -> 9 failed | 8 passed.
- GREEN: `npx vitest run src/modules/person-page/__tests__/alsoBar.test.tsx` -> 69 passed.
- Not done: instagr.am not recognised (review NIT; kept scope to brief).

### 17. C9 dead extrasOk prop
- Files: src/modules/dancer-app/public-page/PublicDancerPageV2.tsx (prop removed from PublicDancerPageV2Props; it was never destructured), src/pages/DancerProfile.tsx (the only caller: `extrasOk={publicPage.extrasOk}` line removed), src/modules/dancer-app/public-page/__tests__/page.test.tsx (no-op test "extras read failed: ..." removed).
- Kept: `PublicPageV2Data.extrasOk` (data field used by loadPublicPage/route/people loader tests as the degraded signal) -- only the component prop was dead.
- RED/GREEN: N/A for dead-code removal (review mutation already proved the test passed whatever the code did). Proof of no caller left: `grep -rn extrasOk=` -> none; tsc shows no error in these files.
- GREEN: `npx vitest run src/modules/dancer-app` -> all pass (part of the 1145 below).

### 11 / 7f. "New this year"
- Files: src/modules/dancer-app/public-page/model.ts (facts), src/modules/dancer-app/public-page/__tests__/model.test.ts.
  - years === 0 (stored current year) -> dancing "New this year", level experienceLevel(0) = "Newcomer" (one mapping, same as `experience`). null stays hidden. Added: a future year (negative years) stays hidden.
- Test: "start year 2026 -> dancing New this year, level Newcomer" (+ 2027 -> null,null).
- RED: `npx vitest run src/modules/dancer-app/public-page/__tests__/model.test.ts` -> 1 failed | 55 passed (56).
- GREEN: same -> 56 passed. page.test "no start year stored" (null) still green.
- Note: the start-year fact lives in dancer-app/public-page/model.ts (not person-page/); that is the model the review's 7f/mutant refer to.

### Whole run
- `npx vitest run src/modules/dancer-app src/modules/person-page src/pages/__tests__/DJProfile.test.tsx src/components/layout` -> 42 files passed, 1 failed; 1145 passed | 19 failed. ALL 19 failures are in src/modules/person-page/__tests__/w1S3Strips.test.tsx "organiser team strip" cases -- that file + OrganiserProfile.tsx are being edited by another agent (7d/M2); none of my files are involved.
- Typecheck `tsc -p tsconfig.app.json --noEmit`: 99 errors, all pre-existing in untouched files (Vendor*, Venue*, etc.); 0 in any file I touched.
- Observation: src/modules/dancer-app/public-page/__tests__/__snapshots__/embedded.test.tsx.snap shows as modified with an EOL-only diff (no content change). Not edited by me deliberately; left alone.

### Not verified
- No browser walk at 390x844 (DJ share input layout in the head row, ground on loading).
- JSON-LD in SSR HTML of /djs/:id not checked against a real deploy (only jsdom).


## Appendix: review-round1

### Code-review round 1

Stopping rule: user-facing + data-integrity change -> two review rounds; this is round 1's
fixes (unreviewed until round 2). Every finding: test RED on the unfixed code, then GREEN.

| # | File(s) | Fix | RED -> GREEN (command) |
|---|---|---|---|
| F1 | src/pages/OrganiserProfile.tsx (TeamCircle) | Title hidden when it is 'leader' (trimmed, case-insensitive) as well as blank / a tag's word. Prod: all 58 active organiser_team_members rows are role='Leader'. | `npx vitest run src/modules/person-page/__tests__/w1S3Strips.test.tsx`: 2 failed / 56 passed (58) -> 58/58. Rows added: 'Leader', '  leader '. |
| F2+F5 | src/lib/searchRpc.ts | searchPerson chunk via `safeDynamicImport`, started BEFORE the RPC await (when flags.searchV7), `.catch(() => null)`. On failure people rows degrade: roles from the search read (orderedRoles), subtitle roleLine, no page link (search-results href); events/venues/organisers still returned. | `npx vitest run tests/searchV7People.test.tsx tests/searchV7PeopleImportFail.test.ts` (new file: chunk import throws): 7 failed / 48 passed (55) -> 55/55 (F2+F3 together). |
| F3 | src/lib/searchRpc.ts | No-page person href = `${buildCityPath(citySlug,'search')}?q=<name>` (citySlug IS in scope: searchPublicV3 param), the same as submitSearch. Empty authored name: searches the typed query (`term`) instead of an empty name / "Unknown" (SearchResult.href is a required string and both consumers navigate() it unguarded, so a literal "no href" would need a type change in HeaderSearch/SearchOverlay). | Tests: city-scoped, no city (global), empty name. Also updated the S0 matrix expectation and searchPageMatrix.test.ts to the city-scoped path. |
| F4 | src/pages/Dancers.tsx | Unfiltered only when `badgesError && badges.size === 0`. | `npx vitest run src/pages/__tests__/w1PeopleListsPage.test.tsx`: 1 failed / 5 passed (6) -> 6/6 (new: successful read, then a failed refetch keeps the filter). |
| F7 | src/modules/event-page/sections/EventScheduleGrid.tsx | `ROLE_LABEL[profileType]` from '@/lib/searchEntities' directly; badges import dropped. | `npx vitest run src/modules/event-page/bento/blocks/__tests__/programmeRoleLabelOneCopy.test.ts`: added a badges mock whose roleTagsFor returns 'via-roleTagsFor': 3 failed / 3 passed (6) -> 6/6. The ROLE_LABEL sentinel mock path still applies. |
| F8 | src/modules/event-page/bento/blocks/schedule/PersonChip.tsx | One `loggedProfileType` (profileTypeForLink when linked, else feed type) feeds both `data-profile-type` and emitProfileView. | `npx vitest run src/modules/event-page/bento/blocks/__tests__/personChipTelemetry.test.tsx`: 4 failed / 5 passed (9) -> 9/9. |
| F9 | model.ts, loadPublicPage.ts, DancerProfile.tsx + fixtures | `extrasOk` had no reader in src/app (its only reader, PublicDancerPageV2's contacts empty state, was removed in W1): field, computation, comment removed; loader doc updated; fixtures in page.test.tsx (22), embeddedPassThrough, PersonPage.test, app/routes/people.loader.test.ts updated. Stray blank line in DancerProfile removed. | `npx vitest run src/modules/dancer-app/public-page/__tests__/route.test.ts` (expectations first): 8 failed / 19 passed (27) -> 27/27. Typecheck 99 -> 99. |
| F10 | badges.ts, badges.test.ts, alsoBar.test.tsx | Every added raw U+00B7 -> `·` escape (MIDDOT constant itself now `'·'`; comments use the ASCII escape too). | `git diff origin/main -- src tests app \| grep '^+' \| grep -P '[^\x00-\x7F]'`: 14 lines -> 0. `npm run check:mojibake` clean. Tests 107/107. |

Not done (per instructions): GlobalLayout-level JSON-LD refactor; 'DJ-Kiko'.

### Gates
- W1 vitest sweep (src/pages/__tests__ src/modules/person-page src/modules/event-page src/modules/dancer-app src/components/dj src/components/layout tests/searchV7People.test.tsx tests/searchV7PeopleImportFail.test.ts tests/regression app/routes/people.loader.test.ts tests/searchV6Level.test.tsx tests/surnameHide.matrix.test.ts src/components/people/__tests__/nationalityFlag.surfaces.matrix.test.tsx): 120 files, 2561/2561 passed.
- `npm run typecheck`: 99 errors (baseline 99, no growth).
- `npm run build` + `npm run check:bundle-budget`: /event puller ratchet 2/2 [ok]; /event chunk ratchet 44 > 43 [OVER] = pre-existing on HEAD (unchanged by these edits); all size budgets ok.
- CRLF-only .snap noise restored (10 files); directoryAttendance.today.test.tsx.snap has a real W1 diff and was left.

### Code-review round 2 (final)

Stopping rule: this is the second and last round (user-facing + data-integrity: two rounds).
These fixes are unreviewed code. Every finding: test RED on the unfixed code, then GREEN.

| # | File(s) | Fix | RED -> GREEN (command) |
|---|---|---|---|
| R1 | src/lib/searchRpc.ts, tests/searchV7PeopleImportFail.test.ts | Plain `import('@/modules/person-page/searchPerson')` (safeDynamicImport + its import dropped), started before the RPC await; `.catch` reports once per page load via `reportClientErrorLazy(err, 'error')` (src/lib/reportClientErrorLazy.ts, the repo's lazy error reporter; Sentry SDK is gone) and resolves null. Still awaited only when `payload.people?.length`. Test file rewritten: per-test `vi.resetModules` + `vi.doMock`; staleChunk pinned (every failure classified stale, `attemptChunkReloadOnce` a spy) because vitest wraps a throwing mock factory's message. Cases: other kinds intact; null-module person row (roles teacher,dj, subtitle, `/city/london/search?q=Ana%20B`, never /people/, telemetryKind dj); stale chunk never reloads; reported once over 3 keystrokes; no-people search resolves while the import never settles. | `npx vitest run tests/searchV7PeopleImportFail.test.ts`: 4 failed / 1 passed (5) (search hung behind the never-settling reload promise) -> 5/5. The no-people case is green on the unfixed code too (the await was already conditional); mutation check: awaiting unconditionally -> 1 failed / 4 passed, reverted (same sha). With tests/searchV7People.test.tsx: 58/58. |
| R2 | src/pages/OrganiserProfile.tsx (TeamCircle + caller), src/modules/person-page/badges.ts | New `badgesState: 'loading' \| 'error' \| 'ready'` prop (caller: usePeopleBadges isLoading/isError). Not ready + no badge + dancerId -> `hrefForRole('dancer', dancerId)` (= /dancers/:id); ready with no badge row -> no link. New `linkRoleFor(badge, opts)` in badges.ts; `linkFor` now reads it (one copy of the DJ > dancer > teacher order). | `npx vitest run src/modules/person-page/__tests__/w1S3Strips.test.tsx` (R2+R4+R6 added together): 7 failed / 62 passed (69) -> 69/69. |
| R3 | src/pages/Dancers.tsx | Unfiltered when `!badgesLoading && badges.size === 0 && dancers.length > 0` (covers error, since an errored read is never loading; F4's cached-badges refetch case keeps the filter). Unused `badgesError` dropped. | `npx vitest run src/pages/__tests__/w1PeopleListsPage.test.tsx`: 1 failed / 7 passed (8) -> 8/8. |
| R4 | src/pages/OrganiserProfile.tsx (TeamCircle) | Title not rendered while badges load; on error it shows (no tags to dedupe against; 'Leader' still hidden). | In the R2 run: 'loading: no title yet' RED -> GREEN; 'error: the title shows' green both sides (pins the error branch). |
| R6 | src/pages/OrganiserProfile.tsx (TeamCircle) | Link `onClick` -> `emitProfileView({ personId, profileType: linkRole, context: 'organiser:team' })`; type = the role the link opens (dj / dancer / teacher while open; fallback link = dancer). | In the R2 run: 4 click cases RED -> GREEN. |
| R9 | src/lib/searchEntities.ts, src/modules/person-page/personRoles.ts, docs/handover/{w1-s3-strips,person-page-web}.md | `personSearchRow` had no importer in src/app/tests/scripts (only a comment in personRoles.ts): removed. File-head and visibleRoles comments no longer claim a search row / /people/ links; personRoles doc and two handover docs updated. No dead tests existed. | `npx vitest run tests/searchV7People.test.tsx` (new: searchEntities exports no personSearchRow): 1 failed / 53 passed (54) -> 54/54. |
| R10 | src/modules/event-page/bento/blocks/schedule/PersonChip.tsx, new src/modules/event-page/bento/blocks/__tests__/linkProfileTypeOneCopy.test.ts | `LINK_PROFILE_TYPE` = `['dj','dancer','teacher','vendor','organiser'].map(k => [hrefFor(k, ''), k])`. | New test mocks hrefFor to moved routes (`/moved/djs/...`): 5 failed / 1 passed (6) -> 6/6; with personChipTelemetry.test.tsx 15/15. |

Not doing:
- R5 'Leader' string: the real fix is data in admin. Every one of the 58 active organiser_team_members rows has role='Leader', a default written by admin, not a title anyone typed. Flag to the owner: admin should write NULL (and backfill), after which the website's 'leader' filter can go.
- R8 overlay stage name: the header overlay has no badges read, so after /search loads badges its DJ tag can show a stage name the overlay row does not. Known limitation; the tags and link agree between the two.

### Gates
- W1 vitest sweep (src/pages/__tests__ src/modules/person-page src/modules/event-page src/modules/dancer-app src/components/dj src/components/layout src/components/people tests/searchV7People.test.tsx tests/searchV7PeopleImportFail.test.ts tests/regression app/routes/people.loader.test.ts tests/searchV6Level.test.tsx tests/surnameHide.matrix.test.ts, plus the new linkProfileTypeOneCopy test): 122 files, 2625/2625 passed.
- `npm run typecheck`: 99 (baseline 99). No new error in a touched file (the searchRpc rpc-`never` and OrganiserProfile `city` errors are the baseline's).
- `npm run build` ok; `npm run check:bundle-budget`: /event puller ratchet 2/2 [ok]; the only [OVER] is the /event chunk ratchet 44 > 43, pre-existing on HEAD.
- CRLF-only .snap noise restored with `git cat-file --filters HEAD:<f>` (10 files; the sweep had rewritten them to LF). directoryAttendance.today.test.tsx.snap kept (real W1 diff).
- Flake seen, not W1: tests/regression/today/account.today.test.tsx 'organiser-type (complete)' fails about 1 run in 3 under CI=1 (a "Your account" button is in the a11y tree or not, a timing race); green in the sweep and in 2 of 3 reruns.


## Appendix: gates

### W1 people surfaces: gates (2026-10-21)

Tree: claude/w1-people-surfaces HEAD 1f00b24 + uncommitted W1 fixes + Part 1 fix (vite.chunks.ts, tests/chunkClassifier.test.ts).
Base: origin/main d306e9a (built at $SP/wt-main). Merge-base 0ab0ff9.
Logs: $SP/logs/, per-step logs $SP/gates/{branch,main}/g.N.log (N = row in $SP/scripts/gates.txt).

### Part 1: chunk ratchet regression (fixed)

**Cause.** /event first-load chunk lists, main vs branch, differ by exactly one file: `assets/badges-*.js`
(holds only src/modules/person-page/badges.ts). S3's ScheduleBlock -> badges.ts gave that module a unique
importer set (event + people pages + search), so rollup cut it into its own chunk. searchEntities and the
client chunk were already in /event's first load on main.

**Fix (vite.chunks.ts, no perf-budgets.json change).**
- New third first-party group `lib-people` = badges.ts + src/lib/seo/useEntitySlugOrId.ts +
  resolvePublicEventRef.ts. The resolver chunk is already in /event's first load and only depends on manual
  chunks (vendor-query, lib-event-rules).
- `SINGLE_MODULE_PINS`: src/integrations/supabase/client.ts -> `supabase-client`, src/lib/searchEntities.ts ->
  `lib-search`. Each holds exactly what its old automatic chunk held. These pins are needed because rollup
  adds every unassigned static dependency of a pinned module to that module's group. Without them, client.ts
  and searchEntities (which root loads on every route) would land in lib-people and pull a supabase edge onto home.
- tests/chunkClassifier.test.ts: new describe block (group contents, bounds, pins, files exist). 52 -> 55 tests, pass.

**Proof (`npm run check:bundle-budget`, same plain build env):**

| line | before (branch) | after |
|---|---|---|
| home KB / files | 207.2 / 39 | 207.1 / 39 |
| event KB / files | 379.8 / 44 | 379.6 / 43 |
| auth | 292.9 / 29 | 292.9 / 29 |
| dancer-app | 366.7 / 55 | 366.7 / 55 |
| parties | 322.1 / 45 | 322.1 / 45 |
| classes | 322.2 / 45 | 322.2 / 45 |
| faq | 233.1 / 26 | 233.1 / 26 |
| landing prose | 233.4 / 26 | 233.3 / 26 |
| landing style | 232.4 / 26 | 232.4 / 26 |
| puller ratchets | 0/2/2/4/3/3/0/0/0 all ok | identical |
| chunk ratchet event | **44 > 43 [OVER]** | **43 = 43 [ok]** |
| chunk ratchets others | 39/29/55/45/45/26/26/26 ok | identical |
| required edge client.ts in auth | ok | ok |
| exit | 1 | 0 |

Also with the perf-budget.yml env (placeholder VITE_SUPABASE_*): exit 0, event 379.7 KB / 43, everything else ok.
check:first-load-requests: all 6 pins match. check:chunk-cycles: PASS, no cycle.

**All 124 manifest entries** (entry.client + root + entry closure, before vs after): no entry gained a chunk.
7 lost one (event, dancers, djs, teachers, organiser, DJProfile, DancerProfile, TeacherProfile).
Byte increases are all on unbudgeted entries and all at most 0.9 KB gz: festival +0.8, venue-entity +0.9 and
FestivalDetail +0.8 (badges bytes), DJs +0.4, Dancers +0.3 and SearchResults +0.3 (resolver bytes).

### Part 2: CI gates on the final tree

Exit codes are branch / main. Attribution: "same" means it behaves the same on origin/main; "branch" means
the W1 branch caused it.

### architecture-guard.yml / integrity
| step | command | exit | result | attribution |
|---|---|---|---|---|
| PyYAML | python3 -c "import yaml" | 0/0 | ok | - |
| Integrity guard | bin/check-integrity.sh (CI chmods first) | 0/0 | 2058 files, 0 issues | same |
| (lint-chain form) | npm run check:integrity | 126/126 | bin/check-integrity.sh is mode 100644 in git on both. CI runs `chmod +x bin/*.sh` first | same, env |
| legacy-tables | npm run check:legacy-tables | 0/0 | ok | - |
| legacy-program-rpcs | npm run check:legacy-program-rpcs | 0/0 | ok | - |
| architecture | npm run lint:architecture | 0/0 | ok | - |
| Image audit | AUDIT_STRICT=1 npm run check:images | 0/0 | missing alt/loading 0 | - |
| Image widths | check:image-widths:self-test + check:image-widths | 0/0 | ok | - |
| Plan hygiene | check:plan-hygiene:self-test | 0/0 | ok | - |
| Workflow artifact policy | self-test + guard | 0/0 | ok | - |
| Mojibake | check:mojibake:self-test + git grep guard | 0/0 | none | - |
| Entry-point | prove:entry-point:self-test + prove:entry-point | 0/0 | ok | - |

### npm run lint (run-lint-chain)
| link | exit | attribution |
|---|---|---|
| 19 of 20 links | PASS | - |
| check:integrity | 126 (main 126) | same, env (mode bit). `bash bin/check-integrity.sh` = 0 |
| lint:eslint (tail, informational) | SKIPPED by the chain. Run alone: exit 1, 318 errors (main 316) | +1 src/pages/DJProfile.tsx (branch, uncommitted fix); +1 build/server artifact (noise) |
| pre-ship eslint ratchet (changed files vs merge-base) | would FAIL | **branch (uncommitted W1 fix):** DJProfile.tsx 1 -> 2 errors. Line 251 `// eslint-disable-next-line react/no-danger` triggers "Definition for rule 'react/no-danger' was not found". Fix: delete that comment. Every other changed file is at or below its base count |

### typecheck.yml / wallclock-brand
| step | exit | result |
|---|---|---|
| check:rpc-typing | 0/0 | ok |
| check:wallclock-brand | 0/0 | ok |
| (not in CI) npm run typecheck | 2/2 | 99 errors on both, an identical set after normalising line numbers. Same |

### unit-tests.yml
| job/step | command | exit | result | attribution |
|---|---|---|---|---|
| unit (London, full) | CI=1 TZ=Europe/London npx vitest run | 1/1 | branch 10513 tests, 16 failed; main 10270 tests, 17 failed | 16 failures identical on both. Contract tests (eventViewCompat x5, occurrenceProgram x2, publicEventPageLineup x3): local .env project gives "Invalid API key" / no data. CI offline mode excludes `*.contract.test.*`. integrityCouldNotRun x6: sandbox PATH has node sharing a dir with git/python3. All env. main-only extra: festivalClientState, which passes alone on both (load flake) |
| account.today 'organiser-type (complete)' x5, CI=1 | vitest run that file | branch failed 2/5, main failed 1/5 | snapshot mismatch | same (pre-existing flake on main) |
| unit (New_York, tz-sensitive) | the 9-file list | 0 | 213 passed | - |
| unit (Sydney, tz-sensitive) | the 9-file list | 0 | 213 passed | - |
| test:unit:timing | npm run test:unit:timing | 0 | 65 passed | - |
| live gate | node scripts/ci-live-db-gate.mjs | 0/0 | locally "RUN" (event unknown) | - |
| dancer-area-isolation self-test | --self-test | 0/0 | ok | - |
| **dancer-area-isolation** | npm run check:dancer-area-isolation | **1**/0 | 93 violations | **branch (committed W1):** the branch edits src/modules/dancer-app/public-page/*, so it counts as a dancer-area PR and rule (a) fires on every non-seam file. Rule (c): src/pages/DJProfile.tsx imports @/modules/dancer-app/public-page/model and is not a seam. Both already true at HEAD 1f00b24. Needs an orchestrator seam/allowlist decision or a restructure |

### e2e-smoke.yml
| step | exit | result | attribution |
|---|---|---|---|
| npm run test:e2e (CI env, chromium from /opt/pw-browsers) | 0 | 158 passed, 2 flaky, 1 skipped | flaky: auth-magic-link-returnto:113 and organiser-home:55. A 3x repeat with no retries fails the same 2 returnto tests on main and branch (same). organiser-home did not recur on either |

### phone-qa.yml (triggered: tsx/vite.chunks.ts paths changed)
| job | exit | result | attribution |
|---|---|---|---|
| **phone-qa** (playwright.phone.config.ts) | **1** | 269 passed, **2 failed**, 1 flaky, 74 skipped | **branch (committed W1 S1):** people-nationality-flag.phone.spec.ts:227 '/dancers list (32px)' expects stickerPx 14 but gets 22, at both 390x844 and 360x640. Dancers.tsx now renders NationalityFlag at size 48 (was 32), and stickerSize(48) = 22. The spec row at line 64 is stale (fix: name '(48px)', stickerPx 22), unless 48px is unintended. Passes on main. Flaky keyboard.phone:358 city search also flakes on main (same) |
| build-smoke (fake Supabase build + playwright.build.config.ts) | 0 | 66 passed | - |

### perf-budget.yml / bundle-budget
| step | exit | result |
|---|---|---|
| check:bundle-budget:self-test | 0 | ok |
| check:first-load-requests:self-test | 0 | ok |
| check:chunk-cycles:self-test | 0 | ok |
| npm run build (perf env) | 0 | ok |
| npm run check:bundle-budget | 0 | all ok (was 1 before Part 1) |
| npm run check:first-load-requests | 0 | 6/6 pins |
| npm run check:chunk-cycles | 0 | PASS |
| lighthouse / doc-weight | NOT RUN | preview jobs, skipped for `claude/` heads in CI too; need a Vercel preview |

### workflow-lint.yml
| step | exit |
|---|---|
| BOM check | 0 |
| docs-only --self-test | 0 |
| lint-workflow-masking | 0 |
| lint-workflow-notification self-test + run | 0 / 0 |
| check-no-preview-prefixes self-test + run | 0 / 0 |

### db-contract-check.yml
| step | exit | note |
|---|---|---|
| ci-live-db-gate --self-test / run | 0 / 0 | |
| check-migration-stamps | 0 | no supabase/migrations |
| check-guest-list-contract --self-test | 0 | |
| check-day-rollover-consistency-v1 | 0 | consistent |
| check-script-conventions self-test + run | 0 / 0 | |
| self-tests of added-session-room, festival-detail-span, upcoming-event-cover, occurrence-delete-booking-safety, program-day-offsets, og-scrape-evidence, og-render-health, event-truth-v1, image-refs-live | 0 each | canaries only |
| precheck-supabase-secrets + all ~50 live contract checks | NOT RUN | need the prod VITE_SUPABASE_* secrets and a live DB, which this sandbox does not have. Live DB, Docker and local Supabase were not used |

### Other workflows (canaries runnable offline, all exit 0)
check-ci-budget, check-deployment-storage, check-firewall-drift, apply-firewall, check-io-health, check:og,
check:seo, check-sitemap-fetchable, check-pr-phone-qa, check:pr-mergeable (all --self-test).
NOT RUN, with reasons:
- real-data-verified and phone-qa-section real checks: they read the PR body from the GitHub event.
- types-drift: needs SUPABASE_ACCESS_TOKEN.
- og / seo / synthetic-ssr preview jobs: need a Vercel preview, and are skipped for `claude/` heads.
- schedule/deploy-only workflows (prod-smoke, live-qa, sentry, gsc, digest, cloudflare-purge, post-merge alarm, bot/dependabot automerge, owner-approval, stale-wip): not PR gates.

### Snapshot hygiene
Branch: no CRLF-only .snap noise. Only the kept directoryAttendance.today snap is modified, and that change is
real. wt-main: clean.


## Appendix: qa

### Phone QA — claude/w1-people-surfaces (HEAD 1f00b24 + uncommitted working tree), 2026-10-21

SP=/tmp/claude-0/-home-user-bachata-website/21384bfb-5af7-5cbf-a9e6-58568c4c98bb/scratchpad

### Setup
- `$SP/wt-after` = worktree at HEAD + `git diff HEAD --binary` applied (no untracked files existed). Every changed file
  compared byte-for-byte with the main tree: all identical except one CRLF-only snapshot (copied over). node_modules symlinked.
- Build: `(set -a; . $SP/notes/prod-anon.env; set +a; npm run build)` exit 0 (log `$SP/notes/build-after.log`); prod ref
  `stsdtacfauprzrdebmzg` baked in (build/client/assets/VendorDetail-*.js).
- Serve: `node --conditions=production scripts/_serve-build.mjs --port 4173` -> "serving ... 127.0.0.1:4173"; `/no-such-page` 404 (SSR,
  no SPA fallback). Stopped after with kill -INT on the node pid (note: `$!` in serve-recipe captures the wrapping shell pid when run
  via the Bash tool; the node pid had to be killed directly). Port 4173 refuses connections now.
- Playwright chromium (/opt/pw-browsers), proxy with 127.0.0.1 bypass, DPR 2, isMobile, hasTouch. Scripts: `$SP/scripts/qa.mjs`
  (main), `dbg4.mjs`/`dbg5.mjs` (follow-ups). Raw output: `$SP/notes/qa-raw.json`.
- Photos: media.bachatacalendar.co.uk and pub-07f6...r2.dev fail ERR_TUNNEL_CONNECTION_FAILED through the proxy, so every portrait
  is an initials placeholder or a broken image icon (dancers with avatar_url show the browser's broken-image glyph). Supabase calls all OK.

### 1. /dancers and /djs (pathname + h1 asserted on every load)
| measure | /dancers 390x844 | /dancers 360x640 | /djs 390x844 | /djs 360x640 |
|---|---|---|---|---|
| pathname / h1 | /dancers / "Meet Dancers" | same | /djs / "Bachata DJs" | same |
| tiles | 92 | 92 | 40 | 40 |
| scrollWidth vs clientWidth | 390 / 390 | 360 / 360 | 390 / 390 | 360 / 360 |
| horizontal scroll | no | no | no | no |
| names cut (scrollWidth>clientWidth) | 0/92 | 0/92 | 0/40 | 0/40 |
| label row height | 29px (all tiles) | 29px | 29px | 29px |
| label row width | 90px | 80px | 103px | 93px |
| labels per tile | 0:21, 1:46, 2:25 | same | 1:4, 2:11, 3:25 | same |
| label rows overflowing (clipped) | 0 | 0 | **25/40, by 5px** | **25/40, by 10px** |
| "Playing soon" | n/a (0) | n/a | 17 tiles | 17 tiles |
| Playing soon contrast | - | - | rgb(252,211,77) on rgb(10,8,11) = **13.84:1** (12px/600) | 13.84:1 |
| elementFromPoint at tile centre inside tile link | 92/92 | 92/92 | 40/40 | 40/40 |

Contrast background measured two ways and agreeing: nearest opaque ancestor backgroundColor rgb(10,8,11), and the screenshot pixels
under the text box with the text made transparent (mean = mode = 10,8,11).

**FAILURE — /djs role-label row clips three-label tiles.** Every DJ tile with 3 labels ("Teacher DJ Dancer", 25 of 40 tiles) overflows
the `overflow-hidden justify-center` row: content 108px in a 103px row at 390 (93px row at 360, overflow 10px), so both ends are cut —
renders as "'eacher DJ Dance" (visible in the full-page shot and the tile crops). Dancers are fine (max 2 labels).
Shots: `$SP/shots/after-djs-label-overflow-tile-390.png`, `$SP/shots/after-djs-label-overflow-tile-360.png`.

Shots: `$SP/shots/after-dancers-390.png`, `$SP/shots/after-djs-390.png` (full page, 390x844 @2x). Before: `$SP/shots/before-*-390.png`.

### 2. C1 — badges RPC blocked
Route intercept `**/rest/v1/rpc/get_public_people_badges_v1**` -> HTTP 500. pathname /dancers, h1 "Meet Dancers".
- RPC calls intercepted: 2; tiles rendered: **164**; "No dancers yet" count: **0**; role labels shown: 0. PASS.
- Note: with badges working the page shows 92 tiles (onlyDancers filter); blocked, it falls back to all 164 unfiltered rows, which
  includes test-looking rows ("Doortest", "test 4") at the top. Expected per the code comment, but visible in degraded mode.
- Shot: `$SP/shots/after-dancers-badges-blocked-390.png` (viewport).

### 3. 7h — footer strip colour
Measured after scrolling to the bottom; band = 8px strip 2-10px above `<footer>` top, sampled from the screenshot.
| case | client nav? | html bg (computed / inline) | body bg | band above footer (pixels) | footer |
|---|---|---|---|---|---|
| / (redirects to /city/london-gb) -> click FAQ link -> /faq, h1 "Bachata in London — FAQ" | yes (window marker kept) | rgb(14,18,21) / rgb(14,18,21) | rgb(14,18,21) | rgb(14,18,21), 100% uniform | rgb(255,166,0) |
| /dancers (dancer ground) -> click FAQ -> /faq | yes | rgb(14,18,21) | rgb(14,18,21) | rgb(14,18,21), 100% uniform | rgb(255,166,0) |
| /faq direct load (reference) | - | rgb(14,18,21) | rgb(14,18,21) | rgb(14,18,21) | rgb(255,166,0) |
| /event/4ec7a3d5-02bb-4e80-9439-9db4766b00b2 | - | transparent / none | rgb(0,0,0) (covered by fixed layers) | 21-27,27-31,29-34 gradient, continuous with content | rgb(255,166,0) |

- Default page band = body = #0E1215 exactly, also after leaving a ground page (ground paint released). Nothing below the footer
  (footer bottom = viewport bottom). PASS.
- Legacy event: id resolves (canonical replace) to /event/pura-nights-ealing, h1 "Pura Nights, Ealing". The ~160px gap between the
  last content and the footer is painted by the fixed bento gradient layers (elementFromPoint there = BODY; fixed layers z -10/-20/-50);
  pixels at x=10/195/380 from footerTop-140 to footerTop-4 vary smoothly 21..27 (R), no distinct strip. Black body bg not visible. PASS.
- Shots: `$SP/shots/after-footer-clientnav-faq-390.png`, `$SP/shots/after-footer-clientnav-dancers-to-faq-390.png`,
  `$SP/shots/after-footer-direct-faq-390.png`, `$SP/shots/after-footer-event-legacy-390.png`, `$SP/shots/after-event-legacy-top-390.png`.

### 4. Profiles
- /djs/bccc8a0c-... -> canonical /djs/carlos-de-la-cruz, h1 "DJ Carlos De La Cruz": no photo, vinyl label "DC"; elementFromPoint at the
  initials' centre = the initials span; 9x9 spindle dots in DOM: 0. PASS. Shot `$SP/shots/after-dj-hero-bccc8a0c-daec-414d-ad21--390.png`.
- /djs/8cbced3d-... -> /djs/daniel-carbonero, h1 "Daniel Carbonero": has photo_url (blocked by proxy), so no vinyl initials.
  Shot `$SP/shots/after-dj-hero-8cbced3d-c437-4e0d-bc71--390.png`.
  (The script's strict pathname check flagged both DJ loads only because the id URL is canonicalised to the slug; h1 correct.)
- Current-year start (prod read-only: dancing_role_details.dance_started_year = 2026 -> 2 rows; null 166, 2025 2, 2024 1):
  /dancers/bdd57723-... -> /dancers/unclaimed-bdd57723, h1 "Thanos": "New this year" shown, "0 years" absent.
  /dancers/797fab23-... -> /dancers/unclaimed-797fab23, h1 "Chi-Wei": same. PASS.
  Shots `$SP/shots/after-dancer-newyear-bdd57723-390.png`, `$SP/shots/after-dancer-newyear-797fab23-390.png`.

### Failures
1. /djs role labels clipped on 25/40 tiles at 390 (5px) and 360 (10px): "Teacher DJ Dancer" renders as "'eacher DJ Dance".
### Not verified
- Real photos (proxy blocks photo hosts). Real phone. Before (origin/main) measures were not re-run; only before PNGs exist.
- A fixed `z-[10000]` overlay div (bg rgba(0,0,0,0.82)) exists in the DOM on the event page, but it is not visible in the shots.

### Final re-measure (2026-10-21, final working tree)
- `$SP/wt-after` refreshed: checkout + clean, `git diff HEAD --binary` (after2.patch) applied on HEAD 1f00b24, 2 untracked files copied
  (`linkProfileTypeOneCopy.test.ts`, `tests/searchV7PeopleImportFail.test.ts`). All 384 changed/untracked files cmp-identical to the main
  tree except the CRLF-only `directoryAttendance.today.test.tsx.snap` (copied over, then identical). DJs.tsx:130 / Dancers.tsx:369 carry
  `mt-auto pt-1 min-h-[26px] box-content flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5` (no overflow-hidden).
- Build with prod anon env exit 0 (`$SP/notes/build-final.log`), prod ref baked in, `min-h-\[26px\]` in root CSS. Served on 4173
  (`/no-such-page` 404), node pid stopped with kill -INT; 4173 refuses afterwards.
- Script `$SP/scripts/qa-final.mjs` (lists + C1 from qa.mjs; clip test = row.scrollWidth > row.clientWidth OR any label rect outside
  the row or tile OR label scrollWidth > clientWidth). Raw `$SP/notes/qa-final-raw.json`. Exit 0, failures [].

| measure | /dancers 390x844 | /dancers 360x640 | /djs 390x844 | /djs 360x640 |
|---|---|---|---|---|
| pathname / h1 | /dancers / "Meet Dancers" | same | /djs / "Bachata DJs" | same |
| tiles | 92 | 92 | 40 | 40 |
| doc scrollWidth / clientWidth | 390/390 | 360/360 | 390/390 | 360/360 |
| horizontal scroll | no | no | no | no |
| names cut | 0/92 | 0/92 | 0/40 | 0/40 |
| label row height | 29px (all) | 29px | 29px (all, incl. 2-line) | 29px |
| labels per tile -> lines | 0:21, 1:46 (1 line), 2:25 (1 line) | same | 1:4, 2:11 (1 line), 3:25 (**2 lines**) | same |
| clipped label rows | 0 | 0 | **0/40** (was 25) | **0/40** (was 25) |
| Playing soon | 0 | 0 | 17; rgb(252,211,77) on rgb(10,8,11) = 13.84:1 (12px/600), pixel bg = computed | same |
| elementFromPoint tile centres | 92/92 | 92/92 | 40/40 | 40/40 |
| tile heights (px:count) | 114:68, 129:24 | 114:42, 128:47, 143:3 | 144:19, 159:3, 165:15, 180:3 | 144:19, 158:3, 165:12, 180:6 |

3-label tile (Daniel Carbonero): "Teacher DJ" / "Dancer" on two centred lines, row rect 20.3-123.2 x 441.4-470.8 at 390; label rects all
inside (Dancer bottom 470.7 <= 470.8). Note: a first pass also tested row.scrollHeight > clientHeight and flagged 25 rows (30 vs 29) --
integer rounding of a 29.39px box (pt 3.39 + 26 content), labels verified inside by rect; dropped from the criterion.
Two-line rows fit inside min-h 26px (12 + 2 + 12), so the row height did not grow; the 3-label tiles are not taller than before.

C1 (badges RPC -> 500): intercepted 2 calls; pathname /dancers, h1 "Meet Dancers"; tiles **164**; "No dancers yet" **0**; labels 0. PASS.

Shots: `$SP/shots/final-djs-390.png`, `final-dancers-390.png`, `final-djs-360.png` (full page), `final-djs-3label-tile-390.png`,
`final-djs-3label-tile-360.png`, `final-dancers-badges-blocked-390.png`, `final-djs-390-midcrop.png`.
Not verified: real photos (proxy blocks photo hosts), real phone.


## Appendix: data-before

### Data + "before" shots (2026-10-21), read-only

All SQL: Supabase MCP execute_sql, project stsdtacfauprzrdebmzg, SELECT only (plus STABLE read functions), counts only.

### A1. Pura Nights Ealing legacy event id
`/event/4ec7a3d5-02bb-4e80-9439-9db4766b00b2`
(event_series_p5.legacy_event_id; the series id is 00730598-fd66-4a1a-90c6-e3f1b027336e, lifecycle live.)
There is no `events` table any more; the id lives in `event_series_p5.legacy_event_id`.
    select id, legacy_event_id, lifecycle_status from event_series_p5
     where legacy_event_id::text like '4ec7a3d5%' or name ilike '%pura nights%ealing%';

### A2. Programme people without a usable dancer_profiles row
Programme people come from event_view_p5 / get_occurrence_program_v1 (ScheduleBlock), which read
`event_series_program_people_p5` (via item -> series) plus `event_occurrence_added_session_people_p5`
(via added_session -> occurrence). `profile_id` is what goes to `get_public_people_badges_v1`. That RPC returns a row only
when `dancer_profiles.id = id AND coalesce(is_active,true) AND archived_at IS NULL`.
"Upcoming" means the series is lifecycle 'live' and has a 'scheduled' occurrence (for added sessions, that occurrence) dated
on or after today in London.

| status of the profile_id (kinds dj/dancer/teacher) | distinct ids | on upcoming | slots (upcoming) | series (upcoming) |
|---|---|---|---|---|
| **no dancer_profiles row at all** | **0** | **0** | 0 | 0 |
| row archived (archived_at set) -> no badge -> no link | **4** (1 dj, 3 teacher) | **3** (1 dj, 2 teacher) | 6 (5) | 4 (3) |
| row inactive | 0 | 0 | | |
| ok (badge returned) | 113 | 54 | 286 (120) | 91 (39) |

Of the 113 ok ids (roles from get_public_person_roles_v1): 37 hold DJ, 27 Dancer-not-DJ, **49 hold neither** (teacher-only
or no role; 1 has an empty role list). Those 49 get no link while the teacher pages are closed, which is by design.
The C6 "no badge = no link" path therefore hits **4 people** today (3 on upcoming events, among them 1 DJ). Raw slot counts:
series dj 77 / 34 ids, teacher 204 / 93, dancer 1 / 1; added sessions dj 1, teacher 8 / 5, dancer 1.
Query (main one):
    with ppl as (
      select pp.profile_id pid, pp.profile_type pt, it.series_id sid, null::uuid oid
        from event_series_program_people_p5 pp join event_series_program_item_p5 it on it.id=pp.item_id
      union all
      select ap.profile_id, ap.profile_type, o.series_id, o.id
        from event_occurrence_added_session_people_p5 ap
        join event_occurrence_added_session_p5 s on s.id=ap.added_session_id
        join event_occurrence_p5 o on o.id=s.occurrence_id
    ), up as (
      select p.*, exists (select 1 from event_occurrence_p5 o join event_series_p5 es on es.id=o.series_id
                           where o.series_id=p.sid and (p.oid is null or o.id=p.oid) and o.lifecycle_status='scheduled'
                             and es.lifecycle_status='live' and o.occurrence_date >= (now() at time zone 'Europe/London')::date) is_up,
        (select case when dp.id is null then 'no_row' when coalesce(dp.is_active,true)=false then 'inactive'
                     when dp.archived_at is not null then 'archived' else 'ok' end
           from (select 1) x left join dancer_profiles dp on dp.id=p.pid) st
      from ppl p where p.pt in ('dj','dancer','teacher'))
    select st, pt, count(distinct pid), count(distinct pid) filter (where is_up), count(*), count(*) filter (where is_up),
           count(distinct sid), count(distinct sid) filter (where is_up)
      from up group by grouping sets ((st,pt),(st));

### A3. Start year ("New this year")
The column is `dancing_role_details.dance_started_year` (person_id = dancer_profiles.id). It is NOT on dancer_profiles. It reaches
the page via src/modules/profile/dancerPublicProfile.ts -> `yearsDancing` -> src/modules/dancer-app/public-page/model.ts.
src/modules/person-page/model.ts does not exist; the public-page model is the one with years.

| | all 180 dancing_role_details rows | 164 active, non-archived dancer_profiles |
|---|---|---|
| dance_started_year = 2026 | 2 | **2** |
| null | 166 | **150** |
| < 2026 | 12 | 12 |
| > 2026 | 0 | 0 |
Every active profile has a dancing_role_details row (0 missing), and there are 0 orphans.

### B. Before shots (origin/main d306e9a, worktree $SP/wt-main, prod build, SSR server)
- /tmp/claude-0/-home-user-bachata-website/21384bfb-5af7-5cbf-a9e6-58568c4c98bb/scratchpad/shots/before-dancers-390.png:
  pathname /dancers, h1 "Meet Dancers", prod data (about 85 tiles; dancer tiles are not <a href> on main).
- /tmp/claude-0/-home-user-bachata-website/21384bfb-5af7-5cbf-a9e6-58568c4c98bb/scratchpad/shots/before-djs-390.png:
  pathname /djs, h1 "Bachata DJs", 40 /djs/ links (matches prod's 40 DJs).
- Recipe: $SP/notes/serve-recipe.md. Shooter: $SP/scripts/shoot.mjs `<base> <prefix>`.

Failures and caveats:
- The first build used the session's VITE_SUPABASE_URL, which is project srrpvuxldthwumzrngla (E2E fixtures), not prod. Those
  shots were discarded and the build was redone with prod's public anon key ($SP/notes/prod-anon.env). There is no .env in the main repo.
- Photos: media.bachatacalendar.co.uk and *.r2.dev fail through the proxy (ERR_TUNNEL_CONNECTION_FAILED), so portraits are
  placeholders. Supabase calls were all 2xx.
- The server first moved to port 4174 because the earlier self-re-exec'd child survived a kill; fixed (see the recipe traps).
  The server is now stopped (port 4173 refuses connections). The worktree is left in place.
- VITE_ENABLE_* flags were unset (= off), which may differ from the prod Vercel env.
