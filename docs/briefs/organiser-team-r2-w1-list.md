Branch: claude/organiser-team-r2-w1-list
Size: 5 files, 380 lines
Brief-version: 2

# R2 W1 (Website UI): organiser Team = one list with two switches + "Recent changes"

Owner delegated all product decisions 2026-11-25 (global CLAUDE.md "I DECIDE PRODUCT TOO"). Decisions are final; build exactly this. DESIGN-REGISTRY row "Organiser Events + Team layouts" (R2 FINAL). DB is live: admin PR for `organiser_team_r2_people_v1` (RPCs below) is merged and applied before this brief is dispatched.

Flag: NEW env flag `organiserTeamR2` in `src/lib/featureFlags.ts` = `import.meta.env.VITE_ENABLE_ORGANISER_TEAM_R2 === 'true'`. Flag OFF = today's R4Team screen byte-for-byte (same render path, untouched). Flag ON = the new list below. Rollback = env off.

## What main lacks
- No people list read via `organiser_team_people_v1` -- grep: organiser_team_people_v1 (no hits under src/modules)
- No two-switch row (Can sign in / On public page) -- grep: organiser_team_set_switches_v1 (no hits)
- No "Recent changes" on Team -- grep: organiser_team_recent_changes_v1 (no hits)
- No flag `organiserTeamR2` -- grep: VITE_ENABLE_ORGANISER_TEAM_R2 (no hits)

## Files
src/lib/featureFlags.ts (add the flag line only)
src/modules/organiser/p3/r4/r4TeamR2Api.ts (new: 3 typed rpc wrappers + query keys; untyped rpc like src/modules/organiser/claim-link/onboardingStateApi.ts since the generated types lag)
src/modules/organiser/p3/r4/R4TeamR2.tsx (new: the flag-ON screen)
src/modules/organiser/p3/r4/R4Team.tsx (only: `if (flags.organiserTeamR2) return <R4TeamR2 />` at the top of R4Team; nothing else changes)
src/modules/organiser/p3/r4/__tests__/r4TeamR2.matrix.test.tsx (new)

## RPCs (live; read the migration on bachata-admin main: supabase/migrations/*_organiser_team_r2_people_v1.sql for exact shapes)
- `organiser_team_people_v1(p_org)` -> `{people:[{user_id, dancer_profile_id, display_name, avatar_url, role, can_sign_in, on_public, is_you, door_until, door_expired}], pending_invites:[{role, expires_at, created_at}]}` (owner or manager; others raise not_a_member)
- `organiser_team_set_switches_v1(p_org, p_user, p_can_sign_in, p_on_public, p_role default null)` -> the row's new state (sign-in = owner only; raises cannot_lock_out_owner, use_transfer)
- `organiser_team_recent_changes_v1(p_org, p_limit default 20)` -> `[{at, actor_name, person_name, action, from_role, to_role}]`
- p_org = the organiser id from `useTeamContext()` (same source R4Team uses today).

## What to build (flag ON)
0. Write INVENTORY.md first: every field, state and option of the current R4Team screen and the 3 RPC answers, each with file:line. Build only after it exists, and report the coverage count (inventory items covered / total) at the end.
1. Header "Team" + the existing "Add someone" button (same link `P3_PATHS.youTeamAdd`, same place as today).
2. ONE list, order as the RPC returns (owner, managers, contributors, door). Each row: avatar (or initial), name, role word (Owner / Manager / Contributor / Door), and two labelled switches "Can sign in" and "On public page". Tapping the name area opens `P3_PATHS.youTeamPerson(user_id)` (existing route).
3. Switch tap = optimistic flip, call set_switches with the row's other switch unchanged, refetch people + recent changes on settle; on error flip back and show one plain line under the row: cannot_lock_out_owner -> "You can't switch off your own sign-in."; not owner (any gate raise) -> "Only the page owner can change this."; anything else -> "Could not save. Try again.".
4. Owner row: "Can sign in" switch shown ON and disabled. Viewer is a manager: "Can sign in" switches disabled on every row (read-only), "On public page" enabled only if the RPC allows it (let the server answer; show the error line if it refuses).
5. Turning BOTH switches off: before the call, a small confirm sheet (reuse `Sheet` from ../screens/Sheet) "Remove <name> from the team?" with "Remove" and "Cancel". Remove -> call; the row leaves the list.
6. Door rows: live door row shows "Door until <Thu 14:00>" (London time, from door_until). Expired door row (door_expired) is greyed (opacity), switches hidden, one button "Re-add" that links to the existing door invite screen `R4DoorInvite` route (same link R4Team uses today for door).
7. Pending invites: one muted row per open invite "Invite link sent - waiting" with "expires <date>". No action on it in this PR.
8. Bottom: a collapsed row "Recent changes" (chevron). Tap expands inline to the newest 20 lines, each one plain sentence, e.g. "Ana added Leo as Manager - 2h ago", "Ana hid Leo from the public page - yesterday". Shown only to owner and managers (the RPC raises otherwise: then hide the row entirely). Empty -> "No changes yet.".
9. Loading = the existing R4 skeleton style; people_v1 error -> one line "Could not load your team. Pull to refresh." and a Retry button.

## Prototype checklist
- [ ] Flag OFF: R4Team identical to main (keep-list test below)
- [ ] Header + Add someone button (same destination)
- [ ] One list, row = avatar, name, role word, 2 labelled switches
- [ ] Name tap -> person page
- [ ] Switch flip optimistic + revert + 3 plain error lines
- [ ] Owner own sign-in switch disabled ON; manager viewer read-only sign-in
- [ ] Both-off confirm sheet Remove/Cancel
- [ ] Door live "Door until ..."; expired greyed + Re-add
- [ ] Pending invite muted rows
- [ ] Recent changes collapsed row, expands to 20 plain sentences, hidden for non-owner/manager, empty line
- [ ] Load error line + Retry

## Tests
- Model/matrix test: row building, error-line mapping, recent-change sentence builder for every action value (added, removed, role_changed, shown, hidden, invite_link, door_added, door_removed, owner_handed_over), London time for door_until.
- KEEP-LIST test (flag OFF): every badge, line and control R4Team renders on main today still renders (use the existing __tests__/r4Team.matrix.test.ts fixtures).
- Component test (flag ON): switch tap calls set_switches once with the other switch unchanged; error reverts.

Rule: end with a tap table (button | destination | prototype/OLD); any OLD row = not done. Do not touch any other screen (Person and Add are the next PR); list anything extra you notice in the PR body, never change it.

## Proof
tsc zero errors in touched files, vitest for the new files, PR body with the tap table. No migration.
