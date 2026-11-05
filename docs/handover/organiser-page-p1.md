# Handover &mdash; organiser public page P1

Branch `claude/organiser-page-p1`. Brief `docs/briefs/organiser-page-p1.md`
(branch `brief/organiser-page-p1`). Contract `docs/organiser-page/ACCEPTANCE.md`.
Design record + coverage table: `docs/design/organiser-page-p1.md`.

## What shipped

- **S1** stats strip = `organiserStats()` (merged, unchanged) in
  `src/modules/profile/OrganiserStatsStrip.tsx`; first 3 that qualify, no strip
  when none. The old 0 / `--` strip, the `sinceYear` estimate and the
  team-count stat are deleted (E10). Dead Verified badge deleted (E1). Order:
  hero, stats, Get in touch, Team, About, Next nights, Past nights.
- **S2** `src/modules/profile/OrganiserGetInTouch.tsx`: `buildContactRows()` is the
  one mapping; rows WhatsApp, Instagram, Website, Email, each a 44 px link +
  44 px Copy. No Facebook row (E2). No rows = no section. Contact RPC error
  keeps the stored-link rows and shows "Couldn&rsquo;t load WhatsApp and email.
  Try again" (E9) &mdash; via the new `fetchPublicContactOrThrow` in
  `ownershipApi.ts` (the old `fetchPublicContact` keeps its degrade contract).
  "Online" pills gone (E13).
- **S3 read** `src/modules/profile/OrganiserTeamSection.tsx` mounts
  `buildOrganiserTeam()` (merged, unchanged). `listed` = the page&rsquo;s
  existing `organiser_team_members` read (active rows only); **`access` is
  passed as `[]`** because owners/managers are not publicly readable yet
  (needs an admin RPC). No role labels; `TeamCircle` + `usePeopleBadges` use on
  this page removed (and their 4 test blocks in `w1S3Strips.test.tsx`). A person
  links to `/dancers/<dancer id>`; emits `emitProfileView` on tap. A member with
  no public name is left out (the mapping&rsquo;s rule; it used to show "Team member").
- **S5** loading skeleton unchanged (no headings, no numbers); entity read error
  shows "Couldn&rsquo;t load this organiser" + Try again, no noindex (E8); a failed
  feed gives the stats mapping no nights at all (only a real founded year can
  still show); every feed failing still renders hero + Get in touch + Team.
- **S4 copy** "No nights listed yet" / "No upcoming nights" boxes replaced by one
  quiet line "No dates announced yet." + Browse upcoming nights; past-only pages
  title the past list "Recently hosted". "elsewhere in London" removed &mdash; the
  copy names no city (E6).

## Data sources (read-only on prod `stsdtacfauprzrdebmzg`, 2026-11-05)

| Section | RPC / table | Columns | Written by |
|---|---|---|---|
| Hero, About, Running since | `organiser_profiles` (direct select, `fetchOrganiserEntity`) | name, avatar_url, bio, founded_year, city_id&rarr;cities.name, organisation_category | admin app + owner edit layer |
| Get in touch: Instagram, Website | same row | instagram / website, else socials.instagram / socials.website | admin + owner edit layer |
| Get in touch: WhatsApp, Email | `get_organiser_public_contact_v1` (reads only `organiser_profiles`) | contact_phone gated by show_phone_publicly; contact_email gated by show_email_publicly | admin (email); owner (phone + switches) |
| Next / Past nights, stats | `get_organiser_public_events_v1` (event_series_p5, event_series_organiser_p5, venues, cities) + `get_organiser_calendar_events_v1` (organiser_profiles, cities, event_series_p5 &rarr; `get_calendar_events_v2`) | occurrence start, is_cancelled, is_past | admin event editor |
| Team | `organiser_team_members` (is_active = true) + `dancer_profiles` + public-name mask | member_profile_id, sort_order, first_name, avatar_url | admin + owner Team sheet |

## Parked (each needs someone else)

- **E4 city scope, E5 365-day window** &mdash; ticket for ADMIN: `get_organiser_calendar_events_v1`
  passes the organiser&rsquo;s city slug and the default `p_to` (+365 d) to
  `get_calendar_events_v2`; 6 organisers have nights in another city, 4 have
  dates past +365 d. Needs an organiser-scoped, city-free feed (or an explicit
  horizon/count). This repo owns no migrations.
- **E7 cancelled nights** &mdash; proposed, awaiting the owner; left as on main (hidden).
- **Owners/managers on Team** &mdash; needs an admin RPC returning public names +
  dancer ids of `entity_members` owners/managers; then pass it as `access`.
- **Hide a person** (J7), **share link** (J5), **owner counts view** &mdash; later slices.
- **Tickets sold / Dancers came** stats: inputs passed as null (not read today;
  0 organisers qualify on prod).
- E12 (one past-window constant) stays with S4.

## Next steps

1. Lead: Design Gate on the design record; independent critique (one round).
2. Admin ticket for E4/E5 and the owners/managers public read.
3. Owner: confirm E7.

## Continue run 2026-11-05 (dt_5a26e72eea03) &mdash; checks

Earlier run (verified in sandbox, unchanged): shape survey on prod 2026-11-05
matched ACCEPTANCE section 3; `organiserPage.matrix.test.tsx` 19/19 green and
15/19 red on unfixed `main`; `npm run lint` exit 0; mojibake clean.

**Bundle budget (brief item 1).** `npm run check:bundle-budget` green on both.
/app first load (dancer-app, 47 chunks, same chunk set on both):
main `d825190` 381,389 B gz; branch merged onto main 381,408 B gz (+19 B).
The +19 B is hash-name churn only: with the 8-char chunk hashes normalised the
47 files are byte-identical in raw size (1,196,089 B both); 44/47 identical in
content, the other 3 differ only by minifier export-alias letters
(`ah as Os` vs `ag as Os`). **Zero bytes of code added to /app first load.**
The organiser route chunk grows 18,652 &rarr; 20,128 B gz (lazy, own route) and a
41 B `programDayRollover` chunk split out (lazy).

**pre-ship.** 41 PASS, 2 FAIL, 3 SKIP. Both FAILs reproduce on unchanged main:
- `test:unit`: 15 failures in 4 files (`eventViewCompat`, `occurrenceProgram`,
  `publicEventPageLineup` live-DB contract suites; `integrityCouldNotRun`
  sandbox TS-helper precondition). Same 15 fail on `main` in this sandbox.
- `typecheck` ratchet: was 113 vs baseline 106. **4 were this branch** (TS2739
  in `organiserPage.matrix.test.tsx`, the `shape()` helper typed `feeds` as
  complete) &mdash; **fixed** (helper now takes `Partial` feeds). Now 109 =
  main&rsquo;s own count; main is itself +3 over the pinned 106 (not this branch).
- e2e smoke skipped by pre-ship (earlier fails); run directly, see table.

**OrganiserProfileEmpty.matrix.test.tsx (item 7): KEPT as is.** Smallest safe
choice: it passes, and it pins the `organiserEmptyState()` kinds directly,
which the new page matrix only reaches through rendering. Folding is churn
with no coverage gain.

| CI job | Step(s) run locally | Result |
|---|---|---|
| perf-budget / bundle | build, bundle-budget (+self-test), first-load-requests (+self-test), chunk-cycles (+self-test) | green |
| perf-budget / lighthouse, doc-weight | needs a deployed preview | not run (no preview, per brief) |
| architecture-guard | integrity, legacy-tables, legacy-program-rpcs, onboarding-write-doors, lint:architecture, check:images (AUDIT_STRICT=1), image-widths, plan-hygiene self-test, workflow-artifact-policy, p3-specs-not-skipped, mojibake self-test, prove:entry-point (+self-test), going-legacy-rpcs | green |
| typecheck | rpc-typing, wallclock-brand, tsc count | rpc/wallclock green; tsc 109 = main |
| unit-tests | vitest full; dancer-area-isolation (+self-test) | 15 env fails, same on main; isolation green |
| e2e-smoke | test:e2e | 178 pass, 4 fail: 2 `account-settings` fail on main too; `dancer-home:169` passed on rerun; `organiser-onboarding:143` (/faq Sign in hydration race) flaky on BOTH (main 2/16 fail, branch 0/16) |
| e2e-smoke p3 | test:e2e:p3 | 6 pass, 16 fail, 103 skipped (serial): 14 in `walk-p3-series-pictures` (same spec fails on `main` here, 3/3 tried) + 2 in `walk-p3-wt-states:46` (organiser studio; not re-run on main &mdash; context gate). Diff touches neither surface |
| phone-qa | playwright.phone / playwright.build configs | not run (context gate) |
| workflow-lint | no-preview-prefixes, workflow-masking, workflow-notification (+self-test), docs-only self-test | green |
| phone-qa-section | check-pr-phone-qa self-test | green |
| db-contract-check | live DB with service key | not run: diff has no schema/RPC change (only a new caller of existing `get_organiser_public_contact_v1`) |

Head is 1 commit behind `main` (#1389) and merges clean (`git merge-tree`).

Left for the lead: `/code-review`, the 390x844 walk (`incognito-dance`,
`anna-galenda`, `tropicana`, `bachata-community`), independent critique, the PR
body&rsquo;s Phone QA block.

## Fix round 1 (dt_0dbdb1180ff6) &mdash; review FIX + lead code review

Brief `docs/briefs/organiser-page-p1-fix1.md` (brief-version 3). Review
`docs/review/review-organiser-page-p1.md` (branch `claude/review-organiser-page-p1`).
Inventory written first: `docs/design/organiser-page-p1-inventory.md` (37 rows,
coverage 33 / 37). Branch merged with `main` (#1389, #1398) first.

**1. Error truthfulness.**
- (a) `dancer_profiles` read error now THROWS in the Team query &rarr; "Couldn&rsquo;t load the team" + Try again, never "no team" (L1 / LOW-4).
- (b) `hasContact` is `true | false | null`: null (unknown) when the contact RPC failed and no stored link shows; `organiserEmptyState` takes `hasContact` / `team` as nullable and only says `owner-blank` when both are KNOWN empty (L2).
- (c) a team-only failure no longer suppresses `emptyKind` (only a failed NIGHTS feed does) &mdash; it passes `team: null` (LOW-5).
- (d) the `past-only` line also renders as its own block when `pastEvents` is empty (L4). Note: `organiserEmptyState` only returns `past-only` when `past > 0`, so today that block is structurally safe rather than reachable; no test can reach it through the page.
- (e) stats per feed: new `src/modules/profile/organiserStatsByFeed.ts` wraps the unchanged `organiserStats()`. Future failed &rarr; "Next night" is a dash, no "Last night", no "Every week"; past failed &rarr; "Nights hosted" is a dash, no "Every week", no estimated "Running"; a real founded year always stays. The dash is `data-stat-failed`, an aria label "&hellip;: couldn&rsquo;t load", never the tappable Next night. **Matrix row `:180` (past feed fails) pinned `stats: []`, the old behaviour; it and the "upcoming fails" / "every feed fails" rows now assert the per-feed answer** (MED-3). `OrganiserProfileFeedError.matrix.test.tsx` pinned the same old rule (and read the real clock, which #1398 from main made date-sensitive): updated and clock-pinned.

**2. Team circles restored (lead decision).** From main&rsquo;s `TeamCircle`: the nationality flag on each circle (`dancer_profiles.nationality` read again, `NationalityFlag` at the 64 px circle size) and the role-aware link &mdash; `usePeopleBadges` + `linkRoleFor` / `hrefForRole` (DJ &rarr; `/djs/<id>`, teacher &rarr; `/teachers/<id>` only while teacher pages are open, else dancer), `emitProfileView` typed by that page, and main&rsquo;s loading/error fallback (keeps `/dancers/<id>`, typed dancer; badges answered with no row = no link). Now `src/modules/profile/teamPersonLink.ts`. NOT restored (ACCEPTANCE decision, no role labels): role tags, organiser-authored title. main&rsquo;s TeamCircle tests (link per shape x teacher flag, fallback, typed emit) are back in `w1S3Strips.test.tsx`, rendered through `OrganiserTeamSection`.

**3. Try again pending state.** `src/modules/profile/RetryButton.tsx`: disabled + "Trying&hellip;" while the refetch runs, 44 px. Used by Team, Get in touch, both nights lines and the entity error screen. Needed `src/modules/profile/useStickyFailure.ts`: React Query v5 puts a never-had-data query back to `pending` on refetch, which made the error line (and its button) vanish on tap. Dead `extractFbHandle` and `PUBLIC_LINK_REL` imports and the dead `facebook` socials key in the page&rsquo;s data prep removed (the owner edit modal&rsquo;s Facebook field is live and stays).

**4. Tests.** `organiserPage.matrix.test.tsx` 167 tests: every combination of {events, future, past, team roster, team names, contact} failing (64) x owner / visitor; owner-blank only when known blank; per-feed stats; Team flags + role links; pending state. Each row asserts the visible text and `noCopyWithoutControl()` (every error line has its button, "Complete your profile" has its button, a tappable Next night has its list, a dash is never a button). **Red first: on the unfixed branch (tests only) 151 of 168 failed; with the fix 167 / 167 pass** (one owner row dropped: with no roster rows the names read never runs). Stale specs: `people-nationality-flag.phone.spec.ts:89` now "Team (64px)", sticker 29 px (`stickerSize(64)`); `organiser-name-city-create.phone.spec.ts` heading "Next nights" (asserted).

| CI job | Step(s) run locally | Result |
|---|---|---|
| unit-tests | vitest: organiser page, feed-error, empty, w1S3Strips, person-page, profile, people, edit-in-place (49 files) | 2492 / 2492 pass |
| typecheck | `tsc -p tsconfig.app.json` | no error in any file this round touched (the 2 in touched files, `ep.city` and `organiserCityNameTimeout`, exist on the pre-fix head too) |
| architecture-guard | `check:mojibake` | clean |
| lint | `npm run lint` | exit 0, 34 of 34 links green |
| phone-qa / e2e-phone | the two edited specs | not run (context gate) |
| e2e-smoke, perf-budget | &mdash; | not run this round (context gate); bundle: one new lazy import on the organiser route chunk only (`usePeopleBadges`, `NationalityFlag` were on main) |

**Not verified:** a 390x844 browser walk of this round; the e2e-phone specs I edited; e2e-smoke; bundle budget; a signed-in owner on prod; the admin app (repo not reachable from this worker, so the inventory cites prod columns, not admin file:line).

**For the owner (unchanged):** LOW-7 owner prompts still rendered by the page; LOW-10 past-only leads with "Last night" (not named in ACCEPTANCE); LOW-11 pop-in / midnight SSR mismatch.
