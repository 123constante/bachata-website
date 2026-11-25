Branch: claude/organiser-team-r2-w2-person-add
Size: 5 files, 400 lines
Brief-version: 2

# R2 W2 (Website UI): organiser Team "Person" + "Add someone" screens (flag organiserTeamR2)

Owner delegated all product decisions 2026-11-25 (global CLAUDE.md "I DECIDE PRODUCT TOO"). Decisions are final; build exactly this. DESIGN-REGISTRY row "Organiser Events + Team layouts" (R2 FINAL). Depends on: admin migration `organiser_team_r2_people_v1` merged + applied, and Website W1 (`claude/organiser-team-r2-w1-list`: flag `organiserTeamR2`, `src/modules/organiser/p3/r4/r4TeamR2Api.ts`) merged. Dispatch only after both.

Flag: `flags.organiserTeamR2` (added by W1). Flag OFF = today's AddSomeone and Person byte-for-byte (same render path). Flag ON = the two new screens below. Rollback = env off.

## What main lacks
- No invite-link call -- grep: organiser_team_invite_link_v1 (no hits under src/)
- Person page has no switches -- grep: organiser_team_set_switches_v1 (no hits under src/modules/organiser/team)
- Add has no role choice (Manager / Door) -- grep: role-chip (no hits under src/modules/organiser/team)
- TeamFlow has no flag branch -- grep: organiserTeamR2 (no hits in src/modules/organiser/team/TeamFlow.tsx)

## Files
src/modules/organiser/team/TeamFlow.tsx (only: when `flags.organiserTeamR2`, render AddSomeoneR2 / PersonR2 instead; nothing else changes)
src/modules/organiser/team/AddSomeoneR2.tsx (new)
src/modules/organiser/team/PersonR2.tsx (new)
src/modules/organiser/p3/r4/r4TeamR2Api.ts (add ONE wrapper: inviteLink(org) for organiser_team_invite_link_v1; untyped rpc like its siblings)
src/modules/organiser/team/__tests__/teamR2Screens.test.tsx (new)

## RPCs (live; read bachata-admin main supabase/migrations/*_organiser_team_r2_people_v1.sql for exact shapes before coding)
- `organiser_team_invite_link_v1(p_org, p_role default 'manager')` -> `{token, expires_at}` (owner only).
- `organiser_team_set_switches_v1(p_org, p_user, p_can_sign_in, p_on_public, p_role default null)` -> the row's new state (W1 wrapper exists).
- `organiser_team_people_v1(p_org)` and `organiser_team_recent_changes_v1(p_org, p_limit)` (W1 wrappers exist; Person reads its row from people_v1 by user_id).
- Existing, unchanged: `searchTeamPeople` + `addTeamMemberByProfile` (src/modules/organiser/shared/teamRpcApi.ts), `AddConfirm`, `useTeamContext`, `canReceiveOwnership`, paths `P3_PATHS.youTeamDoorInvite`, `paths.handoverTo(userId)`.
- Invite URL = `${window.location.origin}/invite/${token}` (existing route /invite/:token -> InviteRedeemPage -> redeem_organiser_invite_v1).

## What to build (flag ON)
0. Write INVENTORY.md first: every field, state and control of today's AddSomeone (202 lines) and Person (136 lines), and every field of the RPC answers, each with file:line. Build only after it exists; report coverage (covered / total) at the end.

### Add someone (AddSomeoneR2), ONE screen, top to bottom
1. Title "Add someone" + PageNameCaption (as today).
2. Role chips, single choice, big (min 44px): "Manager" (default, selected) and "Door". One muted line under them: Manager = "Can edit your events and team." ; Door = "Scans tickets on one night. Access ends at noon the next day.".
3. Door chip selected -> the screen shows ONE big button "Choose the night" linking to `P3_PATHS.youTeamDoorInvite` (existing R4DoorInvite); search and invite button hidden.
4. Manager chip selected:
   a. Big primary button "Invite by WhatsApp link" (WhatsApp green is NOT used; app primary style). Tap: call inviteLink(org,'manager'), then open `https://wa.me/?text=` + encodeURIComponent(`Join me on <page name> on Bachata Calendar: <url>`) in a new tab. Under it a small text button "Copy link instead" that mints (if not minted yet on this screen) and copies the URL, then shows "Link copied" for 3 s. Reuse ONE minted token per screen visit. Error `too_many_open_links` -> "You have 10 links waiting. Use one you already sent, or wait for them to expire."; any other error -> one line "Could not make a link. Try again.". Server refusal (non-owner) -> hide both buttons and show today's ADD_ROLE_REASON line.
   b. Below: today's search field + results + confirm sheet exactly as AddSomeone does (2-letter minimum, 8 results, AddConfirm, Done state). The 3-column face wall and the old "Share an invite link" ghost button are NOT shown (the big button replaces them).
5. Manager viewer (not owner): today's read-only line `ADD_ROLE_REASON` + back link (as today).
6. "Contributor" is never offered.

### Person (PersonR2), top to bottom
1. Summary card: Avatar 56, name, role word (Owner / Manager / Contributor / Door) + " · you" when is_you; for Door: "Door until <Thu 14:00>" London time (same formatter W1 uses); last change about this person from recent_changes_v1 as one muted sentence (same sentence builder as W1), or nothing.
2. Two labelled switches "Can sign in" / "On public page", same behaviour, error lines and both-off confirm as the W1 list row (reuse W1's helpers; do not copy them).
3. Role (owner viewer only, person is manager or contributor, not you): chips "Manager" / "Contributor" with the current one selected; tap the other -> set_switches with p_role, current switch values unchanged; error -> "Could not save. Try again.". Manager viewer: role shown as text only, no chips, no disabled control.
4. Keep, same conditions, same copy, same testIds as today's Person: "Hand the page over" link, "Leave this page" (self), "Remove from the team" + its confirm ("Remove {name}? They will no longer see or edit these events." / Remove / Keep them) and the GateReason lines.
5. Person not in people_v1 -> today's "They are not on the team any more. Back to the team" line.
6. Loading = SkeletonRows; error = "Could not load. Try again." + Retry.

## Prototype checklist
- [ ] Flag OFF: AddSomeone and Person identical to main (keep-list tests)
- [ ] Add: role chips Manager (default) / Door + one muted line each
- [ ] Add Door: "Choose the night" -> youTeamDoorInvite; search hidden
- [ ] Add Manager: big "Invite by WhatsApp link" -> mint once -> wa.me with message + URL
- [ ] Add Manager: "Copy link instead" -> copy + "Link copied" 3 s
- [ ] Add Manager: mint error line; non-owner -> ADD_ROLE_REASON, buttons hidden
- [ ] Add Manager: search + results + AddConfirm + Done as today; face wall + old share button gone
- [ ] No Contributor option for new people
- [ ] Person summary: avatar, name, role, you, door-until, last change line
- [ ] Person switches + error lines + both-off confirm (W1 helpers)
- [ ] Person role chips owner-only Manager/Contributor; manager sees text
- [ ] Person keeps Hand over / Leave / Remove + confirm + GateReasons
- [ ] Person missing line; loading skeleton; error + Retry

## Tests
- KEEP-LIST tests (flag OFF): every control, line and testId of today's AddSomeone and Person still renders (reuse existing team __tests__ fixtures).
- Flag ON: chip switch hides/shows the right block; invite tap mints ONCE across WhatsApp + Copy and builds the wa.me URL with the /invite/<token> link; Person role chip calls set_switches with p_role and unchanged switches; manager viewer sees no chips.

Rule: end with a tap table (button | destination | prototype/OLD) in the PR body; any OLD row = not done. Do not touch R4Team or any other screen; list anything extra you notice in the PR body, never change it.

## Proof
tsc zero errors in touched files, vitest for the new tests, PR body with the tap table and INVENTORY coverage. No migration.
Stop after the push and report.
