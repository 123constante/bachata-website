# Brief: CI offload wave 0, fix round 3 (the hook refuses every legitimate run on the real Dell: PR #1470 at f53f5c2d1)

Brief-version: 2
Branch: claude/ci-offload-wave0 (Website), the SAME branch and PR #1470: continue it, do not open a new one. Lane: careful, hard tier. Model: Opus. Push once, `[skip preview]`, no `src/`, no `.github/workflows/**`.
Read first: `docs/handover/ci-offload-wave0.md` on the branch and the review reports `C:/tmp/review/pr1470.md`, `C:/tmp/review/pr1470-fix1.md`. Nothing runs on the Acer or Dell from your branch; never create or print a token.
Owner rules: the Dell/Acer helps but MUST NOT crash, hang or red a PR; the repo is PUBLIC and the hook is the only access control; fail closed.

## What was measured on the REAL Dell (the lead of this arc ran the suite there; your sandbox was green)
- Dell at f53f5c2d1: `FAIL 147 of 240`, exit 1. Every ACCEPT case fails (verdict file empty); refusal cases pass because any exit 1 satisfies them. So the hook refuses everything.
- Cause, reproduced on the Dell (bash 5.3.9, git 2.53.0, python 3.14.4): after the `env -i` re-exec the hook stops at its `unset BASH_ENV ENV PS4 BASHOPTS ...` line. `BASHOPTS` and `SHELLOPTS` are READONLY in bash. With `POSIXLY_CORRECT=1` (posix mode) a failed `unset` of a readonly variable is fatal for a non-interactive shell, so the script ends silently. Without posix mode the same unset only prints "cannot unset: readonly variable" and carries on.
- The Dell's `env`, `timeout`, `sort` and `stat` are the Rust uutils versions, while `awk` (gawk), `find`, `sed`, `grep` are GNU. Any option that only GNU coreutils accepts may behave differently there.
- The 24 mutants "passed" at f53f5c2d1 only because the unmutated baseline was already red: a vacuous result.

## What main lacks
- the hook surviving read-only shell variables: never `unset` BASHOPTS or SHELLOPTS (the `env -i` re-exec already drops them from the environment); guard every unset with a readonly check -- grep: readonly_unset_guard
- a suite gate that refuses to run mutants unless the unmutated suite passes first, so a red baseline cannot count as "mutant caught" -- grep: baseline_green_gate
- a compatibility row set for the Dell toolchain (bash 5.3 posix mode, uutils env/timeout/sort/stat) -- grep: uutils

## Files
docs/ci-offload/acer-web/gate-job-started.sh
docs/ci-offload/acer-web/gate-job-completed.sh
docs/ci-offload/acer-web/test-gate-hooks.sh
docs/ci-offload/acer-web/provision-checklist.md (new)
docs/handover/ci-offload-wave0.md (new)

## Fix, in this order (red test first)
1. `readonly_unset_guard` in BOTH hooks: remove BASHOPTS and SHELLOPTS (and any other readonly name such as BASH_VERSINFO, EUID, PPID, UID) from every `unset` list; wrap the remaining unsets so a failure can never end the script (e.g. `unset -v X 2>/dev/null || true`, safe under posix mode only if it is a plain command list entry; verify by test in posix mode: `POSIXLY_CORRECT=1`). Add test rows that run the hook with BASHOPTS and SHELLOPTS exported in the caller environment and prove the verdict is still ok for a legitimate bom-check run and still refused for a bad one.
2. Mutant `baseline_green_gate`: `--mutants` first runs the unmutated suite (FAST=1) and aborts with `FAIL baseline red` unless it passes; each mutant is caught only by a failure whose reason names the mutated rule (assert the specific refusal text, not any red). State this in the handover.
3. Audit every external command in both hooks for GNU-only options under uutils coreutils (`env`, `timeout`, `sort`, `stat`, `date`, `cut`, `head`, `tail`, `mktemp`, `readlink`, `printf`, `install`): prefer POSIX options only. List each command with its options in the handover. Add `uutils` rows where an option differs (for example timeout `-k`, `stat -c`, `sort -V`, `env -S`) if the hook uses it.
4. Your sandbox probably has GNU coreutils and an older bash: say so under Not verified. The lead of this arc re-runs the whole suite and the mutants on the real Dell after your push and records the totals; do not claim Dell numbers yourself.

## Do not touch
src/**, supabase/**, any `.github/workflows/**` file, scripts/ci/route-runner.mjs rules (read only), the admin repo and runners, Vercel settings.

## Verification (all before DONE)
- test-gate-hooks.sh and `--mutants` in your sandbox with real totals; additionally run both under `POSIXLY_CORRECT=1 bash` if your bash allows, and under `bash --posix`.
- bom-check required-check name unchanged; check-secrets-register and workflow-lint green; per-job CI table in the PR body; Verified / Not verified block.

## Stop and handover
Push once; `[worker-done <ticket>]` on the last commit; update `docs/handover/ci-offload-wave0.md`. At 40% context stop with PARTIAL and a what-is-left list.
