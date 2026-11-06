# Brief: CI offload stage 3, fix round 2 (review of #1402 at 1ba49bd46)

Brief-version: 2
Branch: claude/ci-offload-stage3 (Website). Lane: careful, hard tier. Model: Opus. Do NOT edit .github/workflows (you cannot push them): put workflow changes in docs/handover/ci-offload-stage3.md as PATCH B for the lead, same as PATCH A.
Owner rule: the Dell/Acer helps but MUST NOT crash, hang or red a PR.

## What main lacks
- a runner-side check that the workflow run is main's copy (grep: GITHUB_WORKFLOW_SHA in docs/ci-offload/acer-web/gate-job-started.sh, expect 0)
- scripts/lib/ and package.json in PROTECTED_PREFIXES (grep: PROTECTED_PREFIXES in scripts/ci/route-runner.mjs)
- exit-code classes 126/127/139/143 as runner problems (grep: classifyExit in scripts/ci/route-runner.mjs)

## Files
scripts/ci/route-runner.mjs
scripts/check-secrets-register.mjs
tests/routeRunner.test.ts
docs/ci-offload/acer-web/gate-job-started.sh
docs/ci-offload/acer-web/gate-job-completed.sh
docs/handover/ci-offload-stage3.md

## Fix, in this order (review findings; each gets a test or a measured proof)
1. CRITICAL: a PR runs its OWN copy of bom-check.yml, so it can drop the route job and hard-code `runs-on: acer-web`. The protections in route-runner.mjs never run. Fix on the RUNNER side, not in YAML: gate-job-started.sh must refuse the job (exit non-zero, hosted fallback takes over) unless the workflow file at $GITHUB_WORKFLOW_SHA is byte-identical to the one on origin/main (fetch main's blob, compare hashes), and the actor is on the trust list. Add a shell test with a mutant (altered workflow blob must be refused). State in PATCH B that the org runner group should also be restricted to this workflow ("Selected workflows") as an owner step.
2. route-runner PROTECTED_PREFIXES: add scripts/lib/, package.json, package-lock.json, .github/automation/; test that a PR touching only scripts/lib/entry-point.mjs does NOT route to the Acer.
3. classifyExit: only exit 1 from bom-check.sh is code-failure. 126/127/139/143 and any signal exit are runner problems: fall back to hosted. Table test over exit codes 0,1,2,124,126,127,130,137,139,143.
4. Watchdog: do not cancel the whole run. Make the routed job non-blocking: hosted bom-check runs in parallel and passes unless the routed job passed AND found a real failure. Remove `if: always()` reliance; keep the single required check name. Put in PATCH B.
5. Skip the route job entirely when vars.WEB_RUNNER_LABEL is empty (today's single-job behaviour). PATCH B.
6. check-secrets-register (e-routed): parse the `if:` expression structurally (reject `|| true`, negation, a trust token only inside an OR branch); mutants for each. Keep the existing self-test style.
7. docs/ci-offload/bom-check.yml duplicate: replace by a check in tests/ that the two files are byte-identical, or delete the docs copy and point to the workflow.
8. gate-job-completed.sh: stop deleting _temp and _actions; clean only the checkout dir under _work/<repo>. Move the full cleanup to gate-job-started.sh.
9. gate-job-started.sh lock holder: replace `exec sleep 7200` with a holder that exits when the runner process dies and caps at 30 minutes; if the pid file cannot be written, release the lock and exit non-zero (fallback to hosted).

## Done = (push once)
Tests green locally (`npx vitest run tests/routeRunner.test.ts tests/automationFoundations.test.ts tests/automationRegister.test.ts` + guard `node scripts/check-secrets-register.mjs`), mutant results in the handover, PATCH B for the lead, Verified / Not verified block, last commit subject ends `[worker-done <ticket>]`.
