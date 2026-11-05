# Handover: organiser public page - Team list mapping

Brief: `docs/briefs/organiser-team-mapping.md` on branch `brief/organiser-team-mapping` (v2).
Branch: `claude/organiser-team-mapping`. Status: DONE for this slice (pure logic + tests, no screen).

## What landed
- `src/modules/profile/organiserTeam.ts` - `buildOrganiserTeam(input)`, `runByLine(team)`,
  `teamInitials(name)`, `TEAM_VISIBLE_CAP = 6`, types `ListedPerson`, `AccessPerson`,
  `TeamInput`, `TeamPerson`, `TeamList`, `TeamMode`. No I/O; imports only `ROLE_PAGE_BASE`
  from `src/modules/person-page/personRoles.ts` (the one copy of `/dancers`).
- `src/modules/profile/__tests__/organiserTeam.matrix.test.ts` - 28 tests (run red first:
  module missing, then green).
- Not imported by any screen: zero bytes added to any first load.

## Rules the function applies
- Key: `personId` (dancer profile id). An access row with no `personId` is its own person,
  keyed `user:<userId>` (that key is what lands in output `personId`).
- Rank: owner 0, manager 1, listed 2. Listed rows then sort by `sortOrder` (null last),
  then name A-Z (`localeCompare` en-GB, base sensitivity), then key (deterministic).
- Duplicates collapse to the best rank. Each field (name, avatar, slug) comes from the
  best-rank source that has a non-blank value, so an owner row without a photo or page
  borrows them from their listed row.
- Hidden in ANY source hides the person (privacy wins).
- Names trimmed; a person with no non-blank name in any source is dropped.
- `href` = `/dancers/<encodeURIComponent(slug)>` when slug is non-blank, else null.
- `mode`: 0 -> `empty`, 1 -> `solo` (`runByLine` -> "Run by <name>"), more -> `list`.
  More than `cap` (default 6; a cap < 1 or non-finite falls back to 6): first `cap` in
  `people`, the rest in `overflow` ("+N more").

## Which real fields feed each input (step 1)
`listed` - today's 'organiser-lineup' read in `src/pages/OrganiserProfile.tsx` (~line 775):
| input | source |
|---|---|
| personId | `organiser_team_members.member_profile_id` (= `dancer_profiles.id`) |
| name | `resolvePublicName(...)` over `withPublicNames(dancer_profiles)` - the screen today falls back to 'Team member'; pass the raw resolved name instead so a blank is dropped |
| avatarUrl | `dancer_profiles.avatar_url` |
| slug | the dancer page key: today `/dancers/:id`, so pass `dancer_profiles.id` when the row was found (TeamCircle's `dancerId`), else null |
| sortOrder | `organiser_team_members.sort_order` |
| hidden | NO column today (columns: capacity, created_at, id, is_active, is_head, is_leader, member_profile_id, organiser_profile_id, person_entity_id, role, sort_order, updated_at). Pass `false`; inactive rows are already filtered by `is_active = true`. The admin slice adds the hide switch. |

`access` - `organiser_team_v1` members (`src/modules/organiser/shared/teamRpcApi.ts`,
parsed by `parseTeam` in `teamModel.ts`), keeping `member_role` owner/manager only:
| input | source |
|---|---|
| personId | `profile_id` (`TeamMember.profileId`) |
| userId | `user_id` |
| name | `display_name` (NEVER `email`; `memberLabel` falls back to email - do not use it here) |
| role | `member_role` (contributors excluded) |
| avatarUrl | `photo_url` |
| slug | none in the RPC; leave null and the listed row (if any) supplies it, or the admin RPC adds it |
| hidden | no source yet; `false` |

Caveat: `organiser_team_v1` is an owner/manager-only read (the team page), so a signed-out
visitor cannot get `access` today. Until the admin RPC (one merged public read + hide switch)
ships, a visitor screen can only pass `listed`.

## Shape survey (read-only, prod, 2026-11-05)
- organiser_team_members active rows 64 across 50 organisers; max 3 per organiser; 0 null sort_order.
- entity_members: 22 owners, 45 managers.
- Owner brief: 37 of 53 organisers list exactly one person, 13 list 2-3, none more than 3, 4 list nobody.

## Left / next steps
1. Admin slice: one public RPC merging both sources with `hidden` (owner/manager or self),
   returning exactly `TeamInput`'s shape.
2. Screen slice: replace the Leader/Member "Teachers & DJs" strip (TeamCircle, OrganiserProfile
   ~700-725 / 1526) with chips from `buildOrganiserTeam`; empty -> hidden for visitors, "Add
   people" prompt for the organiser; emitProfileView on tappable chips (data-contracts rule);
   px tap targets; walk at 390x844.

## Ship status
- PR: #1395 (not merged, not approved by the worker). No automerge label: 469 lines (> 400).
- Local gates: matrix 28/28; lint chain 24/24; mojibake clean; pre-ship build/bundle/first-load/chunk-cycles/typecheck PASS;
  test:unit 4 red files, all live-DB contract tests or the PATH-sensitive integrity harness, unrelated to these files.
