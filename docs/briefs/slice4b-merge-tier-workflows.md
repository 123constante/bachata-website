# Slice 4b: harden auto-merge-on-open and revert-on-red (flag stays OFF)

Repo 123constante/bachata-website. Branch claude/merge-tier-slice4b (from main). Hard tier: touches .github/workflows/*, .github/automation/*, scripts/. PR needs independent review.
Context: #1681 installed .github/workflows/auto-merge-on-open.yml and revert-on-red.yml (flag MERGE_TIERS_ENABLED stays OFF; do NOT set it). Review docs: docs/review/review-1681-r2.md on branch claude/review-1681-r2 (and docs/review/review-1681.md on claude/review-1681) hold the findings below.

## Do (smallest change per item)
3. auto-merge-on-open.yml: the disable step must be `if: always()` with an unconditional `gh pr merge --disable-auto` when not armed or paused (verify the current round-2 shape first; change only what is missing).
4. auto-merge-on-open.yml: switch to pull_request_target with branches: [main], require github.event.pull_request.base.ref == 'main', check out ref main (never PR head code), then drop its entry from untrusted_trigger_grandfathered in .github/automation/secrets-register.json. Update tests (tests/automationRegister.test.ts, tests/automationPauseWorkflows.test.ts) so the register and workflow agree.
5. Low: revert-on-red.yml GITHUB_TOKEN permissions to contents/pull-requests/issues read (every write uses BOT_PR_TOKEN); open an owner-turn issue if `gh pr create` fails; ancestor check on the dispatch sha (git merge-base --is-ancestor against main).

Files you may touch: .github/workflows/auto-merge-on-open.yml, .github/workflows/revert-on-red.yml, docs/proposals/auto-merge-on-open.yml, docs/proposals/revert-on-red.yml, .github/automation/secrets-register.json, tests/automationRegister.test.ts, tests/automationPauseWorkflows.test.ts
Out of scope: removing the 2 allow-list entries (owner-only file), flipping the flag.

## Checks before pushing
`npx vitest run tests/automationPauseWorkflows.test.ts tests/automationRegister.test.ts tests/mergeTier.test.ts`, `node scripts/check-workflow-artifact-policy.mjs`, `npm run check:mojibake`, `npx tsc --noEmit -p .`. cmp docs/proposals/*.yml against .github/workflows/*.yml.

## Handover
PR body needs the Verified on real data block (no data path: say so; NOT verified: the workflows have never run, the flag is off). Docs/tests/workflow PR: delete the Phone QA section. Final commit subject ends [worker-done <ticket>].
