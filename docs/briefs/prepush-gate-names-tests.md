# Brief: add failure-path tests to PR #1603 (branch claude/prepush-gate-names)
Independent review FAILED check 4 only: tests/prePushRemoteUnitGate.test.ts:154-158 only loosens a regex; nothing exercises unit_fail in .githooks/pre-push.
Do, on the existing branch claude/prepush-gate-names (fetch it first; do not rebase, do not touch .githooks/pre-push unless a test proves a bug):
1. Add a case where the stubbed vitest exits non-zero AND writes a JSON report naming a failing file: assert hook exit 1 and that output names that file.
2. Add a case where the stub fails and writes no report: assert exit 1 and output contains the "(no report written" fallback.
3. Add a case with a report listing no failed files: assert exit 1 and the "(none recorded)" fallback.
Follow the existing stub style in that test file. Tests-only. Push once; last commit subject ends with the worker-done tag. Update the PR body only if needed (labels exact; tests-only so no Phone QA section needed if no .tsx).
