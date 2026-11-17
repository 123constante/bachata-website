# Review PR #1736 round 3 (read-only): skip heavy CI jobs on draft PRs

Branch under review: claude/ci-skip-drafts (head 15835232e). Do not push to it. You cannot comment on the PR. Create docs/review/pr-1736-r3.md on your branch claude/review-1736-r3 (from main). First lines, exactly:

# Review: PR #1736 head 15835232e
## Verdict: PASS   (or `## Verdict: BLOCK`; one line, nothing after the word)
Reviewed head 15835232e

Then findings, one line each. Fetch with `git fetch origin claude/ci-skip-drafts`. Make no other change.

Round 2 (head bae470ec8) BLOCKed on one thing: the comment "the matrix check names appear only after ready_for_review" sat on three jobs without a strategy.matrix (e2e-smoke.yml, build-smoke in phone-qa.yml, dancer-area-isolation in unit-tests.yml). Round 3 commit 15835232e changes exactly those three comment lines to "# Merging still waits: a draft cannot merge." Everything else in round 2 was OK.

Check:
1. `git diff bae470ec8 15835232e` is exactly those three comment lines, nothing else; CRLF kept (phone-qa, unit-tests 100% CRLF; e2e-smoke LF).
2. The matrix wording remains only on phone-qa (matrix shard) and unit (tz/scope matrix) jobs and no other job with that wording lacks a matrix.
3. Allow-list check still exits 0 (HEAD_REF=claude/ci-skip-drafts, PR_FILES = the 3 files); YAML parses.
4. Round 2 OK items still hold at this head.
