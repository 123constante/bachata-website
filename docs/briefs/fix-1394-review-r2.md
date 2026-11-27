# Fix round: PR #1394 after independent review r2 (PASS-with-fixes): F2, F3, F4 only
Branch: claude/automation-loop-editable-workflows (existing PR #1394, head 84e5377). Hard tier. Careful lane, Opus. ONE fix round, push once.
Review: `git show origin/claude/review-1394-r2:docs/review/review-1394-r2.md`. Owner narrow exception applies: you may edit ONLY the guard step in .github/workflows/workflow-lint.yml (comment wording only this round). Never change on:, runs-on, secrets, pull_request_target, permissions.

## Findings to fix (quoted)
- F2 (Low) The wiring is not pinned by any test. No test reads `workflow-lint.yml` and asserts that the step exists, that it runs `--merge "$MERGE_SHA"` with no `|| true` / `continue-on-error`, that it passes `PR_AUTHOR` and `HEAD_REF`, and that its `if:` is the expected one. M12 (append `|| true`) survives. Fix: add a test in the automationFoundations.test.ts style (it already loads workflow-lint.yml) that pins the step text, and that its `if:` cannot skip when workflow files change.
- F3 (Nit) Stale "ships empty" wording in the workflow step comment ("(ships empty)") and the script header ("ships EMPTY, so nothing is allowed"). On main the list holds one name. Fix: reword to "owner-curated; currently `workflow-lint.yml`".
- F4 (Nit) tests/automationWorkflowAllowlist.test.ts pins the exact list value (`names: ['workflow-lint.yml']`), so any owner list change turns it red. Fix: make the committed-list cases read the committed list and derive names from it (still assert the behaviours: PR's own diff passes, non-listed workflow fails, list edit fails, subfolder look-alike fails); keep a clear failure message if the list is empty or malformed.

## Out of scope (do NOT touch)
F1 (the guard's host workflow is on the owner's allow-list). scripts/data/automation-workflow-allowlist.json is the owner's: leave it unchanged; the diff must not include it. Flag F1 in your handover as left to the owner.

## Checks (each fix needs its own)
1. F2: new test red against a mutant that removes the `--merge` line, and against `|| true` appended (M12), and against a changed `if:`; green on the real file.
2. F4: test stays green when the list is temporarily changed to a different valid list (show it), red on an empty list message.
3. Re-run the 11 mutants from the review (table in review-1394-r2.md): all must stay red. Quote results.
4. `npm run test:unit` for the two test files, `npm run check:mojibake`, guard `--self-test`.
Push ONCE. Handover docs/handovers/workflow-allowlist-4.md: done, mutant table, Verified / Not verified, F1 flagged for the owner. CI-only PR: Shapes surveyed n/a; delete the Phone QA section.
