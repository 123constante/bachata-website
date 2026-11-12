# Fix dancer-area-isolation red on PR #1576 (branch claude/profile-dash-dancer-build1)
Lane: fast. Same branch, one push, no [skip preview] on the final push.

## Failure
At head ce98460, `dancer-area-isolation` fails: (a) changed file outside src/modules/dancer-app/ and not a seam:
`src/modules/admin-organisers/join/__tests__/JoinGetPaidNext.test.tsx` (the waitFor edit from the previous unit fix). Adding a seam is the lead's decision, never a code edit.

## Do
1. `git checkout origin/main -- src/modules/admin-organisers/join/__tests__/JoinGetPaidNext.test.tsx` (revert that file only; do not touch the allowlist).
2. Run that test file 5 times (`npx vitest run <file>`); report pass count. If it fails on main too, it is a pre-existing flake: say so in the handover (lead files the main fix separately). If it fails only on this branch, find the cause inside src/modules/dancer-app/ and fix it there.
3. Run `node scripts/check-dancer-area-isolation.mjs` locally: must be clean.
4. Append to docs/handover/dancer-dash-1576/handover.md: what was reverted and why. Commit with a `[worker-done <ticket>]` line. Per-job CI table in the PR after CI finishes.
