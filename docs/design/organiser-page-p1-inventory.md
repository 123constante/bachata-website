# Organiser page P1 &mdash; fix round 1 inventory

Written BEFORE the fix-round code (brief `docs/briefs/organiser-page-p1-fix1.md`,
brief-version 3). Every field, state and option on the public organiser page,
with where it lives in the admin data, on `main`, and on this branch, and the
GAPs the review (`docs/review/review-organiser-page-p1.md`, verdict FIX) and the
lead's code review found.

Sources and line refs:
- **ADMIN** = the admin app `bachata-admin-11april`. **Not reachable from this
  worker** (`add_repo`: "you don't have access"), so admin file:line is not
  cited; the admin column cites the column / RPC the admin app writes, as
  surveyed on prod in `docs/organiser-page/INVENTORY.md` (A/B rows, 2026-11-05).
- **MAIN** = `src/pages/OrganiserProfile.tsx` on `origin/main` at `0707a59`.
- **BR** = `src/pages/OrganiserProfile.tsx` on this branch at `78763fb`
  (pre-fix head); `GIT` = `src/modules/profile/OrganiserGetInTouch.tsx`,
  `TEAM` = `src/modules/profile/OrganiserTeamSection.tsx`,
  `STRIP` = `src/modules/profile/OrganiserStatsStrip.tsx`.
- **Matrix** = `src/modules/profile/__tests__/organiserPage.matrix.test.tsx`
  after this round (Y = a table row asserts it; T = a dedicated test).

## Rows

| # | Field / state / option | ADMIN (data) | MAIN | BR (pre-fix) | GAP | Matrix |
|---|---|---|---|---|---|---|
| 1 | Name (hero h1) | `organiser_profiles.name` (INVENTORY A1) | hero | hero | &mdash; | Y |
| 2 | Bio &rarr; About only when written | `bio` (A3) | About | BR:1308 | &mdash; | Y |
| 3 | Founded year &rarr; "Running since" | `founded_year` | sinceYear estimate MAIN:906 | stats mapping | &mdash; | Y |
| 4 | Instagram row | `instagram` / `socials.instagram` | MAIN:1115 | BR:1063, GIT:46 | &mdash; | Y |
| 5 | Website row | `website` / `socials.website` | MAIN:1122 | BR:1070, GIT:46 | &mdash; | Y |
| 6 | WhatsApp row | `contact_phone` via `get_organiser_public_contact_v1` | MAIN:1209 | GIT:46 | &mdash; | Y |
| 7 | Email row | `contact_email` via same RPC | MAIN:1210 | GIT:46 | &mdash; | Y |
| 8 | Facebook (not a row, E2) | `facebook` / `socials.facebook` | row on main | not a row; dead `extractFbHandle` import BR:15 | **GAP L3**: dead import | T (no Facebook text) |
| 9 | Contact RPC fails (E9) | &mdash; | silently degraded (`fetchPublicContact` MAIN:751) | GIT:117 error line + Try again | &mdash; | Y |
| 10 | `hasContact` when contact read failed | &mdash; | MAIN:1133 (boolean) | BR:1083 `rows.length > 0` | **GAP L2**: false when merely unknown &rarr; owner sees "Complete your profile" | Y (owner rows) |
| 11 | Team member list | `organiser_team_members` (is_active) + `dancer_profiles` | MAIN:794 | BR:715 | &mdash; | Y |
| 12 | Team `dancer_profiles` read fails | &mdash; | ignored | BR:732 error ignored | **GAP L1 / LOW-4**: false "no team" | Y |
| 13 | Team roster read fails | &mdash; | MAIN:1554 error line | TEAM error line | &mdash; | Y |
| 14 | Nationality flag on each circle | `dancer_profiles.nationality` (code) | MAIN:457 (`size 80`) | gone (BR:732 drops the column) | **GAP MED-1** | Y |
| 15 | Role-aware link (DJ / teacher page) | `people-badges` read | MAIN:444 `linkRoleFor` | TEAM always `/dancers/<id>` | **GAP MED-2** | T (link per role x flag) |
| 16 | Profile-view emit typed by link role | &mdash; | MAIN:471 | TEAM `profileType 'dancer'` | **GAP MED-2** | T |
| 17 | Badges loading / errored fallback link | &mdash; | MAIN feedFallback | n/a | restored with 15 | T |
| 18 | Team role tags / title | `organiser_team_members.role` | MAIN tags + title | none (ACCEPTANCE: no role labels) | &mdash; (by decision, not restored) | Y (no tags) |
| 19 | Team "+N more" (cap 6) | &mdash; | none | TEAM overflow | &mdash; | covered by `organiserTeam` unit tests |
| 20 | Stats: next night | future feed | "Upcoming dates" tile MAIN:1388 | mapping | &mdash; | Y |
| 21 | Stats: nights hosted / last night | past feed | tile | mapping | &mdash; | Y |
| 22 | Stats: weekly rhythm | both feeds | none | mapping | &mdash; | Y |
| 23 | Stats when ONE feed failed | &mdash; | per-tile `failed` | ALL stats dropped (BR:828) | **GAP MED-3**: per-feed independence; failed-feed stat shows a dash | Y |
| 24 | Next nights list | future feed + events join | MAIN:1497 | BR:1324 | &mdash; | Y |
| 25 | Past nights list / "Recently hosted" | past feed | MAIN:1570 | BR:1374 | &mdash; | Y |
| 26 | Empty `none` "No dates announced yet" | &mdash; | MAIN:1469 | BR:1362 | &mdash; | Y |
| 27 | Empty `past-only` line | &mdash; | MAIN:1482 | BR:1380 nested inside `pastEvents > 0` | **GAP L4** | Y |
| 28 | Empty state on a team-only error | &mdash; | suppressed MAIN:1145 | suppressed BR:1095 | **GAP LOW-5** | Y |
| 29 | Owner-blank "Just getting started" | `entity_members` (canEdit) | MAIN:1454 | BR:1289 | LOW-7 (edit layer owns it later; not this round) | Y (owner rows) |
| 30 | Feed error lines (upcoming / past) + Try again | &mdash; | MAIN:1497/1570 | BR:383 | &mdash; | Y |
| 31 | Try again pending state | &mdash; | none | none (GIT:119, TEAM, BR:383, BR:1013) | **GAP LOW-6** | T |
| 32 | Entity error (E8) | &mdash; | same as not-found | BR:1005 | &mdash; | T |
| 33 | Not found + noindex | &mdash; | MAIN | BR:639 | &mdash; | T |
| 34 | Loading skeleton | &mdash; | MAIN | BR | &mdash; | T |
| 35 | Claim card (flag off in prod) | `claim_organiser_v1` | MAIN | BR:1265 | &mdash; | not in matrix (own suite) |
| 36 | Owner create-event link beside "Next nights" | edit layer | MAIN `#upcoming h2 + div` | BR:1330 | stale e2e-phone spec names "Upcoming events" (LOW-9) | e2e-phone only |
| 37 | Flag spec `/organisers/:id` row | &mdash; | 80px circles | 64px circles | stale spec `people-nationality-flag.phone.spec.ts:89` | e2e-phone only |

## Parked (unchanged from P1, not GAPs of this round)

E4 city scope, E5 365-day window, E7 cancelled nights, owners/managers on Team
(`access: []`), hide a person, share link, tickets sold / dancers came inputs
(see `docs/handover/organiser-page-p1.md`). LOW-10 (past-only leads with a
"Last night" stat not named in ACCEPTANCE section 1) and LOW-11 (pop-in /
midnight SSR mismatch) are reported to the owner, not changed.

## Coverage

Rows covered by a matrix test (Y or T in `organiserPage.matrix.test.tsx`):
**33 / 37**. Not in the matrix: 19 (organiserTeam unit tests), 35 (claim
suite), 36 + 37 (e2e-phone specs, updated this round). Row 18 is asserted as
an absence only.
