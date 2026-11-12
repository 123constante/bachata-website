# Independent review: PR #1394, round 2 (workflow allow-list guard)

- Head reviewed: `84e537780a5767b9519002278cec22107ae75df9` (`claude/automation-loop-editable-workflows`), author `kiki-claude-bot`.
- Base: `origin/main` `f0f3b291f11f1bcf37e5da028127046ca802f265` (the merge base; the branch already contains main).
- Brief: `brief/review-1394-r2:docs/briefs/review-1394-r2.md` (blob `de582f72`). Hard tier: ONE review round. Read-only. Nothing was pushed to the PR branch.
- Diff: 5 files, +389 / -31: `.github/workflows/workflow-lint.yml`, `scripts/check-automation-workflow-allowlist.mjs`, `tests/automationWorkflowAllowlist.test.ts`, `docs/handovers/workflow-allowlist-2.md`, `docs/handovers/workflow-allowlist-3.md`.

## Verdict: PASS-with-fixes

The guard logic is correct, and every mutant of the guard script turns a committed test red (11 of 11). The fixes are not in the script. Because `workflow-lint.yml` is on the list, a loop PR may edit the file that runs the guard. The wiring is also not pinned by any test (see F1 and F2). Neither finding blocks the merge: the PR body already names this residual risk and accepts owner Approve at head as the protection. But that protection is a human one, and the owner should act on F1 soon after merge.

## Findings, ranked

| # | Severity | Finding | Fix |
|---|---|---|---|
| F1 | Medium | **The guard's host workflow is on the allow-list.** `scripts/data/automation-workflow-allowlist.json` on main is `["workflow-lint.yml"]` (#1404), and the guard runs in `workflow-lint.yml`. So a loop PR may edit that file, for example by appending `\|\| true` to the `--merge` line, dropping the step, or changing its `if:`. The guard then passes that same PR, because the edited file is listed. I measured this: the `\|\| true` mutant (M12 below) keeps all 146 tests green in `automationWorkflowAllowlist` + `automationFoundations`, and `lint-workflow-masking.mjs` still exits 0 (it only looks at `continue-on-error`). Only owner Approve at head stands in the way. | Owner: after #1394 merges, remove `workflow-lint.yml` from the list, since it was listed only so this PR could wire itself (handover workflow-allowlist-3). Or have the guard always treat its own host workflow as unlisted. Either change also needs the committed-list test updated. |
| F2 | Low | **The wiring is not pinned by any test.** No test reads `workflow-lint.yml` and asserts that the step exists, that it runs `--merge "$MERGE_SHA"` with no `\|\| true` / `continue-on-error`, that it passes `PR_AUTHOR` and `HEAD_REF`, and that its `if:` is the expected one. M12 survives. | Add a test (the `automationFoundations.test.ts` style already loads `workflow-lint.yml`) that pins the step text. |
| F3 | Nit | **Stale "ships empty" wording.** The comment on the new workflow step says the list "(ships empty)", and the script header says it "ships EMPTY, so nothing is allowed". On main the list holds one name. | Reword: "owner-curated; currently `workflow-lint.yml`". |
| F4 | Nit | **The committed-list test pins the exact list value** (`names: ['workflow-lint.yml']`). Any owner change to the list, including the F1 fix, turns `tests/automationWorkflowAllowlist.test.ts` red. That may be intended as a tripwire, but it makes the owner's list PR also edit a test. | Accept, or say so in the test comment. |

## Must-answer 1: the workflow change is only the guard step

The workflow diff is one hunk (`@@ -48,6 +48,22 @@`) and only adds lines, all of them inside `jobs.masking-check.steps`:

```
+      - name: Automation workflow allow-list
+        if: github.event_name == 'pull_request' && steps.changes.outputs.docs_only != 'true'
+        env:
+          HEAD_REF: ${{ github.head_ref }}
+          PR_AUTHOR: ${{ github.event.pull_request.user.login }}
+          MERGE_SHA: ${{ github.sha }}
+        run: |
+          node scripts/check-automation-workflow-allowlist.mjs --self-test
+          node scripts/check-automation-workflow-allowlist.mjs --merge "$MERGE_SHA"
```

(plus 6 `#` comment lines). `git diff origin/main...HEAD -- .github | grep -E '^[+-]' | grep -iE 'on:|runs-on|secrets|pull_request_target|permissions'` finds nothing (exit 1). Nothing changes in `on:`, `runs-on`, `secrets`, `pull_request_target`, `permissions` or `concurrency`. The env holds no secrets. `head_ref` and the login are passed through `env:`, not interpolated into `run:`, so there is no script-injection path.

## Must-answer 2: guard correctness against the real list on main

The list on main and on the branch is identical: `["workflow-lint.yml"]`. Each case below was run against the real committed list.

| Case | Expected | Result |
|---|---|---|
| Loop PR (`claude/...`, kiki-claude-bot) editing a non-listed workflow (`e2e-smoke.yml`) | exit 1 | exit 1 (CLI on the real diff plus `e2e-smoke.yml`; committed test `a non-listed workflow edit alone fails`) |
| Loop PR editing the list itself | exit 1 | exit 1 (committed test `a loop PR adding a name to the committed list fails`; case and backslash variants also 1) |
| Subfolder look-alike `.github/workflows/x/workflow-lint.yml` | exit 1 | exit 1 (committed test) |
| The PR's own diff (`git diff --name-only origin/main...HEAD`, 5 files) | exit 0 | exit 0: `OK -- loop PR ..., 5 files, 1 workflow file(s), all on the list (1 name(s))` |
| Real CI at head (masking-check job 130189739895, `--merge 76b6bbf3`) | exit 0 | `PASS self-test -- 36 cases` and then the same OK line. The step really ran in CI. |

Other checks:
- The docs-only skip is safe. `scripts/ci/docs-only.mjs` vetoes `.github/`, and the case variant `.GitHub/Workflows/x.yml` also classifies `docs_only=false` (run locally), so the step cannot be skipped on a PR that touches workflows.
- Author detection is an exact compare with `BOT_LOGIN` (imported). dependabot and github-actions are unaffected.
- A CI run with no `PR_AUTHOR` exits 2, never a silent pass.

## Must-answer 3: mutation

I mutated the script in a scratch worktree of the head. For each mutant I ran `npx vitest run tests/automationWorkflowAllowlist.test.ts` (76 tests) and `--self-test`, then restored the original (`git status` was clean afterwards).

| Mutant | Change | vitest | self-test | Killed? |
|---|---|---|---|---|
| M1 always exit 0 | `main` returns 0 after the self-test branch | 36 red | exit 1 | yes |
| M2 basename, not path | `violations` compares `basename(p)` to the names | 5 red | exit 1 | yes |
| M3 ignore the list-edit rule | `if (files.some(isListFile))` changed to `if (false)` | 6 red | exit 1 | yes |
| M4 case-sensitive prefix | `isWorkflowPath` without `toLowerCase` | 5 red | exit 1 | yes |
| M5 drop the author rule | `isLoopPr` = branch only | 3 red | exit 1 | yes |
| M6 no normalisation | `normalisePath` returns its input | 11 red | exit 1 | yes |
| M7 drop the CI author requirement | missing-author check changed to `if (false)` | 2 red | exit 1 | yes |
| M8 no tab split | remove `.flatMap(l => l.split('\t'))` | 2 red | exit 1 | yes |
| M9 case-sensitive list-file match | `isListFile` without `toLowerCase` | 2 red | exit 1 | yes |
| M10 case-insensitive author | `author.toLowerCase() === BOT_LOGIN` | 1 red | exit 0 (survives self-test only) | yes (by vitest) |
| M11 broken list passes | loop-PR list-load failure returns 0, not 2 | 5 red | exit 1 | yes |
| **M12 wiring masked** | `workflow-lint.yml`: `--merge "$MERGE_SHA" \|\| true` | **146 green** (allowlist + foundations) | n/a; masking lint exit 0 | **NO** (F1, F2) |

Guard-script mutants: 11 of 11 killed. Wiring mutant: survives.

## Must-answer 4: does it weaken an existing check, and is it wired to the loop PR path only?

- **It weakens nothing.** The PR adds a step and removes none. The other steps in `masking-check` keep their `if:` conditions. The script's other entry points (`package.json` `check:automation-workflow-allowlist[:self-test]`, `guard-paths.json`, `prove-entry-point-dispatch.mjs`) are unchanged against main.
- **Wiring.** The step runs on `pull_request` events only, and not on docs-only PRs. Inside the script, a non-loop PR (any branch other than `claude/` or `ccr-`, by any author other than `kiki-claude-bot`) exits 0 at once without reading the list, so an owner PR cannot be blocked by a broken list (committed tests: `owner PR never reads the list`). So the step runs on every non-docs PR, but it only *bites* on loop PRs. That matches the brief's intent.
- `masking-check` is already a required check (PR body). I did not re-verify it against branch protection.

## Must-answer 5: check state at head

Source: GitHub check-runs for PR #1394 via the GitHub MCP (the `gh` CLI is unavailable here and `gh api` is banned by the brief), read at about 23:00Z on 2026-11-10.

- **Red: none.**
- Success: `masking-check` (the guard step ran, see above), `notification-check`, `integrity`, `contract-check`, `live-db-gate`, `bundle-budget`, `unit (America/New_York)`, `unit (Australia/Sydney)`, `dancer-area-isolation`, `wallclock-brand`, `bom-check`, `route`, the 3 `canary` jobs, the 4 `no-preview-reason` jobs, `open-pr`, `decide`, `real-data-verified`, `phone-qa-section`.
- Cancelled: one earlier run each of `phone-qa-section`, `real-data-verified` and `decide`. Each was superseded by a later run that succeeded.
- Skipped (preview and measure jobs): lighthouse, seo, og, synthetic, measure, doc-weight, enable, bom-check-routed.
- **Still in progress when I read them:** `unit (Europe/London, full)` and `e2e-smoke`. Their outcome is NOT verified here.
- Since nothing is red, the "also red on main?" comparison does not apply.

## Verified

- I read the brief at the stated blob sha `de582f72`.
- Every change in the diff is listed above. The workflow hunk only adds lines and touches no trigger, runner, permission or secret.
- `vitest tests/automationWorkflowAllowlist.test.ts`: 76 of 76 pass at head. `--self-test`: 36 cases pass.
- The guard CLI on the real PR file set gives exit 0. Adding a non-listed workflow gives exit 1.
- The guard step really ran and passed in GitHub CI at head (masking-check job log).
- Mutation: 12 mutants. The 11 script mutants are killed and the wiring mutant survives (table above).
- The docs-only classifier does not mark a case-variant workflow path as docs.

## Not verified

- The final outcome of `unit (Europe/London, full)` and `e2e-smoke` at head (in progress at read time).
- Whether `masking-check` is in branch protection's required checks. I took the PR body's word for it.
- The full `npm run test:unit` at head (I ran only the two targeted test files).
- Real data: n/a. This is CI-only code with no data path, so I ran no Supabase query.
