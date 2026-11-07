# Brief: Add the interim-seat doors to the G1 write-door doc

Brief-version: 2
Branch: claude/seat-doors-doc
Lane: normal, Sonnet. bachata-website, docs only; must not touch src/, supabase/, workflows or scripts
Serves: the lead and reviewers who flip organiser flags: they need every door that interim seats (admin PR 1284, merged) added, so none is opened unseen

## What main lacks
- A section in the G1 write-door doc listing the interim-seat doors and each Website call site -- grep: Interim-seat doors (added with I1)
- A row-status update for I6 in the organiser arc file -- grep: I6 write-door doc done

## Files
docs/scoping/g1-write-door-check.md
docs/arcs/organiser.md

## What to build
1. In docs/scoping/g1-write-door-check.md add a section headed "Interim-seat doors (added with I1)" after section 1.2. One table row per RPC: request_organiser_access_v1 (src/modules/organiser/shared/selfServeApi.ts:179), resolve_organiser_access_request_v1 (selfServeApi.ts:441), admin_invite_person_v1 (src/modules/admin-organisers/invitePersonApi.ts:119), redeem_organiser_invite_v1 (src/modules/admin-organisers/adminApi.ts:117). Re-read each line number on origin/main before writing it.
2. For each row state, from supabase/migrations/20270315110000_organiser_interim_seats_v1.sql in the admin repo (read via `git -C C:/dev/bachata-admin-11april show origin/main:...`): who may call it, whether it opens or closes a seat, and whether it reaches an event write (answer per door, yes or no, with the line read).
3. Add a short "Doors not added" paragraph: the seat checks `_organiser_team_add_gate_p5` and `_ticket_can_manage_organiser_v1` are helpers, not doors.
4. Update the I6 row text in docs/arcs/organiser.md (Status "I6 write-door doc done", PR link) in the same PR.

## Tests
Docs only, no code test. Table-driven check by hand: every RPC named in the new section has a grep hit on origin/main of the cited file:line (list the four greps and their output in the PR body). Red first not applicable; say so.

## Done when
The section exists, all four citations re-verified, arc row updated, `npm run lint` link for docs passes if one exists, PR checks green. PR body carries the Verified / Not verified block (Not verified: prod grants were not re-read).
