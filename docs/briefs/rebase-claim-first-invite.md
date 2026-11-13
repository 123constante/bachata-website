# Brief: rebase claude/claim-first-organiser-invite onto main (PR #1636)
Goal: PR #1636 (claim-first organiser invite, flagged) has a merge conflict with main, so its checks never queue. Merge `origin/main` into `claude/claim-first-organiser-invite`, resolve conflicts keeping BOTH main's changes and the PR's feature, push once (subject ends [worker-done]). Change nothing else; keep the PR body.
Acceptance: PR #1636 mergeStateStatus not DIRTY/CONFLICTING and its pull_request checks queue; run `npm run check:pr-mergeable`; typecheck passes (run via dell-run); say what was not verified. No DB change; flag stays off.
Lane normal, Website only.
