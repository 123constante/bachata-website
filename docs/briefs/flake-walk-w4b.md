# Brief: fix CI flake - walk-p3-w4b-onboarding:151 dark
Class GUARD-CI. Website repo, branch claude/flake-walk-w4b. One PR, root cause only.
Owner words: "fix flakes root cause, one PR each; trim only with numbers shown first".
Flake: tests/e2e/walk-p3-w4b-onboarding.spec.ts line ~151 (dark-mode step) fails intermittently.
Steps: 1) Find the last 10 failing runs of this check on main/PRs (gh run list / logs via git-visible evidence; plain git only) and quote the exact error. 2) Find the root cause (timing, shared state, env, missing wait). 3) Fix the cause. No retries, no skips, no timeout bumps as the fix, no test deletion. 4) Show before/after numbers (failure rate over reruns, or reasoning if not reproducible). 5) PR body from ~/.claude/docs/pr-body-template.md. Do not touch other flakes. No visual changes.
