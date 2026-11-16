# Self-test: merge tiers on main (read-only verification, flag stays OFF)

Repo 123constante/bachata-website. Verify main after #1725 and #1726 merged. Do NOT edit product code, workflows or variables. Do NOT set MERGE_TIERS_ENABLED.

## Run on a fresh checkout of origin/main (npm ci --ignore-scripts first)
1. `npx vitest run tests/mergeTier.test.ts tests/automationMoney.test.ts tests/automationPauseWorkflows.test.ts tests/automationRegister.test.ts`
2. `node scripts/check-workflow-artifact-policy.mjs`
3. `node scripts/check-secrets-register.mjs`
4. `node scripts/owner-approval-audit.mjs` (if it needs GH env, say so under Not verified)
5. `cmp docs/proposals/auto-merge-on-open.yml .github/workflows/auto-merge-on-open.yml` and the same for revert-on-red.yml
6. Mutant check: in a scratch copy, downgrade one guard path in .github/automation/guard-paths.json to tier B; tests/mergeTier.test.ts must then FAIL. Revert the scratch copy. Never push it.
7. Classify with scripts/lib/merge-tier.mjs: a docs-only file set must be tier A or B per its rules; a set with package.json, vercel.json, supabase/functions/x/index.ts, a price/payment/promo/fee path must NOT be the lowest tier. Report each result.

## Output
Write docs/review/selftest-merge-tiers.md on branch claude/review-selftest-merge-tiers (from main). One line per step: PASS or FAIL with the exact failing line. Include exactly one heading line `## Self-test: PASS` or `## Self-test: FAIL`. Push once. Last commit subject ends with [worker-done <ticket>].
