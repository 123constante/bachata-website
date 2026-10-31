# Brief: GUARD-CI, P3 walk specs must not silently skip in CI (Website), Opus

Branch `claude/guard-p3-walk-specs` (push ONLY here, ONE push). Careful lane, under 30% context. Final commit subject ends `[worker-done <ticket>]`. No `supabase/**`, no prod write.

## Why
Review of #1208 (`docs/review/pr-1208-r1.md`, finding F4) found: P3 walk specs (Playwright e2e) skip in CI when `VITE_ENABLE_ORGANISER_P3` is not set, so green CI says nothing about them. Read that file first.

## Do
1. Prove it: list every e2e/walk spec that is skipped (`test.skip`, `describe.skip`, env-gated) when the P3 flags are unset, and which CI job runs them and with which env (read `.github/workflows/*.yml` and `package.json` `test:e2e`).
2. Add a guard script `scripts/check-p3-specs-not-skipped.mjs` (follow the six rules in `docs/ci-guard-notes.md` and `scripts/check-script-conventions.mjs`; exit-code convention; a `--self-test` with fixtures AND a named mutant that must go red) failing when a P3 spec can skip in the CI job without the flags being set there. Wire it into `package.json` and the right workflow. Prefer the smallest fix: set the flags in the CI job env if that makes the specs run, and the guard asserts that.
3. Red first: show the guard red on current main, green after.
4. Do not add `run-ci`. PR body: Verified / Not verified, per-job table, and say it is hard tier (scripts/** + workflow: owner Approve at head).
