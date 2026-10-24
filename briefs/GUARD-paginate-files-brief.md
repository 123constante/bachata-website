# GUARD continuation -- read the WHOLE changed-file list (pagination)

Branch: `claude/guard-skip-docs-only` (PR #1016, head 0ccd46a2). Continue on it; do not open a new branch. Lane: normal (CI-guard script only). One push.

## Owner's words and the failure
Owner call 2026-10-24: "Skip docs-only, list the rest". The orchestrator ran the new sweep LIVE, read-only (`node scripts/check-pr-mergeable.mjs`, no `--publish-status`, ~30 s): `skipped docs-only: 0 (of 73 conflicting claude/ PR(s) checked)`, 73 FAIL. The guard cannot do its one job on live data.

Cause: `fetchDocsOnly` reads `files(first:100)` once; a list longer than the page is (correctly) never docs-only. 12 conflicting docs-only PRs have 144-448 files each (#766 #767 #768 #824 #825 #831 #835 #837 #838 #839 #844 #884), so none is skipped. Independent count: of 73 conflicting claude/ PRs, exactly those 12 are docs-only (all files pass `scripts/ci/docs-only.mjs` or sit under `briefs/`); the other 61 touch code.

The check that would have caught it: a fixture with more files than one page (the brief's surveyed shapes were all small).

## What to build
1. `fetchDocsOnly`: when a PR's `files.pageInfo.hasNextPage` (add `pageInfo{hasNextPage endCursor}` to the files selection), keep reading that PR's files with `after:` cursors until the list is whole. A hard cap (suggest 10 pages = 1000 files) beyond which the PR is NOT docs-only (fails, never a guess). Same outage rules as today: a 5xx leaves the PR NOT JUDGED; any other error exits 2.
2. Early exit: as soon as any fetched file is not docs-only, stop paging that PR (it will FAIL anyway). This keeps the live cost to the 12 docs-only PRs.
3. Keep the "an integer totalCount equal to the paths fetched" check on the assembled list.
4. Self-test additions (red first against the current branch head): a docs-only PR of 250 files across 3 pages is SKIPPED; 250 docs + 1 code file on page 3 FAILS; a PR over the cap FAILS; a page that 5xx mid-way is NOT JUDGED; a cursor that never advances does not loop forever; totalCount mismatch FAILS. Mutate your new rules (drop the cursor, drop the cap, drop the early exit) and show each mutant is killed.
5. Update `docs/guard-notes/skip-docs-only/HANDOVER.md` (what changed, cap, live numbers).

## Hard rules
- Read-only against GitHub in the sandbox if you have a token; if you get HTTP 401, say so under NOT verified. The orchestrator re-runs the live sweep after you (expect `skipped docs-only: 12`).
- No workflow file, no `supabase/**`, no migration. Only `scripts/check-pr-mergeable.mjs`, its handover, and `docs/ci-guard-notes.md` if a sentence goes stale.
- NO backslash in the script (see its header). One review round (CI-guard rule), mutants required.
- PR body already exists on #1016: keep its headings exact (Summary, Scope, Validation Evidence, Verified on real data, Phone QA) and update the numbers.
- Run every applicable CI job step; put the per-job table in the PR body. Stay under the lane context cap; push + handover before stopping.
