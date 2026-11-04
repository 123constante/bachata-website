# p3-dates-fix-1 — HANDOVER

## Rebase on main (ticket dt_e18a5635cbca, brief `docs/briefs/p3-dates-fix-1-rebase.md`, 2026-11-04)
- Merged `origin/main` 27a9c52 (merge commit, no force-push). **Main won** for `p3/data/olderDates.ts` and
  `p3/screens/AllDatesScreen.tsx` (taken whole from main, #1218 F-27). This branch's own W-31 paging code
  (`useInfiniteQuery`, "Show N older dates") is DELETED: the PR now carries no W-31 code.
- `DateSheet.tsx` / `DateFieldSheets.tsx`: both sides kept (main's `VenueList` and F-24 route blocker `'route'` ask
  + this branch's W-35 `KeptProps` / conflict).
- **W-31 on main, proven**: `datesFix.matrix.test.tsx` W-31 cells rewritten to drive main's control (`p3-load-older`,
  one tap reads every older page at p_limit 200) and to count LISTED rows (the tab numbers are whole-series meta
  counts, so they pass before anything loads; the old cells' count check was too weak). Run against PURE main:
  **all 37 W-31 cells GREEN** (35 size x tab for 0/1/99/100/101/132/500, oldest-of-132 opens, failure + Try again)
  and W-35 ok/refused/offline green; **4 W-35 conflict cells RED** = the delta. See `red-on-main.txt`.
- **W-35 kept**, merged code: 44/44 green. Mutants re-run on the merged code: Save enabled during a conflict
  (1 fail = killed); Start again without the workspace refetch (1 fail = killed).
- Walk: NOT done here by design (walk worker `claude/walk-p3-batch-1`).

## Earlier (dt_3fb8700f750d, PARTIAL: browser walk not done)

Branch `claude/p3-dates-fix-1` (from main 5d20065). Ticket dt_3fb8700f750d.

## Done
- **The read, proven** (prod, read-only `pg_proc`): `admin_event_workspace_p5(p_series_id, p_before date, p_limit int)` pages:
  dates `< p_before`, newest first, limit 1..200 (default 100); `meta.has_more`, `meta.next_before`, whole-series `meta.total`.
  So W-31 got a REAL "Show older dates", not an "ask the team" line. No admin-repo note needed.
- **W-31** `p3/data/olderDates.ts` (new): `useInfiniteQuery` keyed UNDER `eventWorkspaceQueryKey(seriesId)`, enabled once asked
  (so a save's workspace invalidation refetches the older pages too; no stale versions). `AllDatesScreen.tsx`: under the
  "newest 100 of 132" line, "Show 32 older dates" (busy / error / retry), on every tab; older dates open and edit like any other.
- **W-35** `DateSheet.tsx` `useGo` remembers a `version_conflict`; `StoredDate.refresh` re-reads the date (`event_view_p5`) and the
  event (refetch, fresh version) and remounts the field sheet. `DateFieldSheets.tsx`: Save disabled while the conflict stands,
  `ConflictNote` says why + "Start again"; after it, `KeptOffer`: "This is the date as it is now. Your changes are not saved."
  "Put my changes back" / "Drop my changes". Same on the About / Ticket sheets.
- **Tests** `p3/screens/__tests__/datesFix.matrix.test.tsx`: 44 cells: sizes 0/1/99/100/101/132/500 x 5 tabs (every date reachable,
  counts add to N, line gone), open the oldest of 132, older-page failure + retry, save outcomes ok/refused/offline/conflict,
  Start again -> Put back -> save at new version, Drop, About conflict. **21 red on main** (`red-on-main.txt`), 44 green.
- **Mutants killed**: hidden dates with no way (17 fail), conflict leaves Save enabled (1 fail), Start again without refetch (3 fail).

## Gates run locally
- `npm run lint`: PASSED, 24 of 24 links (whole-tree eslint informational, as on main); eslint on the 5 touched files: clean.
- `vitest run src/modules/organiser`: 8455 pass; the one failure (gate.matrix "every write catch goes through the gate") was mine and is fixed (re-run: 269/269 in the 4 affected files).
- `tsc`: no errors in touched files (4 pre-existing p3 errors are on main).
- `check:integrity`: ok (3029 files). `check:bundle-budget`: `/app` 371.8 KB / 47 files on main AND branch (0 change); all budgets ok.

## Left / next steps
1. **Browser walk at 390x844 (not done; context gate).** Reuse `tests/e2e/walk-p3-walklist.spec.ts` from `claude/walk-p3-walklist-1`:
   W-31 with 132, 100, 99 dates (click "Show 32 older dates", Past tab, open the oldest); W-35 conflict -> Start again -> save.
   Open every picture; one line each in `docs/walk/p3-dates-fix-1/RESULTS.md`.
2. PR checks per job: read them on the PR, fix any red.
3. `/code-review` round (user-facing: two rounds) was not run.
