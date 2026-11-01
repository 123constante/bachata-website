# Handover: p3-wt-states (PR #1251), fix round 1

Branch `claude/p3-wt-states`. Brief `docs/briefs/p3-wt-states-fix.md` (branch `brief/p3-wt-states-fix`),
review `docs/review/pr-1251-r1.md` (branch `claude/review-1251-r1`, verdict BLOCK). Ticket dt_8911b5c95cf2.

## The big finding: the PR duplicated main
The branch was cut from `ea16d47`. After that, main landed #1217 (F-17 F-18 F-19 F-22 F-24 F-25),
#1218 (F-16), #1220 (F-34) and #1237 (F-06), which are the same rows. The PR conflicted with main in
13 files, and merging it would have reverted main's reviewed versions. In this round:

- Merged `origin/main` (12483ca) into the branch. **On every conflict, main's version was kept**: it
  already has the stable F-24 callback (a ref plus `useCallback`), the separate F-19 empty copy and
  the F-22 banner that clears itself (`useSavedToast`).
- Deleted the branch's `states.matrix.test.tsx`. It tested the duplicate code, and 7 of its 10
  tests fail against main.

## Done this round (on top of main)
| Row | Fix | Red-first proof |
|---|---|---|
| F-24 | No code change: main's `onLeave` is already stable. `dateFieldLeave.test.tsx` now also asserts exactly one prompt and that Stay resets the blocker. | Under the PR's inline `setRouteGo(() => a.go)` callback, the file hangs until it is killed (exit 143). On main it passes 12/12. |
| F-06 | New test in `w3a.r3.test.tsx`: the profile is unfinished, so the lock always renders. Clicking "Complete your profile" on Details and Prices moves the in-app router to `/account/o/complete`. | With `<a href>` instead of `RouterLink`: 2 tests fail. With the fix: they pass. |
| F-22 | Owner decision 2026-11-01. An archived event reads **Finished**. The changes: `statusOf` maps archived to `{key:'finished', label:'Finished'}`; the `'removed'` key and its CSS are gone; the archived card now says "This event has finished"; the testid is `p3-event-archived`. One `ARCHIVED_WHY` (status.ts) is shared by `STATUS_COPY.archivedWhy`, and `PUBLIC_PAGE_WHY.archived` and `REPEAT_WHY.archived` say the same thing. Only the Remove flow says "Removed from your events.". The test is renamed `archivedEvent.test.tsx`: a table over 525 shapes (lifecycle x format x kind x upcoming) plus 5 screens. | Against main's code: 82 tests fail. With the fix: they pass. |
| F-19 | Already fixed on main (`CANCEL_COPY.emptyReasons` is its own line and has Try again). No change. | n/a |
| F-17 | `VENUE_LIST_COPY.empty` no longer points at a team contact that isn't on screen. It now says "Try again in a moment" next to the Try again button. | copy |
| review #7 | Already fixed on main (`useSavedToast` clears the history state). No change. | n/a |
| overlay e2e | `tests/e2e/walk-p3-wt-states.spec.ts`, added to `test:e2e:p3`. At 390x844: the status sheet, Close, "Yes, remove it" and "Keep it" are inside the viewport, and opening the sheet or the confirm step scrolls nothing. Remove lands on Events with the toast inside the viewport and no sideways scroll. The archived card shows Finished, and the word "removed" never appears. | 2/2 pass locally |

## Shape survey (prod stsdtacfauprzrdebmzg, read-only counts, 2026-11-01)
`event_series_p5` by lifecycle: archived 653, live 69, ended 21, draft 13, paused 2.
Formats: one_off, recurring, course, festival. Of the archived, 39 come from the legacy import
(`legacy_event_id` set) and 614 don't. 611 archived have no slug. Every lifecycle and format is in
the F-22 table.

## Left / next
- Ricky's phone check of the Remove flow and an archived deep link on a preview.
- The per-job gate results and the bundle comparison (main vs branch) are in the PR #1251 body.
