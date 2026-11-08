# Arc: organiser (public organiser page, P3 organiser area, claim + onboarding, interim manager seats, live-now)

Last verified: 2026-11-06 against Website origin/main a8c7b7d00 and admin origin/main 514fb0ab, with `gh pr view` and `git merge-base --is-ancestor`. Sources: plans/PROGRAM.md, plans/ARC-p3.md (stale before 10-28, use only for slice ids W2a-W4c), plans/PLAN-interim-manager-seats.md (decisions D1-D18, pieces I1-I7), GAPS-organiser-acceptance-vs-main-2026-11-05.md, READY-QUEUE.md organiser and live-now rows. `W#` = bachata-website, `A#` = bachata-admin.
4-week goal (owner 2026-11-02): 10 real organisers claim their page and update an event themselves. Contracts on main: docs/organiser-page/ACCEPTANCE.md, docs/organiser-page/INVENTORY.md. `organiserSelfServe` has been ON in the prod build since 2026-10-05 (W#1401); `organiserP3` default OFF (src/lib/featureFlags.ts), prod value not re-checked.

## Slices
| Slice | Repo | Status | Blocked by | PR / branch / brief |
|---|---|---|---|---|
| P1 visitor page: stats strip, Get in touch, Team list, page states | web | DONE | -- | W#1391, W#1392, W#1399 |
| P2 Team public read + Hide/Show on Team sheet | both | DONE | -- | A#1259, A#1270, W#1437 |
| D4 next-nights cards + past-nights strip | web | DONE | -- | W#1438 |
| Stats strip shows three figures; bio shown once (150 chars) | web | DONE | -- | W#1434, W#1436 |
| Ref capture on event views (`?ref=`) | web | DONE | -- | W#1426 |
| Stats v2 + share link | web | PR OPEN, no red check at last read | review; its follow-up needs this merged | W#1428 claude/organiser-stats-v2-share-card |
| Share link must use public event id (`legacy_event_id ?? id`) | web | BRIEFED | W#1428 merged | brief/stats-share-link-event-id (7e52f665) |
| Nights feed v2 (all cities, next 20, no cancelled) | admin | PR OPEN, labels `run-ci,ap:stopped`; red: prove + placeholder-merge-gate (expected placeholder gate) | CI read, pack, owner Approve | A#1266 claude/organiser-nights-feed |
| Nights feed swap on the page | web | BRIEFED | A#1266 applied | brief/organiser-page-nights-feed (34b165ca) |
| Claim + find + onboarding polish (claim sheet retry, team page errors, teach row, edit save error, edit back, Instagram hint, bio) | web | DONE | -- | W#1411, W#1412, W#1422, W#1423, W#1431, W#1432 |
| Different on N dates (Details/Prices) | web | DONE | -- | W#1406 |
| Details and Prices on every event shape (tests only; closes Walk B's 10 untested cells) | web | PR OPEN, tests only | checks, review | claude/details-prices-shape-matrix |
| Page row returns to Review after save | web | PR OPEN, `phone-qa-section` red (PR body) | body fill, checks | W#1433 |
| Plain note when an editor picture does not load | web | PR OPEN | checks, review | W#1442 |
| Line-up no match offers Ask the team | web | PR OPEN (this PR) | checks, review, merge | claude/lineup-nomatch-ask-team; brief/lineup-nomatch-ask-team |
| Door no-access card gets Check again + Back | web | PR OPEN, green at last read | review, merge | W#1439 |
| Claimed, status not re-read: `claim-copy-team-not-person`, `event-page-how-to-pay`, `team-add-confirm` (starts after W#1412), `onboarding-find-invite-copy` | web | UNKNOWN, claimed in PROGRAM.md | lead to confirm | PROGRAM.md "Claimed branches" |
| Interim seats I1 (seat table, gates, cooldown, invite manager branch) | admin | PR OPEN, red: unit-build, placeholder-merge-gate | fix round, independent review, replay proof, owner Approve | A#1284 claude/onboarding-interim-seats-db (cbab02b9); brief/onboarding-interim-seats-db |
| Interim identity I7 (Instagram auto-link, field rule, likely matches) | admin | BRIEFED | I1 applied | brief/onboarding-interim-identity-db (43dbff59) |
| Make a copy of an event (`organiser_copy_event_v1`) | admin | BRIEFED | one migration at a time through the queue; I1 first | brief/organiser-copy-event-db (5b4f4db1) |
| Live-now compat version | admin | PR OPEN `run-ci,migration-queued` | queue run, review, apply | A#1280 claude/live-now-compat-version |
| Live-now Website half | web | PARTIAL, handover PR open | A#1280 applied (payload has no version on prod) | W#1275 claude/live-now-s2web; brief/live-now-s2web (7056f89d) |

## Slices not yet briefed (drafters: verify each on origin/main first)
| Item | Repo | Blocked by | Source |
|---|---|---|---|
| I2 guard arms for seats (`interim_seat_without_manager_row` and four more) + db-contract step | admin + web | I1 and I7 applied | PLAN-interim-manager-seats.md "Pieces" |
| I3 admin Seats panel + likely-match row on Access requests | admin | I1 + I7 applied | same |
| I4 notification queue + `send-access-request-email` edge function | admin | I1 applied | same |
| Declined request says when you can ask again (P3 Welcome + /account) | web | PR OPEN (no 390x844 walk) | review; owner Approve | claude/declined-ask-again-date |
| I5 Website: ownerless claim copy, `/account` request status, interim label in P3, ticket tools hidden | web | PARTIAL: refusal copy for `declined_recently` and `interim_cannot_add` done (PR: claude/declined-recently-copy); interim label + ticket tools hidden in PR (claude/interim-seat-p3-labels, #1487); claim copy and `/account` status not started. I7 and Design Gate by hand | brief/interim-seat-p3-labels; same |
| I6 G1 write-door doc gains the new doors | web docs | I1 | I6 write-door doc done: `docs/scoping/g1-write-door-check.md` "Interim-seat doors (added with I1)"; PR: claude/seat-doors-doc |
| E7 cancelled nights shown marked "Cancelled" on the page | web | owner yes/no (below) | GAPS file, ranked gap 4 |
| Remaining P3 slices W3 later (Name/details save model, Prices, History, create flows), W4c invites/claims + organiser-side Going | web | needs re-survey against main; ARC-p3.md is stale | plans/ARC-p3.md section 2 |
| Organiser analytics S1/S2 | admin | parked until the organiser dashboard exists | READY-QUEUE row 13 |
| Walk-report dead ends A to D (claim, edit-event shapes, team/switch, dancer view) | web | each needs a fresh check on main first (12 stale "does not exist" claims before) | docs/handover on W#1407 to W#1410 |

## Owner decisions pending
- E7: show upcoming cancelled nights marked "Cancelled" and never count them in stats? (23 organisers have one.)
- Light theme for the organiser area: parked, no answers yet (PROGRAM.md PARKED 2026-11-04).
- Interim seats are fully decided (D1-D18); D15 self-find at sign-up is PARKED by the owner.
- Estrella Dance / Kal: until I1 ships, do not use `admin_invite_person_v1` (it would make Kal OWNER); safe stopgap is "Ask to join" then grant manager.

## Rules for briefs in this arc
- Serve the goal: an organiser claims a page and edits an event. Every screen brief carries INVENTORY.md step 0 and the shape table (upcoming 0/1-5/6-100/100+, past-only 17, no nights 2, team 1/2-3).
- Migrations go one at a time through the migration queue; Website slices wait for their admin half to be APPLIED, not merely merged.

## Not verified here
- Prod value of `organiserP3`; checks on W#1428, W#1442, A#1284 beyond the red names above; the four claimed branches' state.
