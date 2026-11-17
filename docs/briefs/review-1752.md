# Review: PR #1752 (ci-speed) at head d239b93ff, hard tier (.github/, scripts/)
Branch for your report: claude/review-1752 (docs only, doc `docs/review/review-1752.md`, ends with a line `## Hard-tier: PASS` or `## Hard-tier: BLOCK`). Review only; do not push to claude/ci-speed.
Read: `git fetch origin claude/ci-speed`; `git diff origin/main...origin/claude/ci-speed`; handover docs/handovers/ci-speed.md; owner brief docs/briefs/ci-speed-profile-and-trim.md.
Check, with evidence (run the commands, name mutants):
1. phone-qa.yml: light/skip/full mode decision cannot skip phone tests for a PR touching app code; fail-safe on missing classifier output; shard weights PWTEST_SHARD_WEIGHTS cover every spec (no spec dropped or run twice: compare union of shard test lists with the unsharded list).
2. scripts/ci/docs-only.mjs ci_light classifier: a PR touching src/ plus a workflow is NOT light; an own-workflow edit stays full.
3. wallclock-budget job (phone-qa.yml): uses only github.token with actions: read; advisory (continue-on-error) only on pull_request; no secret reachable; check-ci-wallclock.mjs exits 0/1/2 as documented; self-test kills its mutants.
4. tests/routeRunner.test.ts change: the mutant case still fails when the route table is broken (revert the guarded behaviour, expect red).
5. ci-budget-guard.yml is unchanged vs main.
Keep the report under 60 lines.
