# Brief: merge tiers (Website) -- three tiers by blast radius

Owner click 2026-11-15: stop gating by path; gate by blast radius, detect and revert fast. Lane: careful (touches .github/ and scripts/, so the PR needs the owner's Approve; guard paths are owner-only for automation).

## Tiers
- A (owner Approve, rare): any guard path (`isGuardPath`, scripts/lib/guard-paths.mjs), anything under supabase/migrations or `*.sql`, anything touching secrets, money (payments/Stripe), or deletes of prod data.
- B (merge on green CI, worker self-review recorded in the PR body): other `scripts/`, `.claude/`, `.github/` workflow files that are not guard paths (riskTier hard but not guard).
- C (auto-merge on green): everything else.

## Build (smallest working version, behind a repo variable `MERGE_TIERS_ENABLED`, default off)
1. `scripts/lib/merge-tier.mjs`: `classifyTier(files) -> 'A'|'B'|'C'` (highest tier of any file wins). Reuse `isGuardPath` and `riskTier`; no second path list. Unit tests incl. a mutant that downgrades a guard path to B (must fail).
2. `scripts/owner-approval-audit.mjs`: with the flag on, a tier-B commit without owner approval is OK (no red, no issue); tier A keeps today's rule exactly (owner approval at head, guard paths owner-only). Flag off = byte-identical behaviour to today. Tests for both.
3. Workflow PROPOSAL `docs/proposals/auto-merge-on-open.yml` (cloud workers cannot write `.github/workflows/`; the orchestrator installs it after review; write it as a ready-to-copy file): on pull_request (opened, reopened, synchronize) where the author is `kiki-claude-bot` and `vars.MERGE_TIERS_ENABLED == 'true'` and the tier is B or C, run `gh pr merge --auto --squash --match-head-commit <sha>`. Tier A: do nothing. Never act on forks. GitHub auto-merge then waits for the required checks (ruleset "main checks").
4. Workflow PROPOSAL `docs/proposals/revert-on-red.yml` (same rule: proposal file only): on `workflow_run` completed with conclusion failure for a push to main, when the failing commit's PR was tier B or C and merged by auto-merge: open ONE bot-authored revert PR (`git revert`, branch `claude/revert-<sha8>`), comment on the original PR, and ping the owner once (issue labelled `owner-turn`). Never revert tier A. At most one open revert PR per commit; no loop (never revert a revert).
5. Docs: add a short section to docs/automerge.md (keep it under 25 lines). No changelog.

## Rules
- Do not touch the 7 required checks or the ruleset. Do not change guard-paths.json.
- Phone 390x844 walk: not applicable (no UI). "Verified on real data": not applicable, say so in the PR body.
- Record in the PR body: the tier of this PR itself (A), what the flag does, Not verified (revert PR end-to-end needs a real red main; test with a dry-run input `dry_run: true` on workflow_dispatch that opens no PR).
- Local unit/pre-ship are red on this PC under Node 24; CI (Node 22) is the check.
- Push only via the dispatch gate's bot path; branch `claude/merge-tiers`.
