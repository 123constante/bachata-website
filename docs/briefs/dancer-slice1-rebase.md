# Rebase PR #1577 (dancer dashboard slice 1) onto main after #1576 merged (branch claude/profile-dash-dancer-build)
Lane: normal. Same branch, one push, no [skip preview] on the final push.

## Situation
#1577 (head 24022af, finish-review PASS, CI green except contract-check which is red on main) is now CONFLICTING because #1576 (dancer Home + claim card, same area) merged to main. I wrongly closed and have reopened it; the branch was restored at 24022af.

## Do
1. `git fetch origin main claude/profile-dash-dancer-build`; merge origin/main into the branch (merge, not rebase, so the reviewed commits stay). Resolve conflicts keeping BOTH features: #1576 (Home Option A, claim card, trimmed tiles) and #1577 (Switch/Account strip, Add a profile). Where they overlap on Home, #1576's Home is the base and #1577 adds its strip.
2. Run `npm run test:unit` for dancer-app, `node scripts/check-dancer-area-isolation.mjs`, `npm run check:bundle-budget` (perf-budgets.json: take main's tightened values; do not loosen), tsc on touched files.
3. Do not touch files outside src/modules/dancer-app/ except allowlisted seams, tests, docs. If a conflict forces it, stop and report.
4. Handover docs/handover/dancer-dash-1577/handover.md: what conflicted, how resolved, per-job results. PR body: keep Verified/Not verified; add the per-job table at the new head. End the final commit with [worker-done <ticket>].
