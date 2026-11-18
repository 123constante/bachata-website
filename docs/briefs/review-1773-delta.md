# Review (delta): Website PR #1773 at head f77340656 (normal lane, read-only)

Repo: bachata-website. You review, you do not change code. Write ONLY docs/review/pr-1773-r2.md on your branch claude/review-1773-r2 and push it (plain git, no gh api).

Context: round 1 (docs/review/pr-1773-r1.md on branch origin/claude/review-1773) gave PASS WITH NITS at head 19efb53. Later, one commit f77340656 moved serverToday.ts and its test into src/modules/dancer-app/screens/tickets/ and the handover to docs/handover/ (fix for check-dancer-area-isolation), imports updated.

Do: git fetch origin claude/ticketing-clock, diff 19efb53..f77340656. Confirm: (1) only moves/renames plus import path fixes, no logic change (compare contents modulo path); (2) no import still points at the old path; (3) node scripts/check-dancer-area-isolation.mjs exits 0; (4) npx tsc --noEmit shows no new errors in touched files and the three new tests pass (npx vitest run on them).
Doc needs headings `Verdict` (PASS / PASS WITH NITS / FAIL) and `Hard-tier` (write "n/a, not hard-tier").
