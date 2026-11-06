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
