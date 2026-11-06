# Handover: organiser page P2 (Team) -- PARTIAL

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
