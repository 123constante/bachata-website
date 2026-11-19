# Brief: fix CI flake - layout-190
Class GUARD-CI. Website repo, branch claude/flake-layout-190. One PR, root cause only.
Owner words: "fix flakes root cause, one PR each; trim only with numbers shown first".
Flake: tests/e2e/organiser-layout.spec.ts:190 (was :171) 'no screen or sheet scrolls sideways'; still fails after #1845 and #1851
Evidence (main e2e-smoke failed runs, read with gh-bot run view <id> --log-failed): 44583816895, 44560001454
Steps: 1) Read those failing logs and quote the exact error. 2) Find the root cause (timing, shared state, env, missing wait). 3) Fix the cause. No retries, no skips, no timeout bumps as the fix, no test deletion. 4) Show before/after numbers (failure rate over reruns, or reasoning if not reproducible). 5) PR body from ~/.claude/docs/pr-body-template.md. Do not touch other flakes. No visual changes. Related earlier fixes already on main: #1845, #1851 (organiser-layout), #1853.
