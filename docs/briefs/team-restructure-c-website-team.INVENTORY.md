# INVENTORY: Team restructure slice C (written before the build)

Sources: admin app (`organiser_team_shared_v1` / `_organiser_team_rows_v1`, read in prod, the migration lives in
`bachata-admin-11april`), the Website organiser Team screen, the public organiser page. Paths are on main.

| # | Item | Where |
|---|------|-------|
| 1 | Shared read columns: person_id, user_id, slug, public_name, avatar_url, access_role, listing_label, is_stub, is_public, public_reason, sort_key | admin `_organiser_team_rows_v1` (prod function) |
| 2 | access_role values owner / manager / contributor / none | admin `_organiser_team_rows_v1` |
| 3 | public_reason values seat, roster, hidden, stub, no_profile, page_not_live, not_visible, not_listed | admin `_organiser_team_rows_v1` |
| 4 | Gate: not signed in -> authentication_required; non-member -> not_authorised | admin `organiser_team_shared_v1` |
| 5 | Screen reads seats only (organiser_team_v1) | src/modules/organiser/shared/teamRpcApi.ts:16 |
| 6 | Screen row = seat avatar + name + role chip, links to Person by user_id | src/modules/organiser/team/index.tsx:25 |
| 7 | Screen empty copy: "no page" only | src/modules/organiser/team/index.tsx:72 |
| 8 | Add someone: owner/manager, disabled with reason for a contributor | src/modules/organiser/team/index.tsx:101 |
| 9 | Own-row "Show me on the public team" switch (organiser_team_set_public_v1) | src/modules/organiser/team/PublicToggle.tsx:17 |
| 10 | Hide / Show rule (owner anyone, manager not owner, self, else none) | src/modules/organiser/edit-in-place/teamHide.ts:23 |
| 11 | Hide / Show command and its refusal copy | src/modules/organiser/team/publicTeamApi.ts:121 |
| 12 | Public read organiser_public_team_v1 + refusing parser | src/modules/organiser/team/publicTeamApi.ts:79 |
| 13 | Public mapper teamFromPublicRows | src/modules/profile/organiserTeam.ts:179 |
| 14 | Public section renders nothing when empty | src/modules/profile/OrganiserTeamSection.tsx:72 |
| 15 | Public section error line with retry | src/modules/profile/OrganiserTeamSection.tsx:63 |
| 16 | Public page viewer rights (facts.canEdit) | src/pages/OrganiserProfile.tsx:974 |
| 17 | Callers of fetchOrganiserTeam keep myRole/members: More, handover, You, Page | useTeamContext.ts:25 and tests that mock organiser_team_v1 |
| 18 | Team sheet "Who shows on your page" (own list; unchanged) | src/modules/organiser/edit-in-place/teamVisibilityModel.ts:85 |

Decision recorded: `fetchOrganiserTeam` keeps `myRole` and `members` (seats, from organiser_team_v1, which alone
carries role, email, is_self) and gains `listed` (the shared rows). The shared read has no my_role, email or is_self,
so it cannot replace the seat read for the callers in row 17. If the shared read fails, `listed` is null and the
screen shows the seats with a plain line, never an empty list.
