# Brief: fix CI flake - auth.today otp_disabled
Class GUARD-CI. Website repo, branch claude/flake-otp-disabled. One PR, root cause only.
Owner words: "fix flakes root cause, one PR each; trim only with numbers shown first".
Flake: auth.today test hits otp_disabled intermittently (see src/lib/auth-otp-routing.ts, src/pages/__tests__/AuthOtpDisabled.test.tsx, tests/client/authFunnelLaterSteps.test.tsx). Find which test and why. LIVE note says known flake, retry fixes it.
Steps: 1) Find the last 10 failing runs of this check on main/PRs (gh run list / logs via git-visible evidence; plain git only) and quote the exact error. 2) Find the root cause (timing, shared state, env, missing wait). 3) Fix the cause. No retries, no skips, no timeout bumps as the fix, no test deletion. 4) Show before/after numbers (failure rate over reruns, or reasoning if not reproducible). 5) PR body from ~/.claude/docs/pr-body-template.md. Do not touch other flakes. No visual changes.
