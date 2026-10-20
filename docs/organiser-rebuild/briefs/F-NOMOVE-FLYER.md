# Brief F-NOMOVE-FLYER -- ONE fix pass on PR #880 (review findings, push ONCE)

Repo `123constante/bachata-website`, branch `claude/org-r1-nomove-flyer` (PR #880, head 0d90da8f). You continue on that branch: `git fetch origin claude/org-r1-nomove-flyer` then check it out. Read the review: `git fetch origin claude/done-r-nomove-flyer` then `git show FETCH_HEAD:docs/organiser-rebuild/reviews/R-NOMOVE-FLYER.md` and the author handover `docs/organiser-rebuild/handovers/S-NOMOVE-FLYER.md` on the PR branch. Owner decision behind it: "Move to another day" (single date) is removed from R1; the series-level "Change the day" and Pick.tsx bulk shift stay.

Fix exactly these findings (no other change, no scope creep):
1. `src/modules/organiser/flows/change/ChangeFlow.tsx:11`: `ChangeStep` still has `'day'` but `STEPS` does not. Drop `'day'` from the union (or type it `keyof typeof STEPS`) so `step="day"` fails typecheck.
2. `src/modules/organiser/__tests__/consistency.render.matrix.test.tsx:127`: remove the dead `<Route .../day element={<ChangeFlow step="day" />}>` for the deleted screen.
3. `src/modules/organiser/shared/dateList.ts:56`: comment says `comingDays` "Feeds Add a date and Move to another day": make it "Feeds Add a date". Grep once more for any remaining mention of moving a date in comments/copy.
4. Add ONE routes test row: `/account/o/change/s1/o1/day` (the old deep link) renders `change-missing` (Not found + Back to Home), so it stays safe.
5. Add ONE row to `flows/__tests__/upsertName.test.tsx` for a recurring ("weekly night") first date: `dateCommands('recurring', ...)` upsert carries `name` (then `set_recurrence`).

Red first where a test can fail: run the new rows 4 and 5 and the typecheck (1) against the unfixed code and state the result in the PR body (row 5 may already pass: say so, it is a pin, not a fix).

Then run EVERY CI step you can: `npx vitest run src/modules/organiser`, `npx tsc --noEmit -p tsconfig.app.json` (organiser files; 2 pre-existing errors TeamPicker.test, NewPageFlow.test are known), `npm run build`, `bash bin/check-integrity.sh`, eslint on changed files, `npm run lint:architecture`. Per-job table (command + exit code + test COUNT) in your handover `docs/organiser-rebuild/handovers/F-NOMOVE-FLYER.md`. ONE push, final commit subject ends `[worker-done <ticket>]`. Plain git only, never gh api, shell commands without variables/loops.
