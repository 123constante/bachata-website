# Review of PR #1535 at head a569a715e2223fa7072af671c44f7232a41c8459 (round 1 of 1)

**Verdict: PASS-with-fixes** (one non-blocking stale comment; no code defect).

Diff reviewed: 3 files (allow-list `[]`, one header comment in the guard, the committed-list test). Read-only; PR branch not edited.

## Answers

1. **PASS** — empty list blocks every loop-PR workflow edit. `violations()` (`scripts/check-automation-workflow-allowlist.mjs:117-120`) builds `allowed` from `names`; with `[]` the Set is empty, so every path under `.github/workflows/` is a violation. There is no length branch, so no "empty = allow all" path. Run by hand: `claude/x` editing `workflow-lint.yml` exits 1. The list-file edit check (`:178`) and case/backslash/`./`/`//` normalisation (`:82-89`) are unchanged and run before the empty-list case matters.
2. **PASS** — non-loop branch (`owner/x`, author `123constante`) editing a workflow exits 0 (`:168-172`; the list is not even read). `--merge` with `[]` is covered by self-test case "--merge diff drives the files (1)" (`:237`, uses EMPTY): exits 1 for an unlisted workflow.
3. **PASS** — `--self-test`: `PASS self-test -- 36 cases`. `npx vitest run tests/automationWorkflowAllowlist.test.ts`: 89/89 passed.
4. **PASS (mutation caught)** — scratch copy with `if (names.length === 0) return [];` at the top of `violations()`: self-test failed 10 of 36 cases; vitest failed 14 tests, including "loop branch, any workflow vs the EMPTY shipped shape fails" and "--self-test passes". Reverted.
5. **PASS on the loader; FAIL (minor) on comments.**
   - Loader robust: not-an-array (`{}`, `null`), non-string (`[1]`), path entry (`["a/b.yml"]`), empty file and invalid JSON all give "CANNOT RUN" (exit 2) on a loop PR. `[]` is accepted as valid (`:105-110`, `Array.isArray` + `.filter` on empty). The JSON file itself has no header comment (plain `[]`), so there is nothing to be inaccurate there; the guard's header (`:15`) is accurate.
   - **Stale comment (non-blocking):** `.github/workflows/workflow-lint.yml:52-53` still says the list is "currently `workflow-lint.yml`". It is now empty. The guard header was updated; this one was missed. Also `docs/ci-guard-notes.md` (section "Automation workflow allow-list", ~line 487-517) should be checked for the same wording. Note any fix to workflow-lint.yml must be an owner-pushed change, since a loop PR cannot edit it under the new rule.

## Other observations (no action required)
- Test change reads the committed list via `loadAllowlist` and falls back to a placeholder name when empty; it still throws on a malformed file, as the brief states.
- seo-preview red at this head is unrelated (also red on main, run 42936670025).

## Verified
- Head SHA fetched from `refs/pull/1535/head` equals a569a71; reviewed in a scratch worktree.
- Self-test 36/36, vitest 89/89, mutation goes red (10 self-test cases, 14 vitest tests), manual exit codes for loop/owner/malformed list.

## Not verified
- CI on GitHub (not run here); the actual workflow-lint job on the PR.
- `docs/ci-guard-notes.md` wording not read line by line.
- Whether a branch-protection rule lets the owner still edit workflow-lint.yml; assumed yes.

_tsc not run: docs-only change, no TS touched._
