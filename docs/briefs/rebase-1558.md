# Rebase PR #1558 (feat/ticket-festival-in-site)
Class: REBASE, normal lane. PR is CONFLICTING with main, so its checks never queue.
- Merge/rebase origin/main into the branch, resolve conflicts keeping both sides' intent (in-site Buy on festival pages, Ritmo first, behind its flag).
- `npm run check:pr-mergeable` must pass; run `npm run pre-ship`; push once to the same branch.
- Put the per-job CI table in the PR. Do not merge or approve.
