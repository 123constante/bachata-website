# Handover F-NOMOVE-FLYER (ticket dt_1090dd21e1c3)

Fix pass on PR #880 (branch `claude/org-r1-nomove-flyer`, base head 0d90da8f). Five edits, nothing else.

## Done
1. `ChangeFlow.tsx`: `'day'` dropped from `ChangeStep`; three dead `step="day"` routes removed (consistency.render.matrix, change.flow, pdates.flow tests) because typecheck fails on them once the union is narrowed.
2. `dateList.ts` comment: "Feeds Add a date." No other "move a date" mention remains in comments/copy (grep: only C20 "there is no Move" assertions and the unrelated shift-into-the-past message).
3. New row (change.flow.test.tsx): `/account/o/change/s1/o1/day` renders `change-missing` + Back to Home, no Save. The harness gained the real `:field` detail route.
4. New row (upsertName.test.tsx): recurring first date sends `series.upsert` with `name` then `series.set_recurrence`.

## Red first
Rows 3 and 4 are PINS: both already pass on the unfixed code (the `/day` link fell through to the `:field` Detail route's Missing screen; the recurring upsert already carried the name). Typecheck: a narrowed `ChangeStep` makes the three `step="day"` routes fail tsc, per the earlier worker's run.

## Checks
| Job | Command | Result |
|---|---|---|
| Organiser tests | `npx vitest run src/modules/organiser` | exit 0, 118 files, 3350 passed, 2 skipped |
| Typecheck | `npx tsc --noEmit -p tsconfig.app.json` | only the 2 known errors under src/modules/organiser (TeamPicker.test, NewPageFlow.test) |
| eslint | changed files | exit 0 |
| build / check-integrity / lint:architecture | not run before push (see below) | see PR |

## Not verified
Full build, `bash bin/check-integrity.sh`, `npm run lint:architecture`, browser walk, and prod data shape survey (test-only change, no UI shape change).
