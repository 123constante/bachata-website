# Review PR #1726 (Website): merge-tier slice 4b, harden auto-merge-on-open and revert-on-red, flag off

Repo 123constante/bachata-website. PR #1726, branch claude/merge-tier-slice4b, head 80c2fac5f773afde54c7523a35d46fea8f7f7e5c.
You are an independent reviewer. Do not edit product code. Review only. Hard tier (workflows, secrets-register).

## What the PR claims
Slice 4b of the #1681 follow-ups (brief: docs/briefs/slice4b-merge-tier-workflows.md on branch brief/merge-tier-slice4b). 7 files: .github/workflows/auto-merge-on-open.yml and revert-on-red.yml, their byte copies in docs/proposals/, .github/automation/secrets-register.json, tests/automationPauseWorkflows.test.ts, tests/automationRegister.test.ts. Flag MERGE_TIERS_ENABLED stays OFF.
Claimed: disable step runs always() and fails closed if --disable-auto errors on a still-armed PR; auto-merge-on-open moves to pull_request_target, branches [main], base.ref==main, checkout ref main (never PR head), its untrusted_trigger_grandfathered entry dropped; revert-on-red GITHUB_TOKEN perms reduced to read with writes via BOT_PR_TOKEN, owner-turn issue if gh pr create fails, ancestor check on the dispatch sha.
Out of scope: the 2 allow-list entries, flipping the flag.

## Check, with file:line evidence
1. With MERGE_TIERS_ENABLED unset or false, can either workflow arm auto-merge, push, open a PR or revert anything? Trace every job and step condition.
2. pull_request_target safety: any checkout or execution of PR head code? Any `run:` use of PR title, body, branch name without env indirection? Is base.ref==main enforced on every job?
3. Disable step: if: always() present, fails closed, safe when paused.
4. revert-on-red: GITHUB_TOKEN permissions minimal (read); every write uses BOT_PR_TOKEN; ancestor check actually blocks a non-main sha; owner-turn fallback correct.
5. secrets-register.json: only the auto-merge-on-open grandfather entry removed, nothing else loosened; register matches the workflow triggers.
6. docs/proposals/*.yml byte-identical to .github/workflows/*.yml (cmp).
7. Run `npx vitest run tests/automationPauseWorkflows.test.ts tests/automationRegister.test.ts tests/mergeTier.test.ts` and `node scripts/check-workflow-artifact-policy.mjs` in a checkout of the head.

## Required output
Write the review to docs/review/review-1726.md on branch claude/review-1726 (from main).
The file must:
- name "PR #1726" and, in the first 10 lines, the literal text `head 80c2fac5f773afde54c7523a35d46fea8f7f7e5c`
- list findings
- the merge gate parses every `head <sha>` token in the first 2500 characters and requires ALL of them to equal the head above: write the word "head" followed by a sha ONLY ONCE in that span; refer to any other commit by bare sha with no word "head" before it, after the first 2500 characters
- contain, on its own lines, EXACTLY:
  ## Verdict: PASS            (or: ## Verdict: PASS WITH NITS | ## Verdict: BLOCK)
  ## Hard-tier: PASS          (or: ## Hard-tier: FAIL with reason)
Push once. Last commit subject ends with [worker-done <ticket>].
