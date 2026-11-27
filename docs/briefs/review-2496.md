# Review: Website PR #2496 at head d5373db8f (dancer-area isolation seams, P44, read-only)

Repo: bachata-website. You review, you do not change code. Write ONLY docs/review/pr-2496.md on your branch claude/review-2496 and push it (plain git, no gh api).

Do: git fetch origin claude/isolation-seams-3 main; diff origin/main...d5373db8f. Check:
1. The 3 rule (c) violations on main (ClassJoinPage.tsx, PersonPage.tsx, RaffleDoor.tsx importing a dancer-app module directly) are each routed through a seam file, and no other file starts importing dancer-app modules outside a seam.
2. Each new seam only re-exports or thinly wraps; no behaviour change for those three files (same props, same exports, same lazy loading if any).
3. Entries added to the isolation allowlist JSON are the seam files only, each with a reason note; no broad glob that would hide future violations.
4. The script the dancer-area-isolation CI job runs exits 0 at the head; npx tsc --noEmit -p . shows no new errors in touched files; npx vitest run for any test touching these files passes.
Headings must be exactly: `## Verdict: PASS` (or `PASS WITH NITS` / `BLOCK`) with a line `head d5373db8f` and reason beneath. Quick review (not hard tier).
