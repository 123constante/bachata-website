# Brief: organiser-stats-v2-share-card continuation 1 (Website, normal, merge conflict + walk-less finish)

Brief-version: 2
Repo: website (123constante/bachata-website). Branch: claude/organiser-stats-v2-share-card (PR #1428). Lane: normal, Sonnet. No new feature.

## What main lacks
- PR #1428 conflicts with origin/main in three files, so its CI cannot queue: src/modules/organiser/p3/data/stats.ts, src/modules/organiser/p3/screens/StatsScreen.tsx and src/modules/organiser/p3/screens/__tests__/screens.matrix.test.tsx (found with `git merge-tree origin/main origin/claude/organiser-stats-v2-share-card`). Main changed all three after the branch was cut. -- src/modules/organiser/p3/screens/StatsScreen.tsx

## Files
Only the three conflicted files plus a short handover docs/tickets/ file (new). Keep BOTH sides: main's newer Stats behaviour and this branch's Stats v2 (analyticsV2.ts, ShareLinkCard) wiring (see docs/briefs/organiser-stats-v2-share-card.HANDOVER.md on the branch).

## What to build
1. `git fetch origin main` then `git merge origin/main` on the branch; resolve the three conflicts keeping both sides.
2. Run the Stats tests (src/modules/organiser/p3/data/__tests__/analyticsV2.test.ts and screens.matrix.test.tsx) and tsc: 0 errors in the three files.
3. Push ONCE with the done marker. Do not touch anything else.

## Out of scope
The share link target (series id vs public event id) is a separate queued follow-up; do not change it.
