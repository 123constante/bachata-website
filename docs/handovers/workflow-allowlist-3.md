# Handover: workflow-allowlist-3 (fix round for PR #1394, masking-check red)

Ticket: dt_d1a15860cca9. Brief: `docs/briefs/fix-1394-masking-check.md` (branch
`brief/automation-loop-editable-workflows`).

## Failure

`masking-check` -> `node scripts/check-automation-workflow-allowlist.mjs --merge "$MERGE_SHA"`:
"loop PR claude/automation-loop-editable-workflows changes workflow file(s) not on
scripts/data/automation-workflow-allowlist.json". That run (2026-11-06) ran
against the list as it then stood on main: `[]` (#1353 shipped it empty).

## Fix chosen, and why

**No exemption in the guard. The owner's allow-list entry, already on main, plus a merge.**

- The owner listed `workflow-lint.yml` on main in #1404
  (`a661186b ci(allow-list): list workflow-lint.yml so the loop guard (#1394) can wire itself`).
  The branch was 111 commits behind main and never had that entry, hence red.
- Option A (the guard exempts the PR that introduces it) would put a branch-name
  or file-shape special case in a security guard. Any later loop PR could
  copy that shape. Rejected as the wider change.
- Option B (the name on the data file) is the narrowest, and it is owner-approved
  and already merged. A loop PR may not edit the list itself (the guard reds
  that), so the only correct move on this branch is to merge main. The branch
  diff does NOT touch `scripts/data/automation-workflow-allowlist.json`.
- The guard script is unchanged by this round.

## Done

1. `git fetch origin main` (the sandbox clone was shallow: deepened), then merged
   `origin/main` into the branch. Clean, no conflicts.
2. `tests/automationWorkflowAllowlist.test.ts`: new `committed list:` cases run
   against the REAL committed list, not a fixture:
   - PR #1394's own 4-file diff passes (0);
   - the same branch also editing `e2e-smoke.yml` fails (1);
   - a non-listed workflow alone fails (1);
   - a loop PR editing the list itself fails (1);
   - `.github/workflows/x/workflow-lint.yml` (a look-alike in a subfolder) fails (1).
   Also typed the `quiet` console stub (`as unknown as Console`), which cleared 2
   pre-existing TS2345s in this file.
3. Mutation: with `violations(files, list.names)` replaced by `[]` in the guard,
   3 committed-list cases go red (the non-listed ones). Restored afterwards. The
   list-self-edit case stays green under that mutation by design, because a
   separate check covers it.

## Check output (local)

- `node scripts/check-automation-workflow-allowlist.mjs --self-test` ->
  `PASS self-test -- 36 cases, every exit code proven.`
- `HEAD_REF=claude/automation-loop-editable-workflows node scripts/check-automation-workflow-allowlist.mjs --local`
  (diff from merge-base with origin/main, the same file set as CI's merge sha) ->
  `OK -- loop PR claude/automation-loop-editable-workflows, 4 files, 1 workflow file(s), all on the list (1 name(s)).`
- `--merge HEAD` on the local merge commit reds on the list file, because
  HEAD^1 there is the OLD branch tip, so main's #1404 shows up in the diff. CI's
  merge sha has main as ^1, which `--local` reproduces. Not a real failure.
- `node scripts/lint-workflow-masking.mjs` -> 41 files, no unjustified continue-on-error.
- `npx vitest run tests/automationWorkflowAllowlist.test.ts` -> 76 passed.
- `npm run check:mojibake` -> 2662 files, clean.
- `npm run lint:workflows`: no such script in package.json, so not run.
- tsc: no tsconfig includes `tests/`. Checked the touched test file through a
  throwaway config extending `tsconfig.app.json`: 0 errors (2 before the stub fix).

## Verified

- Guard self-test, `--local` run as CI scopes it, masking lint, unit tests,
  mutation red, mojibake, and no tsc errors in the touched test file.

## Not verified

- The GitHub `masking-check` run on the new head (it needs a push; read the PR checks).
- `--merge <sha>` against a real GitHub merge ref: the sha must exist on origin,
  so this was simulated with `--local`.
- Data shapes: n/a (no data paths). Phone QA: n/a (CI-only).
- `/code-review` skill not run: a scheduled zero-context worker, and a tests-only diff
  that I self-reviewed.

## Next

- If `masking-check` is green, the owner reviews #1394. Workers never merge.
