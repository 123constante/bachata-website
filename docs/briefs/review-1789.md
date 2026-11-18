# Review PR #1789 (claude/hook-squash-isolation), head 6ff5c63d

Review only, no code changes. Hook/guard class. Read the PR diff.
Check: (1) push-or-block allows a stale copy only when its content equals a squash-merged main commit, never real unpushed work; (2) pre-ship runs the dancer-area isolation guard and fails closed; (3) no path lets unpushed unique commits slip through; (4) tests/self-tests cover both the allow and block shapes.
Output: verdict PASS / PASS WITH NITS / BLOCK as a PR comment on #1789 naming the head sha (do not commit a docs/review file).
