# Review PR #1709 (Website): price bare laptop, acer-web, dell-web runner labels at 1

Repo 123constante/bachata-website. PR #1709, branch claude/ci-budget-laptop-bare, head 676028204c918334274408f0493f91897f14501c.
You are an independent reviewer. Do not edit product code. Review only.

## What the PR claims
CI Budget Guard push run 43781669007 exited 2 (COULD NOT MEASURE ... [laptop]). The PR adds `laptop`, `acer-web`, `dell-web` at multiplier 1 plus two // notes to ci-budgets.json. Nothing else changes.

## Check, with file:line evidence
1. git diff origin/main...head: only ci-budgets.json; valid JSON; no other key changed.
2. Multiplier 1 over-counts, never under-counts (loadConfig refuses <= 0). Confirm in scripts/check-ci-budget.mjs.
3. Substring matching: does key `laptop` shadow laptop-light/laptop-medium or any other key, or change any priced result (all are 1)? Run `node scripts/check-ci-budget.mjs --self-test` if it exists.
4. Any other runner label in use (grep runs-on / route-runner / WEB_RUNNER_LABEL) still unpriced = list it (nit, not block).

## Required output
Write the review to docs/review/review-1709.md on branch claude/review-1709-r1 (from main).
The file must:
- name "PR #1709" and, in the first 10 lines, the literal text `head 676028204c918334274408f0493f91897f14501c` (word "head", one space, then the sha)
- list findings
- contain, on its own lines, EXACTLY:
  ## Verdict: PASS            (or: ## Verdict: PASS WITH NITS | ## Verdict: BLOCK)
  ## Hard-tier: PASS          (or: ## Hard-tier: FAIL with reason)
Push once. Last commit subject ends with [worker-done <ticket>].
