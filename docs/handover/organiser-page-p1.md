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
