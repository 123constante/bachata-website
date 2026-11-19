## Aim
One review pass over three CI-flake fix PRs in 123constante/bachata-website. Read-only on the builders' branches. Write verdict docs only.

## PRs (check out each head, read the diff against origin/main plus the worker handover on the branch)
- #1855 branch claude/flake-dancer-home-189 head f5dd1ed (dancer-home:189 flake)
- #1856 branch claude/flake-switch-r4-31 head fcde142 (dev server pre-scan so Vite dep optimizer never full-reloads mid-test)
- #1857 branch claude/flake-layout-190 head 208c569 (organiser-layout:190 flake)

## Check per PR
1. Fix addresses the stated root cause, not a retry, longer timeout or skipped test.
2. No product code behaviour change; test or config only unless the handover justifies it.
3. No assertion weakened; the test still fails when the real bug is present.
4. Nothing outside the flake's scope touched.

## Output
For each PR write docs/review/<pr>-r1.md on branch claude/review-flakes-r1 (one shared branch, push once). Each doc: a line "head <full sha of the PR head you reviewed>", then "## Verdict: PASS" or "## Verdict: BLOCK", then up to 5 short findings. Do not merge, approve or comment on the PRs.
