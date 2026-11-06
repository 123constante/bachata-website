# Handover: p3-different-on-n-dates (FIXLIST #63)

Source: RPC `admin_event_workspace_p5`, `occurrences[].override_keys` (text[]). Read-only; no write RPC called.

## Done
- `WorkspaceDate.override_keys` parsed tolerantly (seriesModel.ts).
- ONE mapping `differentDatesCount` in p3/model/differentDates.ts (coming, not-cancelled dates only).
- Details: quiet line under Name, About, Music, Where, Ticket link, Cover. Prices: under the price list. Hidden at 0; "of the dates shown" when capped.
- `ownDetailsOf` also counts detail override keys (music_styles included).
- Tests: differentDates.matrix.test.ts, differentDates.screens.test.tsx; fixtures gain `override_keys: []`.

## Red first
New matrix on main-equivalent code (override_keys not parsed): 17 failed | 1 passed (18).

## Gaps / next
- Photos (gallery): the mapping counts it, but Details has no photos control, so no line is shown (would point at nothing).
- Not run: `npm run lint`, `check:bundle-budget`; no PR opened; design record docs/design/<pr>.md and PR body still to write.
- No browser walk.

tsc run on HEAD: 0 errors in branch files (0 errors total).
Verified: vitest src/modules/organiser 222 files / 8433 tests pass; check:mojibake, check:integrity ok.

## Conflict round (merge of main into this branch)

- Merged origin/main (merge commit, no rebase/force). The clone was shallow, so the first merge said "unrelated histories"; `git fetch --unshallow` fixed it.
- Conflicts were only DetailsScreen.tsx and PricesScreen.tsx (imports, and in Details the old ticket/cover block that main moved up; in Prices the `different` const beside main's `freeSwitchShown`).
- Kept both: all of #1346 (the this-date-only / all-dates ScopeSheet flow, its copy and state) and the quiet "Different on N dates" lines. Cover and ticket moved with main's layout; their Different lines were re-attached at the new positions.
- Wording kept: #1346's sheet does not show a competing count of dates, so no wording was dropped; the new line stays as the quiet `p3-note` under the field.
- Fixture: seriesModel.test.ts WorkspaceDate literal gained `override_keys: []` (tsc error from the new required field).
- vitest run src/modules/organiser: 268 files, 11058 passed, 4 skipped.
- tsc (tsconfig.app.json) on the merge: no errors in Details/Prices/differentDates/seriesModel files after the fixture fix; remaining errors are in other files already on main.
