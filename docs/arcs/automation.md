# Arc: automation (migration queue, CI offload, auto-merge, auto-walk gate, lead tooling)

Last verified: 2026-11-06 against Website origin/main a8c7b7d00 and admin origin/main 514fb0ab, with `gh pr view`, `git ls-tree origin/main`. Sources: plans/ACCEPTANCE-full-automation.md (section 16 slice order 1-15 is the slice list), plans/DECISIONS-automation-2026-11-05.md, READY-QUEUE.md AUTOMATION rows (many are stale: rows 1-4, 44, 63, 64 say RUNNING or BLOCKED but their PRs are merged, see below), plans/SLOT-POLICY.md. `W#` = bachata-website, `A#` = bachata-admin.
Rank 1 in the owner's order. Goal: workers' PRs reach main with the owner touching only what a person must (Approve for hard-tier, money, secrets). Anything under `.github/workflows`, `scripts/**` guards is hard tier: owner Approve at the final head.

## Slices (numbers are ACCEPTANCE section 16)
| Slice | Repo | Status | Blocked by | PR / branch / brief |
|---|---|---|---|---|
| 1 Pause switch + readers | admin | DONE | -- | A#1230 (.github/workflows/automation-pause-guard.yml) |
| 2 Foundations: required-jobs, arming, drill records, identity register | both | DONE in part: required-jobs.json, arming.json, components.json on both mains; money-set.json on Website main only | `money-set.json` + `isMoney()` on admin; GET /user identity check not seen | A#1232, A#1236, A#1241, A#1243 |
| 3 Queue stop alert + trial self-heal | admin | DONE | -- | A#1226 |
| Migration queue fixes: settle wait, placeholder gate, rename in merge | admin | DONE | -- | A#1181, A#1186, A#1202, A#1244, A#1246, A#1253, A#1260, A#1268, A#1282 |
| Fixture regen workflow + branch-context fix + seed library | admin | DONE | -- | A#1264, A#1279, A#1269 (queue rows 4, 44, 3 are stale) |
| Shift-left Undo SQL header check | admin | DONE | -- | A#1273 |
| CI offload stage 3 (route by `WEB_RUNNER_LABEL`) | web | MERGED; owner steps pending (runner group workflows, gate.conf, read token) | owner | W#1402 |
| Entry-point proof in pre-ship | web | DONE | -- | W#1405 |
| Workflow allow-list guard wired | web | PR OPEN | chain of allow-list PR then re-run masking check | W#1394 claude/automation-loop-editable-workflows |
| 4 Queue self-heal act mode + SQL classifier + read-only catalog role | admin | NOT STARTED (no classifier file on main) | slice 2 admin remainder | ACCEPTANCE section 3.1, 16 |
| 5 Apply retry-once, duplicate version rule, half-applied detection | admin | NOT STARTED | slice 4 | ACCEPTANCE section 16 |
| 6 / 6a Approver GitHub App, `automation-approve.yml`, `review-verdict.yml` | admin | NOT STARTED (neither workflow on main) | slices 4, 5; owner clicks for the App | ACCEPTANCE section 16; ship OFF with kill switch |
| 7 Plumbing (gh 502 wrapper, ledger auto-close, preflight, worktree helper) | local tools | PARTLY DONE: ledger-sweep, verify-branch, prepush-check, lead-tick in ~/.claude/bin | wiring left | READY-QUEUE rows 16-18, 27, 31, 36, 40 |
| 10 Auto-walk gate: judge, coverage table, host lock, budget, decision, pictures pinned, report builder, iOS static scan | web | IN FLIGHT as small PRs | see rows below | ACCEPTANCE section 11 |
| 10a Judge compares screens with walk-coverage.json | web | PR OPEN | review, owner Approve (scripts hard tier) | W#1435 |
| 10b Walk judge daily budget (fail closed) | web | PR OPEN | checks, review, owner Approve | W#1440 |
| 10c Walk host picker/lock | web | PR OPEN | checks, review, owner Approve | W#1441 |
| 10d Walk gate decision (judge pass at live head or owner waiver) | web | PR OPEN | checks, review | W#1443 claude/walk-gate-decision |
| 10e Walk pictures pinned to head | web | PR OPEN | checks, review | W#1444 |
| 10f Walk specs use shared garbled helper | web | PR OPEN (tests only) | merge | W#1430 |
| 10g iOS static scan; report builder | web | BRIEFED, not dispatched (pacing) | one dispatch per tick | brief/walk-ios-static-scan (38d6e5fa), brief/walk-report-builder (e6aa1068) |
| 8 Canary, 9 Auto-revert, 11 Phone-check removal, 12 Migration PR header contract, 13 Edge deploy workflow, 14 Owner summary, 15 Switch-on | both | NOT STARTED | slices 4-6, 10 | ACCEPTANCE section 16 |
| Auto-refill loop (LeadRefill task, headless `claude -p`) | local | RUNNING; one supervised real pass still to do | owner sees the log before scheduling | READY-QUEUE row 61 |

## Slices not yet briefed (drafters: verify each on origin/main first)
| Item | Repo | Blocked by | Source |
|---|---|---|---|
| Slice 4a classifier (deny-by-default SQL classifier, `migration-classifier.yml`) | admin | owner Approve cycle; builds on slice 2 files | ACCEPTANCE 3.1; DECISIONS 11-05 "Slices 4a, 4b, 5, 13" |
| Slice 4b queue self-heal act mode | admin | 4a | same |
| Slice 5 apply retry + half-applied detection | admin | 4a/4b merged | same |
| Slice 13 edge function deploy workflow with previous-version record | admin | slice 2 | ACCEPTANCE 16 |
| `money-set.json` + `isMoney()` for admin auto paths | admin | none known | ACCEPTANCE slice 2, A16 |
| Vercel `ignoreCommand` so docs/tests/scripts-only pushes build no preview | web | owner Approve (vercel.json hard tier); deploy cap ~100 per 24 h | DECISIONS 11-05 |
| Push-or-block Stop hook (auto-push layer 1) and rescue worker after 30 min idle (layer 3) | local | layer 2 done | DECISIONS 11-05 "Auto-push" |
| Follow-ups from the auto-merge review: refuse test files importing scripts/, label rule = last bot add, review comment before label | web/admin | web test-source refusal: PR OPEN (W#1468, hard tier, scripts/), owner Approve at final head; label rule and comment-before-label still to do | W#1468 claude/automerge-web-test-source-refusal; READY-QUEUE "FOLLOW-UP (review nits)" |
| Owner-approval audit also checks the class C review record (detective, `RECORD-MISSING`) | web | PR OPEN (hard tier, scripts/), owner Approve at final head | owner Approve | claude/audit-review-record-class-c; READY-QUEUE "owner-approval-audit.mjs also check the review record (detective)" |
| Dell exit-code and verify-branch Dell offload wiring | local | Dell login (owner forgot password 2026-11-05) | READY-QUEUE row 16 |

## Owner decisions pending
- Approve batch (hard tier, queue order): W#1394 after its allow-list parent, W#1435, W#1440, W#1441, W#1443, W#1444 once green and independently reviewed.
- CI offload stage 3 owner steps (runner group selected workflows, gate.conf, read token); cloud environment setup script that pre-installs node_modules (settings only the owner can change; READY-QUEUE row 19).
- Auto-merge class list (plans/AUTOMERGE-CLASSES.md) is drafted, NOT enabled; the lead shows it to the owner before enabling.
- Slice 6 approver may approve hard-tier PRs only with the extra proofs decided 2026-11-05; Claude itself never approves.

## Rules for briefs in this arc
- Cloud workers cannot edit `.github/workflows` unless the narrow allow-list covers the file; say so in the brief and give the patch route (docs/handover/*.workflow.patch, applied with apply-patch.mjs).
- Each slice adds its own drill; no stacked PRs (a child waits for its parent to merge).

## Not verified here
- Checks of every open W# above; owner steps for W#1402; whether slices 1-3 drills are recorded; slices 7 and 61 are local state, not repo state.
