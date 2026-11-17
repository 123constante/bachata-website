# Brief: independent review of PR #1733 (organiser V3)

Lane: normal. Review only: do not change product code. Branch for output: claude/review-organiser-v3 (off main).

Review PR 123constante/bachata-website#1733, head 64318a52cb6f9441c7ca154adad873a64868a801 (branch claude/organiser-v3). Diff: git fetch origin claude/organiser-v3 then git diff origin/main...FETCH_HEAD, ignoring docs/design shots.

Check: F1 (zero organiser pages go to Welcome, no redirect loop, claim just landed waits for refetch), F2 (location.state forwarded, HomeNotices shared with HomeScreen, flag-off Home unchanged), Door link (flag organiserTicketing, 44px, route events/:seriesId/door), flag read by name only (flags.x, never the whole object), no edit under p3/tickets or p3/door, no call to organiser_raffle_night_set_v1 in tests or walk, contributor cannot open/close a raffle, flag-off parity.

Output: docs/review/REVIEW-organiser-v3-1733.md with header line "# Review: organiser V3 PR #1733 (head 64318a52cb6f9441c7ca154adad873a64868a801)", a line "## Verdict: PASS", "PASS WITH NITS" or "BLOCK", a line "## Hard-tier: PASS|FAIL", findings with file:line. Commit and push to claude/review-organiser-v3, last commit subject ends "[worker-done DTID]".
