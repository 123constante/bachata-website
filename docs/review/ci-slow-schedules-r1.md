# Review: PR #1744 head 265b66751658544cefd5c5887887472f34577f9c
## Verdict: PASS
Reviewed head 265b66751658544cefd5c5887887472f34577f9c

Method: git only (`git diff origin/main...origin/claude/ci-slow-schedules`, `git grep` on the PR head). No merge, no approval.

## 1. Cron strings: valid, and match the workflow edits
| Workflow | Old | New | Valid? |
|---|---|---|---|
| automation-pause-guard.yml | `*/30 * * * *` | `13 */2 * * *` | yes (minute 13, every 2nd hour) |
| autopilot.yml | `17 * * * *` | `17 */2 * * *` | yes |
| pr-mergeable-guard.yml | `17 * * * *` | `47 */2 * * *` | yes; moves off :17 so it no longer collides with autopilot |
| queue-watchdog.yml | `*/15 * * * *` | `7 * * * *` | yes (hourly at :07) |

Each change is exactly one `cron:` line (queue-watchdog also one header comment). No other trigger (`push`, `issues`, `workflow_dispatch`) was touched. Brief says "five cron schedules"; the diff has FOUR cron lines in four workflows (the fifth item is probably the two tests). Not a defect, just a count mismatch in the brief.

## 2. No required check depends on a schedule
- The required gate is ruleset `main checks` (docs/automerge.md:188): integrity, bundle-budget, e2e-smoke, wallclock-brand, masking-check, bom-check, unit (docs/handover/pr-stub-body-no-red.md:48). All are PR-triggered; none of the four slowed workflows is in that list.
- pr-mergeable-guard is deliberately not a `pull_request` workflow and is not a required check; its push-to-main trigger is unchanged. Only its backstop sweep is slower (hourly to every 2h).
- automation-pause-guard: the label add/remove path (`issues: labeled/unlabeled`) is unchanged and still immediate. Only the schedule backstop (fail-closed disarm for a label set with GITHUB_TOKEN) is slower, worst case about 2h instead of 30 min. Owner-visible tradeoff, acceptable given the immediate path.
- queue-watchdog is inert unless `QUEUE_ENABLED=true`; stalled work is noticed up to 1h later instead of 15 min.
- No script or test grep hit a cadence assumption (no staleness threshold keyed to the schedule interval).

## 3. Tests match the new crons
- tests/automationPauseGuard.test.ts: exact `toEqual([{ cron: '13 */2 * * *' }])` matches the workflow.
- tests/autopilotWorkflow.test.ts: regex widened to `/^\d{1,2} (\*|\*\/2) \* \* \*$/`; `17 */2 * * *` matches. It still accepts the old hourly form, so it is looser than pinning, but intentional and fine.
- No test pins the pr-mergeable-guard or queue-watchdog cron (grep of tests/ and scripts/), so nothing else needs updating.
- I did not run vitest here; this is a static read.

## 4. Nothing else changed
`git diff --stat`: 6 files, 7 insertions, 7 deletions (4 workflows, 2 tests). No source, config, or docs changes.

## Non-blocking nits (stale wording left behind, no behaviour impact)
- automation-pause-guard.yml:10 still says "every 30-minute scheduled run"; test title still says "every 30 minutes".
- autopilot.yml:159 failure issue text says "The hourly autopilot run failed"; tests/autopilotWorkflow.test.ts:18 title says "hourly schedule".
- docs/queue.md:15 still says queue-watchdog runs "every 15 min".
- docs/ci-guard-notes.md:459 and :536 still say pr-mergeable-guard runs "hourly".
Suggest a follow-up wording pass, not a blocker.
