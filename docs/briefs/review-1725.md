# Review PR #1725 (Website): merge-tier slice 4a, guard-path and money sets, flag off

Repo 123constante/bachata-website. PR #1725, branch claude/merge-tier-slice4a, head d9708c5727891dc7a23b133045d0f26c37dc7060.
You are an independent reviewer. Do not edit product code. Review only. Hard tier (touches .github/automation/*, scripts/).

## What the PR claims
Slice 4a of the #1681 follow-ups. 7 files: .github/automation/guard-paths.json (adds scripts/lib/merge-tier.mjs, scripts/lib/review-scope.mjs, tests/mergeTier.test.ts as tier A), .github/automation/money-set.json (widened: *price*, *payment*, *promo*, *fee*; package.json, vercel.json, vite.config.ts, non-ticket supabase/functions/**), scripts/lib/merge-tier.mjs, tests/mergeTier.test.ts, tests/automationMoney.test.ts, scripts/check-workflow-artifact-policy.mjs (stale MEASURED comment), docs/automation-pause.md (one line). Flag MERGE_TIERS_ENABLED stays OFF. The brief is docs/briefs/slice4a-merge-tier-sets.md on branch brief/merge-tier-slice4a.
Out of scope: workflow files (slice 4b), the allow-list entries, flipping the flag.

## Check, with file:line evidence
1. Each new guard-paths entry exists on disk and lands in tier A. Does any new pattern fail OPEN (a money file classified lower than before)?
2. Money-set widening: do *price*, *payment*, *promo*, *fee* over-match harmlessly (more review, never less)? Any existing entry removed or narrowed? Are ticket supabase/functions/** still the strictest tier?
3. Brief listed 6 files it may touch; the diff also touches tests/automationMoney.test.ts. Is that change justified and harmless?
4. scripts/lib/merge-tier.mjs change: read the full diff; does it alter classification of any existing path? Run the tests to prove.
5. check-workflow-artifact-policy.mjs: the comment numbers match real output of `node scripts/check-workflow-artifact-policy.mjs`; no logic loosened.
6. Run `npx vitest run tests/mergeTier.test.ts tests/automationMoney.test.ts tests/automationRegister.test.ts` and `node scripts/check-workflow-artifact-policy.mjs` in a checkout of the head.

## Required output
Write the review to docs/review/review-1725.md on branch claude/review-1725 (from main).
The file must:
- name "PR #1725" and, in the first 10 lines, the literal text `head d9708c5727891dc7a23b133045d0f26c37dc7060`
- list findings
- the merge gate parses every `head <sha>` token in the first 2500 characters and requires ALL of them to equal the head above: write the word "head" followed by a sha ONLY ONCE in that span; refer to any other commit by bare sha with no word "head" before it, after the first 2500 characters
- contain, on its own lines, EXACTLY:
  ## Verdict: PASS            (or: ## Verdict: PASS WITH NITS | ## Verdict: BLOCK)
  ## Hard-tier: PASS          (or: ## Hard-tier: FAIL with reason)
Push once. Last commit subject ends with [worker-done <ticket>].
