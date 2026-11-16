# Review PR #1681 (Website): install merge-tier workflows, flag off

Repo 123constante/bachata-website. PR #1681, branch claude/install-merge-tier-workflows, head d8fbc35ecf656c5aab809c6411d1cb8379a03204.
You are an independent reviewer. Do not edit product code. Review only.

## What the PR claims
Installs docs/proposals/auto-merge-on-open.yml and revert-on-red.yml into .github/workflows/. Both jobs skip unless repo variable MERGE_TIERS_ENABLED is true; it stays off. Round 2 added the automation pause-switch reader (`node scripts/automation-pause.mjs`) to both workflows. Guard paths touched: .github/workflows/*, scripts/check-workflow-artifact-policy.mjs, .github/automation/secrets-register.json.
A round-1 review at head 8fcc12be was PASS WITH NITS (safe to merge while the flag is off). The known follow-ups (guard-paths.json additions, money-set widening, disable step if: always(), pull_request_target hardening, revert-on-red token perms) are tracked as a separate slice 4 and are NOT in scope here.

## Check, with file:line evidence
1. With MERGE_TIERS_ENABLED unset or false, can either workflow arm auto-merge, push, open a PR or revert anything? Trace every job and step condition.
2. Pause switch: does a failed or missing reader fail CLOSED (no arm, no revert PR)? Is the disable step safe when paused?
3. Untrusted input: any use of PR title, body, branch name or head code in `run:` without env indirection? Does either workflow check out or execute PR head code with a write token?
4. Token permissions per job: minimal? Any secret exposed to fork PRs?
5. docs/proposals/*.yml byte-identical to the installed copies (diff them).
6. secrets-register.json entries and scripts/check-workflow-artifact-policy.mjs change: correct, no loosening beyond the two dated grandfather entries.
7. Run `npx vitest run tests/automationPauseWorkflows.test.ts tests/automationRegister.test.ts` in a checkout of the head.

## Required output
Write the review to docs/review/review-1681.md on branch claude/review-1681 (from main).
The file must:
- name "PR #1681" and, in the first 10 lines, the literal text `head d8fbc35ecf656c5aab809c6411d1cb8379a03204`
- list findings
- contain, on its own lines, EXACTLY:
  ## Verdict: PASS            (or: ## Verdict: PASS WITH NITS | ## Verdict: BLOCK)
  ## Hard-tier: PASS          (or: ## Hard-tier: FAIL with reason)
Push once. Last commit subject ends with [worker-done <ticket>].
