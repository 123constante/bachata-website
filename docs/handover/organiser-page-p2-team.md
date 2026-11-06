# Handover: organiser page P2 (Team) -- code complete, awaiting lead walk + review

## Continuation 4 (ticket dt_b788ae89c0a4, brief `organiser-page-p2-team-4.md`)

Done:
1. Merged `origin/main` (96c4f5d, #1438 nights cards). Git auto-merged `OrganiserProfile.tsx`
   with no conflict: main's header bio + NightsCard/PastHighlights and this branch's public
   team read (`fetchOrganiserPublicTeam` + the flags read) are both kept.
2. `phone-qa` red, cause found: the page now reads the Team from `organiser_public_team_v1`
   (publicTeamApi.ts), and `tests/e2e-phone/fakeSupabase.mjs` did not list that RPC, so the
   fake answered `[]` -> no Team -> `[data-nationality-flag]` never appeared (the 15 s waitFor).
   Not a real-visitor bug: prod answers the RPC. Fix: the fake now answers
   `organiser_public_team_v1` for ORG3 with the same six people (person_id = dancer id, slug,
   public_name, avatar_url, sort_key 0..5), so the flags come from the existing
   `dancer_profiles` fixture. The spec is UNCHANGED (assertion not touched).
   Prod shape checked read-only: `TABLE(person_id uuid, slug text, public_name text,
   avatar_url text, sort_key integer)`; on the 3 largest teams, 8/8 person_id are
   `dancer_profiles.id`, 0 null slug, sort_key 1..3, 5/8 have a nationality.

Local: `people-nationality-flag.phone.spec.ts` 32 passed / 32 skipped (per-viewport
duplicates), including "/organisers/:id Team" taps-through and "clear of every sticker";
`organiser-team-picker.phone.spec.ts` 12 passed. tsc 0 errors (whole project). vitest
src/pages src/modules/profile src/modules/organiser/team: 56 files, 1404 tests passed.
check:mojibake clean.

/code-review (low) on the merged branch: 2 findings, both in main's #1438 code, not this
branch's, left for a follow-up (out of this brief's scope): `buildEventRowProps` /
`countdownLabel` in OrganiserProfile.tsx now look unused; and a past-year chip tapped a second
time after the year was collapsed by hand does not reopen it (`openPastYears` only grows).

Not verified: CI on the new head (reported in the PR after push); a browser walk on the
real prod RPC (the phone suite runs on the fake).

## Continuation 3 (ticket dt_4491c895e2fd, brief `brief/organiser-page-p2-team-3`)

Done:
1. `scripts/onboarding-write-doors.json`: one `not_event_writes` entry,
   `set_organiser_team_member_hidden_v1` / "Organiser-page team visibility, not an event edit."
   (same shape as `organiser_team_set_public_v1`). Nothing else under `scripts/` touched.
   `npm run check:onboarding-write-doors`: 0 violations (was 1, `publicTeamApi.ts:107`).
2. Merged `origin/main` (PR was `dirty`: #1436 heroBio vs this branch's import cleanup in
   `OrganiserProfile.tsx`). Resolution keeps `heroBio` and drops `withPublicNames` /
   `resolvePublicName`, which nothing in the file calls any more.
3. `w1S3Strips.test.tsx` (on main, untouched until now) still passed `overflow: []` to `TeamList`,
   which this branch removed -> one new tsc error caused by this branch. Removed the key; no
   behaviour change.

CI per job (GitHub, head 53de75c = item 1 only; merged with main by `pull_request`):

| Job | 30ae8f9 | 53de75c | Why |
|---|---|---|---|
| integrity (architecture-guard) | red | green | item 1 (write-door guard step) |
| contract-check (db-contract-check) | red | green | item 1 (onboarding write-door step) |
| phone-qa | red | green (12 passed) | not caused by item 1; red not reproduced, cause unknown |
| build-smoke, e2e-smoke, bundle-budget, unit x3, real-data-verified, phone-qa-section, wallclock-brand, live-db-gate, bom-check, masking/notification-check, dancer-area-isolation | - | green | |

Local, every step of the integrity job on 53de75c: all 16 steps green. The contract-check
steps were also run locally but this container's Supabase secrets point at a non-prod project
(precheck fails), so those local results do not count; the CI run against prod is the evidence.

Pre-existing, proven identical on origin/main 0d1d4f1 (not fixed here):
- `npm run typecheck`: 119 errors on main, 119 on the branch, diff of the normalised lists empty
  (incl. `TeamPicker.test.tsx` TS2493, line 297 on main / 302 here).
- eslint: EditInPlaceLayer.tsx 4 errors (refs during render x2, setState in effect x2) and
  OrganiserProfile.tsx 1 (setState in effect), same rules on main.
- `npm run lint`: 34 of 34 links green (trailing whole-tree eslint is informational).

Bundle budget (`npm run build` + `npm run check:bundle-budget`, all routes ok on both):

| Route | main (df4b1bd) | branch (53de75c) | budget KB |
|---|---|---|---|
| home | 207.6 KB | 207.7 KB | 215 |
| event | 375.9 KB | 376.0 KB | 381 |
| auth | 294.1 KB | 294.2 KB | 310 |
| dancer-app | 372.9 KB | 372.9 KB | 374 |
| parties / classes | 267.1 KB | 267.2 KB | 325 |
| faq / landing prose / landing style | 233.2 / 233.4 / 232.4 KB | 233.2 / 233.4 / 232.5 KB | 245 |

Puller and chunk ratchets identical. (Main measured at df4b1bd before #1436 landed; branch at 53de75c.)

Verified: write-door guard green; integrity + contract-check + phone-qa green in CI; typecheck and
eslint identical to main; vitest organiser + profile + pages + person-page 352 files, 13802 passed
on the merged tree; lint chain 34/34; check:mojibake.

Not verified: 390x844 browser walk (owner + manager + listed, hide-then-show) -- done by the lead;
a real hide/show on prod (would write); local phone suite (timed out at 10 min in this container,
several 360x640 specs failing locally across unrelated pages -- CI phone-qa is green); `/code-review`
round; pre-ship; CI on the final merged head (pushed last, results not awaited).

Left: lead browser walk, independent review, owner Approve at head.

---

## Continuation 2 (ticket dt_8531fa9ec8fc, brief `brief/organiser-page-p2-team-2`)

Done (brief items 1-4):
1. Team sheet list: `TeamVisibilitySheet.tsx` + pure `teamVisibilityModel.ts`. The Team card gets
   "Who shows on your page" for owner, admin, manager and the self arm (`visibilityAccess`); "Add a
   person" stays owner/admin. Rows: owner seats, manager seats, listed (public `sort_key`), hidden
   listed (named from `dancer_profiles`). Hide / Show only where `canSetHidden()` says. Hidden-read
   error -> "Couldn't check who is hidden. Try again", no controls. Both keys invalidated after each
   call. `parseTeam` now reads `person_id` from `organiser_team_v1`. Status says "Shown" only when the
   public read has the person (else "Not on the public page right now"; draft page, archived profile).
2. `docs/design/organiser-page-p2-team.md` with the Step 0 coverage table.
3. Shape survey (counts only) in the design doc and PR body: 17 owner / 43 manager / 0 contributor
   seats; 41 of 60 seats on inactive team rows (matches #1259); 2 seats without persona; 0 hides.
4. `teamVisibilitySheet.matrix.test.tsx`: 5 callers x 5 targets x (hide, show) through the real sheet
   against an independent truth table, plus states. Red first: on the checkpoint code 6 red (found a
   real bug: a hidden contributor who is also listed vanished); with the manager rule mutated 2 red.

BLOCKER for green CI (needs lead): `check:onboarding-write-doors` (lint chain, architecture-guard +
db-contract-check) fails: `publicTeamApi.ts` names `set_organiser_team_member_hidden_v1`, which is not in
`scripts/onboarding-write-doors.json`. The fix is one `not_event_writes` entry (reason: "Organiser-page
team visibility, not an event edit.", like `organiser_team_set_public_v1`); the brief forbids `scripts/`.

Self arm reach: the edit layer mounts on `canEdit` (owner/manager) only, so a listed-only person (P5)
or contributor cannot reach the sheet on this page; not widened (brief).

Left: browser walk 390x844 (owner + manager + listed, hide-then-show on an owner-named test organiser),
full CI job table, bundle budget main vs branch, `/code-review` round, the write-doors entry above.
Pre-existing, not from this branch: 4 eslint errors in EditInPlaceLayer.tsx (same on main), the
TeamPicker.test.tsx(297) tsc error (same on main).

---


Ticket dt_e1c70f458d06. Branch `claude/organiser-page-p2-team`. Stopped at the
context gate (owner rule: 45-50%). Brief: `brief/organiser-page-p2-team` v4.

## Done
- Dispatch gate checked on prod (read-only, 2026-11-06): `organiser_public_team_v1`,
  `organiser_team_hidden_v1`, `set_organiser_team_member_hidden_v1`,
  `organiser_team_v1` all exist; bodies read. P1 (#1399) is on main.
- Read side: `/organisers/:id` Team section now reads `organiser_public_team_v1`
  (`fetchOrganiserPublicTeam` + refusing parser in `src/modules/organiser/team/publicTeamApi.ts`,
  key `organiserPublicTeamKey`). Rows map through `teamFromPublicRows()` in
  `src/modules/profile/organiserTeam.ts`.
- **Single source of order: the RPC's `sort_key`** (`row_number() OVER (ORDER BY tier,
  sort_order NULLS LAST, lower(name), pid)` -- owners, managers, listed by sort_order,
  then name; F2 is fixed in the applied body). The page only sorts by `sort_key`.
- No cap: `TEAM_VISIBLE_CAP`, `overflow` and the "+N more" button are gone; matrix updated.
- Repeated `person_id` renders once (test). Links by slug, else dancer id.
- Error: the RPC failing shows "Couldn't load the team" + Try again (unchanged line).
  Flags now come from a separate `dancer_profiles(id, nationality)` read; its failure
  only drops flags and never fails the Team (page matrix updated to say so).
- `canSetHidden()` (`src/modules/organiser/edit-in-place/teamHide.ts`): the ONE hide/show
  rule, mirroring the applied RPC (owner: anyone; manager: never an owner; self arm;
  seatless admin, contributor, stranger, signed-out: no control; target without persona: no control).
  Matrix `__tests__/teamHide.matrix.test.ts`: caller x target x (hide, show), 131 cells.
- API for the sheet (not yet drawn): `fetchTeamHidden` / `organiserTeamHiddenKey`,
  `setTeamMemberHidden` (changed:false = success), `HIDE_ERROR_COPY` + `hideErrorMessage`
  (six codes pinned to the RPC HINTs; unknown/network -> generic team error), all tested.
- ACCEPTANCE section 7: E4, E5, E7 rows recorded as decided (owner 2026-11-05). Nothing else in that file.
- Two different facts, both honoured by the public list: the person's own opt-out
  (`organiser_team_set_public_v1`, an inactive team row) vs the hide flag
  (`organiser_team_public_hides`, set by owner/manager/self).

## Left (next worker, in order)
1. Team sheet list with Hide / Show buttons (scope 4/4a): read `organiser_team_v1`
   members (+ `person_id`) and the listed rows, mark "Hidden from the public page" from
   `fetchTeamHidden`, draw controls only where `canSetHidden()` says so, invalidate
   `organiserTeamHiddenKey` + `organiserPublicTeamKey` together after each call;
   hidden-read error -> "Couldn't check who is hidden. Try again" and NO controls.
   Touch points: `EditInPlaceLayer.tsx` (teamQuery, TeamCard slot), `TeamCard.tsx`, `TeamSheet.tsx`.
   Note `TeamCard` today renders only for owner/admin (`teamPickerAccess`); managers and
   the self arm need a path to the control (design decision for the lead).
2. Design record `docs/design/organiser-page-p2-team.md` with the Step 0 coverage table
   (ACCEPTANCE s1 Team, J3, J7, E11, s6 Team states) -- NOT written.
3. Shape survey detail (owners/managers/listed split, seats on inactive rows) vs #1259's 41/60.
4. Browser walk 390x844 (owner+manager+listed, solo, hide-then-show on an owner-named test organiser).
5. Full CI job table, bundle budget on main vs branch, impeccable-finish review round.

## Survey (prod, read-only, counts only, 2026-11-06)
Live organisers by `organiser_public_team_v1` row count: 1 row: 5, 2 rows: 36, 3 rows: 9
(50 organisers; none empty, none over 3). Owners/managers now appear (P1 showed only listed people).

## Checks (this push)
- vitest src/modules/organiser + src/modules/profile + src/pages: 324 files, 12729 passed.
- check:mojibake, check:rpc-typing: pass.
- tsc run on the final branch head (`tsc -p tsconfig.app.json`): 0 new errors in branch files; the one
  hit in a touched file (OrganiserProfile.tsx `ep.city`) is an unchanged line from main. 139 repo-wide.
- Refusal copy follows the RPC HINTs with "organiser" said as "page" (consistency matrix G3).
- NOT run: full CI job table, e2e smoke, bundle budget, pre-ship, browser walk, review round.
