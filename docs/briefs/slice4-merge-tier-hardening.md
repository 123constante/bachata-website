# Slice 4: harden the merge-tier workflows before MERGE_TIERS_ENABLED is flipped

Repo 123constante/bachata-website. Branch claude/merge-tier-slice4 (from main). Hard tier: touches .github/workflows/*, .github/automation/*, scripts/. PR needs independent review.
Context: #1681 installed .github/workflows/auto-merge-on-open.yml and revert-on-red.yml (flag MERGE_TIERS_ENABLED stays OFF; do NOT set it). Review docs: docs/review/review-1681-r2.md on branch claude/review-1681-r2 (and docs/review/review-1681.md on claude/review-1681) hold the findings below.

## Do (smallest change per item, keep proposals in docs/proposals/*.yml byte-identical to the installed workflows)
1. .github/automation/guard-paths.json: add scripts/lib/merge-tier.mjs, scripts/lib/review-scope.mjs, tests/mergeTier.test.ts (tier A).
2. .github/automation/money-set.json: widen with *price*, *payment*, *promo*, *fee* patterns; package.json, vercel.json, vite.config.ts and non-ticket supabase/functions/** go to tier A/B (read scripts/lib/merge-tier.mjs for how the sets are consumed; add tests in tests/mergeTier.test.ts that a file matching each new pattern classifies as expected).
3. auto-merge-on-open.yml: the disable step must be `if: always()` with an unconditional `gh pr merge --disable-auto` when not armed or paused (verify the current round-2 shape first; change only what is missing).
4. auto-merge-on-open.yml: switch to pull_request_target with branches: [main], require github.event.pull_request.base.ref == 'main', check out ref main (never PR head code), then drop its entry from untrusted_trigger_grandfathered in .github/automation/secrets-register.json. Update tests (tests/automationRegister.test.ts, tests/automationPauseWorkflows.test.ts) so the register and workflow agree.
5. Low: revert-on-red.yml GITHUB_TOKEN permissions to contents/pull-requests/issues read (every write uses BOT_PR_TOKEN); open an owner-turn issue if `gh pr create` fails; ancestor check on the dispatch sha (git merge-base --is-ancestor against main).
6. Nits: fix the stale MEASURED jobs/steps comment in scripts/check-workflow-artifact-policy.mjs (re-derive from `node scripts/check-workflow-artifact-policy.mjs` output); add one line to docs/automation-pause.md that revert-on-red skips silently when paused.
Out of scope: removing the 2 allow-list entries (owner-only file), flipping the flag.

## Checks before pushing
`npx vitest run tests/automationPauseWorkflows.test.ts tests/automationRegister.test.ts tests/mergeTier.test.ts`, `node scripts/check-workflow-artifact-policy.mjs`, `npm run check:mojibake`, `npx tsc --noEmit -p .`. cmp docs/proposals/*.yml against .github/workflows/*.yml.

## Handover
PR body needs the Verified on real data block (no data path: say so; NOT verified: the workflows have never run, the flag is off). Docs/tests/workflow PR: delete the Phone QA section. Final commit subject ends [worker-done <ticket>].
