# Review PR #1700 (Website): price laptop-medium runner label at 1

Repo 123constante/bachata-website. PR #1700, branch claude/ci-budget-laptop-medium, head 6bf2ecee58361fe3b2e737773bfc1ba2c96e6cf6.
You are an independent reviewer. Do not edit product code. Review only.

## What the PR claims
CI Budget Guard is red on main (exit 2, "COULD NOT MEASURE ... runner label(s) [laptop-medium]"). The PR adds `laptop-medium: 1` plus a `//runnerMultipliers-laptop-medium` note to `ci-budgets.json`. Same shape as the merged laptop-light entry (#1689). Nothing else changes.

## Check, with file:line evidence
1. `git diff origin/main...head`: only `ci-budgets.json`; valid JSON; no other key changed.
2. Multiplier 1 over-counts, never under-counts (loadConfig refuses <= 0). Confirm in scripts/check-ci-budget.mjs.
3. Grep runs-on / route-runner across .github/workflows for every `laptop-*` label in use. Any label other than laptop-light and laptop-medium that is still unpriced = list it (nit, not block).
4. Substring matching: does the new key `laptop-medium` collide with or shadow `laptop-light` or any other key? Run `node scripts/check-ci-budget.mjs --self-test`.

## Required output
Write the review to docs/review/review-1700.md on branch claude/review-1700-r1 (from main).
The file must:
- name "PR #1700" and, in the first 10 lines, the literal text `head 6bf2ecee58361fe3b2e737773bfc1ba2c96e6cf6` (word "head", one space, then the sha)
- list findings
- contain, on its own lines, EXACTLY:
  ## Verdict: PASS            (or: ## Verdict: PASS WITH NITS | ## Verdict: BLOCK)
  ## Hard-tier: PASS          (or: ## Hard-tier: FAIL with reason)
Push once. Last commit subject ends with [worker-done <ticket>].
