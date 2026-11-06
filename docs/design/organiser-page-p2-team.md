# Design record: organiser page P2 (Team)

Branch `claude/organiser-page-p2-team`, PR #1437. Briefs: `brief/organiser-page-p2-team` (v4 scope),
`brief/organiser-page-p2-team-2` (continuation). Acceptance contract:
`docs/organiser-page/ACCEPTANCE.md`. Person codes (P1..P6) are that file's section 4.

## Decisions

- **One order, from the server.** The public Team is `organiser_public_team_v1` ordered by its
  `sort_key` (owners, managers, listed by `sort_order`, then name). The page never re-sorts.
- **No cap.** Everyone the RPC returns is shown (prod max is 3 rows today; "+N more" removed).
- **One hide rule.** `canSetHidden()` (`src/modules/organiser/edit-in-place/teamHide.ts`) mirrors
  `set_organiser_team_member_hidden_v1`: owner on anyone; manager on anyone but an owner; anyone on
  themself; seatless admin / contributor / stranger / signed-out: nothing; no persona: nothing.
- **Who opens the Hide / Show list (lead, recorded in brief p2-team-2).** Managers and the person
  themself get the control through the same Team sheet. The Team card's "Who shows on your page"
  opens it for owner, admin, manager and the self arm (`visibilityAccess()` in
  `teamVisibilityModel.ts`). "Add a person" stays owner/admin only (`teamPickerAccess`). Not wider.
  This supersedes ACCEPTANCE J7's P4 row ("same rule as `teamPickerAccess`").
- **Self arm reach.** The edit layer mounts only on `canEdit` (owner or manager), so in practice the
  self arm is used by owners and managers on their own row. A listed-only person (P5) or a
  contributor never mounts the layer, so they cannot reach the sheet on this page today. Widening
  the mount is out of scope by the brief.
- **Hidden-read failure draws no controls.** "Couldn&rsquo;t check who is hidden. Try again" and no
  list: a Hide / Show button guessed from a stale state could undo someone else&rsquo;s choice.
- **After every Hide / Show** (success or refusal) the hidden list and the public Team are
  invalidated together (`organiserTeamHiddenKey` + `organiserPublicTeamKey`), so the public section
  under the layer updates at once.
- **Two different facts.** A person&rsquo;s own opt-out (`organiser_team_set_public_v1`, an inactive
  team row) and the hide flag (`organiser_team_public_hides`) are separate; the public list honours
  both; this sheet sets only the hide flag.

## Sheet rows

`visibilityRows()` builds: owner seats, manager seats (`organiser_team_v1`, now parsing `person_id`),
then listed people in public `sort_key` order, then hidden listed people (on no seat, not in the
public read) by name, named from `dancer_profiles(first_name, surname)`; a failed name read falls
back to "A team member". Each person once; an owner keeps owner protection even if also listed.
Contributors are not rows unless also listed. A seat with no dancer persona (2 on prod) is a row
"No dancer profile, so not on the public page" with no control.

## Step 0 coverage table

| Contract row | Expected | Where it is covered | Verify |
|---|---|---|---|
| s1 Team decision | One plain list, no role labels; owners + managers + listed; taps to page; hidden never shown | `teamFromPublicRows` (`src/modules/profile/organiserTeam.ts`); `organiserTeam.matrix.test.ts`; `organiserPage.matrix.test.tsx` S3 Team block (no `data-team-tag`/`data-team-title`) | U |
| J3 line-up 1 / 2-3 | owners + managers + active listed, de-duplicated, links | `organiserTeam.matrix.test.ts` "merge and order", "repeated person_id renders once" | U; W not run |
| J3 owner without dancer profile | public name, not a link | `organiserTeam.matrix.test.ts` "no slug -> href null" (links by slug, else dancer id) | U |
| J3 hidden person (inactive row) | never shown, even when a manager | server-side in `organiser_public_team_v1`; client maps only what it returns; `organiserTeam.matrix.test.ts` "a hidden person never appears" | U |
| J3 team read fails | "Couldn&rsquo;t load the team. Try again"; page intact | `OrganiserProfileFeedError.matrix.test.tsx`, `organiserPage.matrix.test.tsx` failure combinations | U |
| J7 P3 owner | Hide on each person; hidden disappears from the public list at once; can be unhidden | `TeamVisibilitySheet.tsx`; `teamVisibilitySheet.matrix.test.tsx` caller x target x (hide, show), both keys invalidated | U; W (real hide on prod) not run &mdash; it would write |
| J7 P4 manager | Hide / Show on all but owners (decision above) | same matrix; `TeamPicker.test.tsx` roles table; `visibility.matrix.test.tsx` through the real page | U |
| J7 P1, P2, P5 | hidden person never appears | J3 row above | U |
| J7 P6 admin (seatless) | sheet opens, no controls (RPC `not_allowed`) | `teamVisibilitySheet.matrix.test.tsx` admin-seatless rows | U |
| E11 | no role tags/titles; owners/managers present | `organiserPage.matrix.test.tsx` S3 Team; `teamFromPublicRows` reads the RPC that includes seats | U |
| s6 Feed error, one section (Team) | Team error line + Try again; others render | `organiserPage.matrix.test.tsx` "every feed / contact / team failure combination" | U |
| s6 Every feed fails | Hero + Get in touch + Team + per-section error lines | same | U |
| s6 Team sheet: hidden read fails | "Couldn&rsquo;t check who is hidden. Try again", no controls | `teamVisibilitySheet.matrix.test.tsx` "hidden read fails" per caller | U |
| s6 Team sheet: refusal | server reason in plain words under the row | `teamVisibilitySheet.matrix.test.tsx` owner_protected; `teamHide.matrix.test.ts` HIDE_ERROR_COPY | U |

## Prod shapes (read-only, counts only, 2026-11-06)

Seats: 17 owner, 43 manager, 0 contributor (60 owner/manager seats); 2 owner/manager seats have no
dancer persona. Organisers with an owner 14, with a manager 43, with more than one owner 2.
`organiser_team_members`: 64 active, 55 inactive rows across 50 organisers. Seat holders on an
INACTIVE team row: 41 of the 60 seats (matches #1259&rsquo;s 41/60); on an active row 17.
Contributors also listed: 0. `organiser_team_public_hides`: 0 rows (nobody hidden yet).
Public Team size per live organiser (`organiser_public_team_v1`): 1 row 5, 2 rows 36, 3 rows 9.
