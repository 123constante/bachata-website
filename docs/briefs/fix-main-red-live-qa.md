# BRIEF: fix-main-red-live-qa (WEBSITE; branch `claude/fix-main-red-live-qa`; careful lane; the daily Live QA workflow is red on main)

Brief-version: 2
The `Live QA (daily)` workflow has been red on main since at least 2026-10-27: its Playwright shape-matrix reports "new page-check findings (not in baseline.json)", for example on `/event/bachata-time-by-spike` (run 41973390944). Find out what each finding is and fix the real cause. Do not just widen the baseline. You never approve or merge.

## What main lacks
- A green `Live QA (daily)` run -- grep: `gh run list --repo 123constante/bachata-website --branch main --workflow "Live QA (daily)" --limit 5 --json conclusion` shows only failures; `.github/workflows/live-qa.yml` is the workflow

## What to do
1. Read `.github/workflows/live-qa.yml`, find the spec and the baseline file it names, and run the same command locally against the same target (read-only: it must not write to production).
2. For EACH finding, classify it in a table in the PR body: REAL BUG (page is wrong for a visitor), STALE BASELINE (finding is expected and was never recorded), or DATA (a prod record is odd; report it, never write to prod). Fix every REAL BUG in code with a failing test first. Add to the baseline only the STALE BASELINE rows, each with a one-line reason in the baseline file or the PR body.
3. If a finding is DATA, do not change it; list the record and what is wrong under `NOT verified:` so the owner can decide.
4. The workflow's own command must pass after your change. Run every other CI job step that applies to the files you touched. Per-job table and Verified / Not verified in the PR body, exact labels `Verified on real data:` and `NOT verified:`.
5. COMMITS: separate plain commands: `git add <files>`, `git commit -F <msgfile>`, `git push origin claude/fix-main-red-live-qa`. No `&&` chains, no `-c` flags, no inline multi-line `-m`. ONE push; final subject ends with the done marker of your ticket.

## Files
- .github/workflows/live-qa.yml (read only unless the fix needs it)
- the baseline file the workflow names
- the source files of any REAL BUG
- tests for each REAL BUG
