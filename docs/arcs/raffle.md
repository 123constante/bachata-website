# Arc: Raffle v2 (one pool, winner picks a night, QR at the door)

Last verified: 2026-11-06 against Website origin/main a8c7b7d00 and admin origin/main 514fb0ab, with `gh pr view` and `git show`. Sources: plans/before-you-plan-or-quizzical-graham.md (owner decisions D1-D16, data model, RPC names), READY-QUEUE.md rows 14, 47, 48, 62. `W#` = bachata-website, `A#` = bachata-admin.
Goal: enter once from anywhere, admin draws from one pool, the winner signs in and picks a night, a single-use QR is issued, organisers scan it at the door (offline capable). Ranked LAST in the owner's order (automation, organiser, ticketing, raffle).
Hard fact: nothing public works until admin R0 and R1 are applied on prod. `raffle_pool` is in no migration on admin origin/main.

## Slices
| Slice | Repo | Status | Blocked by | PR / branch / brief |
|---|---|---|---|---|
| R0 schema, backfill, join + board RPCs, submit shim | admin | OPEN since 2026-11-03 (updated), last commit 2026-10-30; label `ap:worker-running` is stale; placeholder version 99990101000000 | independent review r1 (A#1139, closed) found 6 fix-before-apply items; fix commit 3d72b7af answers them but no re-review, no `run-ci` proof, no pack, no owner Approve; mergeable state UNKNOWN (needs rebase on main) | A#1135 claude/raffle-r0-schema; review docs/review/raffle-r0-schema-r1.md on claude/review-raffle-r0-r1 |
| R1 winner, door and admin RPCs, WhatsApp verify rekey, QR message | admin | BRIEFED, not dispatched | R0 applied (R1 branch is based on R0) | brief/raffle-r1-rpcs (admin, 01007e85), docs/briefs/raffle-r1-rpcs.md |
| R2 rebuilt admin raffle page | admin | BRIEF on Website main, not dispatched | R1 applied | docs/briefs/raffle-r2-admin-page.md (landed by W#1174) |
| R3a board foundations (flag, mapping, hook, win-state table) | web | DONE | -- | W#1424 (handover), src/hooks/useRaffleBoard.ts on main; first PR W#1421 closed |
| R3b-1 entry dialog joins the pool when `raffleV2` is on | web | DONE | -- | W#1427 |
| R3b-2 board screens on the event tile and /raffles | web | PR OPEN, checks not re-read | review; cannot go live before R0 (reads `raffle_public_board_v1`) | W#1429 claude/raffle-r3b-board-screens (19cc8420) |
| R4 winner page `/raffle/win/:token` | web | BRIEFED, not dispatched | R1 applied; slug mismatch: queue says claude/raffle-r4-winner-page, brief branch is brief/raffle-r4-winner-page-build (a99cb29f) | docs/briefs/raffle-r4-winner-page.md |
| R5 shared door scanner `/door/:occurrenceId` | web | BRIEFED, not dispatched | R1 applied; shares the screen with ticketing | brief/raffle-r5-door-scanner-build (8d159f7c), docs/briefs/raffle-r5-door-scanner.md |
| R6 review, replay proof, apply R0/R1 by MCP, flags ON, packs | both | NOT STARTED | each slice above | lead task |

## Slices not yet briefed (drafters: verify each on origin/main first)
| Item | Repo | Blocked by | Source |
|---|---|---|---|
| R0 fix-and-prove continuation: rebase on main, new placeholder version, `run-ci` proof, answer owner decision on backfill night rule | admin | owner decision below | review finding 2 in docs/review/raffle-r0-schema-r1.md |
| Remove the `submit_raffle_entry` shim after R3 is live (Fast PR) | admin | R3 flag ON in prod | plan R0 row |
| U1 weighted draw (never-won rows get higher odds) | admin | R1 applied | plan "Queued upgrades" |
| U2 24-hour reminder template + scheduled function | admin | R1 applied, Meta template | plan "Queued upgrades" |
| U4 winners story card on the admin page | admin | R2 merged | plan "Queued upgrades" |
| Privacy path for the never-expiring pool (erase/export + consent copy) | both | owner declined 2026-10-30 (D15); raise before the pool opens publicly | plan "Not in scope" |

## Owner decisions pending
- R0 backfill rule: review finding 2 says about 527 of 766 legacy winners map to the PREVIOUS night against v1's rule; the fix commit chose the v1 night rule, but the owner has not confirmed that manual winners are logged after the night.
- Whether the arc stays ranked last or R0 review/proof is spent now (it unblocks R1 to R5 and the already merged R3b-1).
- Public-pool privacy gap (D15, declined) before `rafflesPage` goes live.
- All other design decisions D1-D16 are recorded and closed in the plan; do not re-ask.

## Rules for briefs in this arc
- Branch family `claude/raffle-*`; slice ids R0-R6 as above; admin owns all DDL; ACL posture: revoke from public and anon by name; explicit GRANT incl. service_role (no auto-grants since 2026-10-30).
- Release 1 = R0-R4 (enter, draw, WhatsApp, pick a night, QR); Release 2 = R5 scanner.
- Matrix: win state (contacted, locked, attended, no_show, released, cancelled) x screen (winner page, event tile, /raffles, admin page, door).

## Not verified here
- Whether A#1135's fix commit really clears review findings 1-6 (not re-read); CI state of A#1135 and W#1429; whether the `rafflesPage` / `raffleV2` flags are ON in the prod build (default OFF in src/lib/featureFlags.ts).
