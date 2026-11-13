# Brief: GitHub-native work queue (Website), behind a flag

Owner-approved design 2026-11-13. Smallest working version, ONE PR, everything OFF unless repo variable `QUEUE_ENABLED == 'true'`. Do not touch app code (src/, api/, supabase/).

## Goal
Issues labelled `queue` get worked by a cloud Claude worker (Sonnet) with no lead session. Green PRs auto-merge unless `owner-reserved`. Stalled items return to the queue once, then go to the owner.

## Labels (create via a one-off `workflow_dispatch` "setup-labels" job or document the `gh label create` list in docs/queue.md)
`queue`, `p1`, `p2`, `p3`, `in-progress`, `owner-reserved`, `owner-turn`.

## Files to add
1. `.github/workflows/queue-worker.yml`
   - Trigger: `issues: [labeled]` (label `queue`) plus `workflow_dispatch`. Job `if: vars.QUEUE_ENABLED == 'true'`.
   - Claim: pick the highest-priority open `queue` issue (p1>p2>p3>none, oldest first), swap `queue` -> `in-progress`. Label swap is the lock; if another run holds `in-progress` for the same issue, exit. Batch up to 3 related issues only if the picked issue body lists `Related: #n` (max 3).
   - Run `anthropics/claude-code-action` (pin an exact version, at least 2 weeks old) with model Sonnet, secret `ANTHROPIC_API_KEY` (owner adds it; fail with a clear `::error::` if missing). Cap: `--max-turns 40` and `timeout-minutes: 30`.
   - Worker prompt: read the issue (template fields), read `docs/MAP.md`, work on branch `claude/queue-<issue>`, commit AND push after each logical step. At 80% of the cap (turn 32 or minute 24) stop new work, commit, push, post a checkpoint comment (Done / Next / Files touched / Open questions). On resume, read the branch and the latest checkpoint comment first.
   - `if: always()` final step: if the working tree is dirty, commit as `WIP: checkpoint (cap hit)`, push, and comment a checkpoint built from `git diff --stat`. Also comment tokens and cost for the run on the PR (from the action's output if available).
   - Second cap hit on the same issue: label `owner-turn`, remove `in-progress`, attach the checkpoint. If the owner comments `extend`, one more run with cap 80 turns / 55 minutes.
   - Pushes and PRs use `BOT_PR_TOKEN` (same as bot-pr.yml), never the owner's credential.
2. `.github/workflows/queue-merge.yml`
   - Do NOT edit `bot-automerge.yml`. New workflow, `pull_request_target`, same safety pattern as bot-automerge.yml (classifier from main, no PR code run, `--match-head-commit`, `BOT_PR_TOKEN`), gated by `QUEUE_ENABLED == 'true'` and the PR branch starting `claude/queue-`.
   - Path check: if the PR touches `supabase/migrations/**`, RLS/policy SQL, or files matching prices/payouts/payments (list the globs in `scripts/queue-reserved-paths.json`), add label `owner-reserved` and disable auto-merge. Otherwise enable `gh pr merge --auto --squash`. Removing `owner-reserved` is owner-only.
   - Read `docs/automerge.md` and keep `owner-approval.yml` semantics: HARD-tier paths still need owner approval, so this workflow must not enable auto-merge for them (treat any HARD-tier path as owner-reserved; reuse `scripts/lib/review-scope.mjs` riskTier).
3. `.github/workflows/queue-watchdog.yml`
   - `schedule: */15`, plus dispatch. No LLM. A node script `scripts/queue-watchdog.mjs` (with a canary/self-test following docs/ci-guard-notes.md) finds `in-progress` issues older than 1 hour with no run, or `queue-` PRs with red checks. First stall: relabel `queue`, comment. Second stall (marker comment count): `owner-turn` and a comment. Never touches `owner-reserved` PRs.
4. `.github/workflows/queue-daily-report.yml` + `scripts/queue-daily-report.mjs`
   - Daily, no LLM. Posts to a pinned issue "Queue daily report": merged today, open queue by priority, `owner-turn` items, tokens and cost totals from the run comments. Warn-only when over the budget set in `docs/queue.md`; never stops the queue.
5. `.github/ISSUE_TEMPLATE/queue-item.yml`: fields Goal, Files, Acceptance check, Out of scope; auto-label `queue`.
6. `docs/MAP.md`: about 1 KB repo map (top-level dirs, where routes, data, tests, scripts live, the commands to run checks). Draft it from the real tree; keep under 1.2 KB.
7. `docs/queue.md`: how it works, the flag, the secrets needed (`ANTHROPIC_API_KEY`, `BOT_PR_TOKEN`), the label meanings, the cap numbers, how to roll back (set `QUEUE_ENABLED` to anything else).

## Rules
- Everything inert when `QUEUE_ENABLED` is not `true`. Workflow lint (`workflow-lint.yml`) and `architecture-guard.yml` must pass; fix anything they flag in this same PR.
- Pin every action to an exact version at least two weeks old. No PR-controlled text interpolated into shell.
- No secrets in files or comments. Do not set repo variables or secrets.
- Out of scope: removing the old lead/watchdog setup, admin repo, changing `bot-automerge.yml`, `dependabot-automerge.yml`.

## Acceptance check
- `workflow-lint`, `typecheck`, unit tests for the two new scripts pass at the PR head.
- With the flag unset, every new job is skipped.
- PR description lists what the owner must do: add `ANTHROPIC_API_KEY`, set `QUEUE_ENABLED=true`, then label one test issue `queue`.
- Not verified items listed honestly (the action cannot run end to end without the key).
