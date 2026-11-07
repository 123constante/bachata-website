# Team restructure slice C: organiser Team screen and public profile read the shared team read

Brief-version: 2
Branch: claude/team-restructure-c-website-team
Lane: normal, Sonnet
Blocked by: slice A (claude/team-restructure-a-db) merged AND applied; slice B should ship in the same window so admin, public and organiser screens switch together. Regenerate src/integrations/supabase/types.ts only if the repo's process allows; else use the untyped rpc cast already in publicTeamApi.ts.

## What main lacks
- Organiser's own Team screen reads organiser_team_v1 (seats only) -- proof: grep: `organiser_team_v1` at src/modules/organiser/shared/teamRpcApi.ts:16
- Public profile reads organiser_public_team_v1 through its own mapper -- proof: grep: `fetchOrganiserPublicTeam` at src/pages/OrganiserProfile.tsx:758 and `organiser_public_team_v1` at src/modules/organiser/team/publicTeamApi.ts:79
- Public Team section renders nothing when empty -- grep: `if (team.mode === 'empty') return null` at src/modules/profile/OrganiserTeamSection.tsx:72
- Team screen empty copy covers only "no page", not "page with nobody listed" -- grep: `You don&rsquo;t have a page yet` at src/modules/organiser/team/index.tsx:72

## Files
- extends: src/modules/organiser/shared/teamRpcApi.ts
- extends: src/modules/organiser/team/publicTeamApi.ts
- extends: src/modules/organiser/team/index.tsx
- extends: src/modules/profile/organiserTeam.ts
- extends: src/modules/profile/OrganiserTeamSection.tsx
- (new) src/modules/organiser/team/__tests__/teamShared.matrix.test.tsx

## Build
0. Write INVENTORY.md first: every field, state and option from the admin app, the current Website and the public page, each with file:line. Build only after it exists; report the coverage count (covered / total) at the end.
1. teamRpcApi.fetchOrganiserTeam reads organiser_team_shared_v1 (keep return shape myRole/members so More, handover, You, Page callers keep working; their tests mock organiser_team_v1, update the mocks table-driven).
2. Organiser Team screen lists every person with Owner/Manager/Listed label and the hide switch via existing teamHide.ts (set_organiser_team_member_hidden_v1); stubs and seats show a disabled switch with a reason.
3. Public page keeps organiser_public_team_v1 (now a filter of the shared read); teamFromPublicRows unchanged except tolerance for any new columns. Do not add a third source.
4. Empty states: organiser screen "Nobody is listed yet. Add someone below and they appear on your public page."; public page, when the organiser views their own page, shows a one-line "Your Team is empty. Add people in Team." link; visitors still see nothing (no dead heading).

## Tests (table-driven, red first)
Shapes: seat only, roster only, both, seat+roster off, stub, hidden, empty; viewer = visitor / organiser / admin. Assert public rows == shared rows filtered by is_public; one label mapping; no copy pointing at a missing control.

## Hard limits
- Website repo only; no supabase/migrations; Supabase read-only; no workflow edits, no .env*; HTML entities not raw Unicode; push once, bot PR; run every CI job step; never --no-verify; end with [worker-done <ticket>].
- PR body: "Verified on real data" block, 390x844 walk, honest "Not verified".
