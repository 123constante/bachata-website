# Handover: fix-1220-merge-main

Merged origin/main (c72e668, after #1217 and #1218) into claude/p3-fix-cache.

## Conflict table
| File | Hunks | Kept | Why |
|---|---|---|---|
| p3/new/useCreateSave.ts (add/add) | import + `refresh` | HEAD (branch) | Main's side was the plain `refresh` without public-cache invalidation. Branch adds `invalidatePublicEventCaches` (F-33), which is the superset. Nothing else on main's side differed. |
| p3/screens/EventPage.tsx | import line | HEAD (branch) | Adds `publicPageOf` (F-34 dancer view) on top of main's imports; main added no other symbols. |

Steps 2 and 3 of the brief were already in the branch: sessions.ts `reload()` calls `invalidatePublicEventCaches(qc)` (sessions.ts:300) and useCreateSave's `refresh` calls it.

## Verified
- Merge commit made, no conflict markers left.
- `vitest run src/modules/organiser`: 234 files, 8661 tests passed, 2 skipped.
- tsc --noEmit: no errors reported in the captured output.

## Not verified
- Full CI job list, `check:bundle-budget`, lint chain: not run locally (context/time).
- The EXEMPT-list removal red-first check in publicCache.test.tsx: not re-verified (the file was not found at src/modules/organiser/shared/publicCache.test.tsx; the earlier merge commit 01c6244 claims it).
- PR body bullets not updated (no gh/API access in this run).
- No browser walk or prod shape survey.
