# GitHub-native work queue

Issues labelled `queue` are worked by a cloud Claude worker (Sonnet) with no lead session. Green PRs
auto-merge unless `owner-reserved`. Stalled items return to the queue once, then go to the owner.
**Everything is inert unless the repo variable `QUEUE_ENABLED` is exactly `true`.**

Daily budget (USD): 20

## Parts

| File | Job |
|---|---|
| `.github/workflows/queue-worker.yml` | on label `queue` (or dispatch): `scripts/queue-claim.mjs` swaps `queue` to `in-progress` (the lock), then `anthropics/claude-code-action` runs on branch `claude/queue-<issue>`. `bot-pr.yml` opens the PR. |
| `.github/workflows/queue-merge.yml` | `pull_request_target` for `claude/queue-*` PRs: `scripts/queue-merge-decide.mjs` says reserved or not; not reserved gets `gh pr merge --auto --squash --match-head-commit`. |
| `.github/workflows/queue-watchdog.yml` | every 15 min, no LLM: `scripts/queue-watchdog.mjs`. |
| `.github/workflows/queue-daily-report.yml` | daily, no LLM: `scripts/queue-daily-report.mjs` comments on the issue "Queue daily report" (pin it). Warn-only over the budget above. |
| `.github/ISSUE_TEMPLATE/queue-item.yml` | Goal / Files / Acceptance check / Out of scope; auto-labels `queue`. |

## Labels (create once)

```
gh label create queue --color 0E8A16 --description "Waiting for the queue worker"
gh label create p1 --color B60205; gh label create p2 --color D93F0B; gh label create p3 --color FBCA04
gh label create in-progress --color 1D76DB --description "Claimed by a worker run"
gh label create owner-reserved --color 5319E7 --description "Never auto-merged; only the owner removes this"
gh label create owner-turn --color E99695 --description "Worker gave up or stalled twice; owner decides"
```

Priority: p1, then p2, then p3, then unlabelled; oldest first. A `Related: #n` line (max 3) in the
issue body batches those issues into the same run.

## Caps

- Normal run: `--max-turns 40`, 30 minutes. At 80% (turn 32 / minute 24) the worker stops new work, commits, pushes and posts a "Queue checkpoint" comment (Done / Next / Files touched / Open questions).
- An `if: always()` step commits a dirty tree as `WIP: checkpoint (cap hit)`, pushes, comments `git diff --stat`, and comments tokens and cost on the PR (marker `queue-run`, summed by the daily report).
- First cap hit: issue goes back to `queue`. Second cap hit: `owner-turn`. The owner comments exactly `extend` to give one more run of 80 turns / 55 minutes.
- Watchdog: `in-progress` with no live run for over 1 hour, or a `claude/queue-*` PR with red checks: first stall requeues, second stall `owner-turn`. It never touches `owner-reserved` PRs.

## Reserved paths (never auto-merged)

`scripts/queue-reserved-paths.json` (migrations, SQL, RLS/policy, price, payout, payment files) plus
every HARD-tier path (`scripts/lib/review-scope.mjs` `riskTier`: `scripts/`, `.github/`, `.claude/`, `bin/`, `.githooks/`),
which still need the owner's Approve under `owner-approval.yml`. Those PRs get `owner-reserved`; only the owner removes it.

## Secrets and switch (the owner sets these; nothing here does)

- `ANTHROPIC_API_KEY` (new): the worker fails with a clear error if it is missing.
- `BOT_PR_TOKEN` (existing): all pushes, labels and merges. Never the owner's credential.
- Variable `QUEUE_ENABLED=true` turns it on.

## Turn on

1. Add secret `ANTHROPIC_API_KEY`. 2. Create the labels above. 3. Set variable `QUEUE_ENABLED=true`. 4. Label one small test issue `queue`.

## Roll back

Set `QUEUE_ENABLED` to anything else (or delete it): every job is skipped on its next trigger. Stuck `in-progress` issues can be relabelled by hand.
