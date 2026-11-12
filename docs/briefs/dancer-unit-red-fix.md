# Fix unit (Europe/London, full) red on PR #1576 (branch claude/profile-dash-dancer-build1)
Lane: normal. Same branch, one push, no [skip preview] on the final push.

## Failure (quote, CI job 131092739727 at head 71255224)
Test Files 2 failed | 923 passed. Two assertions:
1. `expected [ '/src/lib/eventCategory.ts', ...(14) ] to deeply equal [ '/src/lib/eventCategory.ts', ...(12) ]`: a test pins the LIB_EVENT_RULES_MODULES list (vite.chunks.ts); c7cfeb11 added 2 entries (claimMyDancerProfile.ts, myPersona.ts). Find the test (grep eventCategory.ts in tests/ and src/**/__tests__), update its expected list deliberately, and keep the comment in vite.chunks.ts truthful.
2. `expected '/invite/cdcdcd...' to be '/invite/cdcdcd...' // Object.is equality`: find it (grep "/invite/" in tests). Decide: caused by this branch or pre-existing/flaky? Run it on main (git stash-free: use git worktree is forbidden; instead run the test on the branch and read the diff). If not branch-caused, say so in the handover with evidence and do not change it unless the fix is trivial and clearly correct.

## Do
Run `npm run test:unit` for both files locally (Europe/London and the two tz-sensitive jobs: TZ=Australia/Sydney, TZ=America/New_York as CI does, see .github/workflows). Per-job CI table and Verified / Not verified in the PR body (label lines exact). contract-check red is a prod-data drift on main, not yours: do not touch.
