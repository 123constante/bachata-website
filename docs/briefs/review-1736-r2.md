# Review PR #1736 round 2 (read-only): skip heavy CI jobs on draft PRs

Branch under review: claude/ci-skip-drafts (head bae470ec8). Do not push to it. You cannot comment on the PR. Create docs/review/pr-1736-r2.md on your branch claude/review-1736-r2 (from main). Header, exactly these first lines:

# Review: PR #1736 head bae470ec8
## Verdict: PASS   (or `## Verdict: BLOCK`; one line, nothing after the word)
Reviewed head bae470ec8

Then findings, one line each. Fetch with `git fetch origin claude/ci-skip-drafts`. Make no other change.

Round 1 (head 742f4d76b) found: allow-list blocker (now fixed on main by #1742, branch rebased onto it) and two wrong comments (skipped-job-success reasoning; phone-qa has no push trigger). Round 2 commit bae470ec8 changes only comments in e2e-smoke.yml, phone-qa.yml, unit-tests.yml.

Check:
1. `git diff origin/main...origin/claude/ci-skip-drafts` touches only the three workflow files; CRLF kept (phone-qa 100% CRLF, unit-tests 100% CRLF, e2e-smoke LF).
2. New comments are factually right: merge waits because a draft cannot merge and the matrix check names appear only after ready_for_review; phone-qa comment does not claim a push trigger.
3. `node scripts/check-automation-workflow-allowlist.mjs` with HEAD_REF=claude/ci-skip-drafts and PR_FILES set to the three files exits 0 now (unit-tests.yml is on the list). YAML parses.
4. Round 1 hard-tier findings (no deadlock, push/dispatch unchanged, ready_for_review types) still hold at this head.
